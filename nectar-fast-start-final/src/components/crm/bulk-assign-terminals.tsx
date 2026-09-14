import { useCallback, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, PackagePlus, ScanLine, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { bulkAssignDevices } from "@/lib/deals.functions";
import { BarcodeScannerDialog } from "@/components/crm/barcode-scanner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { playBeep } from "@/lib/beep";

type Rep = { user_id: string; full_name: string | null; email: string | null };
type DeviceLite = { id: string; serial_number: string };

type Row = { serial: string; known: boolean; add: boolean };

export function BulkAssignTerminals({
  open,
  onOpenChange,
  devices,
  reps,
  model = "NectarPay POS",
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  devices: DeviceLite[];
  reps: Rep[];
  model?: string;
  onAssigned?: () => void;
}) {
  const [step, setStep] = useState<"scan" | "assign">("scan");
  const [rows, setRows] = useState<Row[]>([]);
  const [repId, setRepId] = useState<string>("");

  const known = useMemo(
    () => new Set(devices.map((d) => d.serial_number.toLowerCase())),
    [devices],
  );

  const reset = () => {
    setRows([]);
    setRepId("");
    setStep("scan");
  };

  const close = () => {
    onOpenChange(false);
    reset();
  };

  const handleScan = useCallback(
    (raw: string) => {
      const serial = raw.trim();
      if (!serial) return;
      setRows((prev) => {
        if (prev.some((r) => r.serial.toLowerCase() === serial.toLowerCase())) {
          toast.info(`${serial} already scanned`);
          return prev;
        }
        const isKnown = known.has(serial.toLowerCase());
        if (!isKnown) {
          playBeep(false);
          toast.warning(`${serial} isn't in inventory — choose skip or add`);
        }
        return [{ serial, known: isKnown, add: false }, ...prev];
      });
    },
    [known],
  );

  const assign = useMutation({
    mutationFn: () =>
      bulkAssignDevices({
        data: {
          serials: rows.filter((r) => r.known || r.add).map((r) => r.serial),
          assigned_rep_id: repId,
          create_missing: rows.filter((r) => !r.known && r.add).map((r) => r.serial),
          model,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        `Assigned ${res.assigned + res.created} terminal${res.assigned + res.created === 1 ? "" : "s"}` +
          (res.created ? ` (${res.created} newly added)` : ""),
      );
      onAssigned?.();
      close();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Bulk assign failed"),
  });

  const unresolved = rows.filter((r) => !r.known && !r.add).length;
  const willAssign = rows.filter((r) => r.known || r.add).length;

  if (!open) return null;

  if (step === "scan") {
    return (
      <BarcodeScannerDialog
        open
        onOpenChange={(v) => {
          if (!v) close();
        }}
        onScan={handleScan}
        continuous
        recent={rows.map((r) => r.serial)}
        title="Bulk assign terminals"
        description="Scan each terminal one after another. Tap “I'm done” when you've finished."
        doneLabel="I'm done"
        onDone={() => {
          if (rows.length === 0) {
            toast.info("Scan at least one terminal first");
            return;
          }
          setStep("assign");
        }}
      />
    );
  }

  return (
    <Dialog open onOpenChange={(v) => (v ? null : close())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign {rows.length} scanned terminal{rows.length === 1 ? "" : "s"}</DialogTitle>
          <DialogDescription>Pick who is taking these terminals.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label className="text-xs">Assign to</Label>
          <Select value={repId} onValueChange={setRepId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a user" />
            </SelectTrigger>
            <SelectContent>
              {reps.map((r) => (
                <SelectItem key={r.user_id} value={r.user_id}>
                  {r.full_name || r.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
          {rows.map((r) => (
            <li key={r.serial} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
              <span className="flex-1 font-mono text-xs">{r.serial}</span>
              {r.known ? (
                <Badge variant="secondary">In inventory</Badge>
              ) : r.add ? (
                <Badge>Will be added</Badge>
              ) : (
                <span className="flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" /> Not in inventory
                </span>
              )}
              {!r.known ? (
                <Button
                  type="button"
                  size="sm"
                  variant={r.add ? "ghost" : "secondary"}
                  onClick={() =>
                    setRows((prev) =>
                      prev.map((x) => (x.serial === r.serial ? { ...x, add: !x.add } : x)),
                    )
                  }
                >
                  {r.add ? "Undo" : <><PackagePlus className="mr-1 h-3.5 w-3.5" /> Add</>}
                </Button>
              ) : null}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Remove ${r.serial}`}
                onClick={() => setRows((prev) => prev.filter((x) => x.serial !== r.serial))}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>

        {unresolved ? (
          <p className="text-xs text-muted-foreground">
            {unresolved} scanned serial{unresolved === 1 ? " is" : "s are"} not in inventory and will be
            skipped unless you add {unresolved === 1 ? "it" : "them"}.
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="secondary" onClick={() => setStep("scan")}>
            <ScanLine className="mr-2 h-4 w-4" /> Scan more
          </Button>
          <Button
            type="button"
            disabled={!repId || willAssign === 0 || assign.isPending}
            onClick={() => assign.mutate()}
          >
            Assign {willAssign} terminal{willAssign === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
