import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { Check, Link2Off, ScanLine, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { DEVICE_STATUSES, deleteDevice, listDevices, unlinkDeviceCoin, upsertDevice, type DeviceStatus } from "@/lib/deals.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageSkeleton } from "@/components/crm/loading-state";
import { BarcodeScannerDialog } from "@/components/crm/barcode-scanner";
import { DeviceRollup } from "@/components/crm/device-rollup";
import { BulkAssignTerminals } from "@/components/crm/bulk-assign-terminals";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatStrip, fmtInt, fmtMoney } from "@/components/crm/kit";

/** Hardware list price used for inventory valuation. */
const UNIT_VALUE = 499;

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/devices")({
  component: Devices,
  // Warm the cache while the route chunk loads instead of after it mounts.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery({ queryKey: ["crm-devices"], queryFn: () => listDevices() });
  },
  head: () => ({
    meta: [
      { title: "Terminal inventory | NectarPay CRM" },
      { name: "description", content: "Every NectarPay terminal, its status, and which rep or business holds it." },
    ],
  }),
});

const DEVICE_STATUS_LABEL: Record<DeviceStatus, string> = {
  in_inventory: "In inventory",
  assigned_to_rep: "With rep",
  pending_sale: "Pending sale",
  placed_contingent: "Placed (contingent)",
  sold: "Sold",
  returned: "Returned",
  lost: "Lost",
  damaged: "Damaged",
};

type DeviceRow = {
  id: string;
  serial_number: string;
  model: string;
  status: string;
  assigned_rep_id: string | null;
  coin_id: string | null;
};

/** Coin link cell: shows the linked coin, lets admins link one or unlink (with confirmation upstream). */
function CoinCell({
  device,
  isAdmin,
  busy,
  onUnlink,
  onLink,
}: {
  device: DeviceRow;
  isAdmin: boolean;
  busy: boolean;
  onUnlink: (d: DeviceRow) => void;
  onLink: (d: DeviceRow, coinId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");

  if (device.coin_id) {
    return (
      <div className="flex items-center gap-1">
        <span className="font-mono text-xs">{device.coin_id}</span>
        {isAdmin ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={`Unlink coin ${device.coin_id} from ${device.serial_number}`}
            disabled={busy}
            onClick={() => onUnlink(device)}
          >
            <Link2Off className="h-3.5 w-3.5 text-destructive" />
          </Button>
        ) : null}
      </div>
    );
  }

  if (!isAdmin) return <span className="text-muted-foreground">—</span>;

  if (!editing) {
    return (
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditing(true)}>
        Link coin
      </Button>
    );
  }

  const save = () => {
    if (!/^\d{6}$/.test(val)) {
      toast.error("Coin ID must be exactly 6 digits");
      return;
    }
    onLink(device, val);
    setEditing(false);
    setVal("");
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        autoFocus
        value={val}
        inputMode="numeric"
        maxLength={6}
        placeholder="123456"
        className="h-7 w-20 font-mono text-xs"
        onChange={(e) => setVal(e.target.value.replace(/\D/g, "").slice(0, 6))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Save coin" onClick={save}>
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        aria-label="Cancel"
        onClick={() => setEditing(false)}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function Devices() {
  const list = useServerFn(listDevices);
  const save = useServerFn(upsertDevice);
  const remove = useServerFn(deleteDevice);
  const unlinkCoin = useServerFn(unlinkDeviceCoin);
  const { isAdmin } = useRouteContext({ from: "/_authenticated/admin" });
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["crm-devices"], queryFn: () => list() });

  const del = useMutation({
    mutationFn: (v: { id: string }) => remove({ data: v }),
    onSuccess: () => {
      toast.success("Terminal deleted");
      qc.invalidateQueries({ queryKey: ["crm-devices"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete terminal"),
  });

  const unlink = useMutation({
    mutationFn: (v: { id: string }) => unlinkCoin({ data: v }),
    onSuccess: () => {
      toast.success("Coin unlinked from terminal");
      setUnlinkTarget(null);
      qc.invalidateQueries({ queryKey: ["crm-devices"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not unlink coin"),
  });

  const link = useMutation({
    mutationFn: (v: {
      id: string;
      serial_number: string;
      model: string;
      status: DeviceStatus;
      assigned_rep_id: string | null;
      coin_id: string;
    }) => save({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(`Coin ${v.coin_id} linked to ${v.serial_number}`);
      qc.invalidateQueries({ queryKey: ["crm-devices"] });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Could not link coin";
      toast.error(
        msg.includes("devices_coin_id_unique") || msg.toLowerCase().includes("duplicate")
          ? "That coin ID is already linked to another terminal"
          : msg,
      );
    },
  });

  const [form, setForm] = useState({ serial_number: "", coin_id: "", model: "NectarPay POS", assigned_rep_id: "none" });
  const [scanMode, setScanMode] = useState<null | "field" | "bulk" | "lookup" | "coin">(null);
  const [bulkAssign, setBulkAssign] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [unlinkTarget, setUnlinkTarget] = useState<DeviceRow | null>(null);

  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DeviceStatus>("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const formRef = useRef(form);
  formRef.current = form;
  const devicesRef = useRef<Array<{ id: string; serial_number: string }>>([]);

  const add = useMutation({
    mutationFn: () =>
      save({
        data: {
          serial_number: form.serial_number,
          model: form.model,
          status: form.assigned_rep_id === "none" ? ("in_inventory" as const) : ("assigned_to_rep" as const),
          assigned_rep_id: form.assigned_rep_id === "none" ? null : form.assigned_rep_id,
          coin_id: form.coin_id,
        },
      }),
    onSuccess: () => {
      toast.success("Device saved");
      setForm({ serial_number: "", coin_id: "", model: "NectarPay POS", assigned_rep_id: "none" });
      qc.invalidateQueries({ queryKey: ["crm-devices"] });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Could not save device";
      toast.error(
        msg.includes("devices_coin_id_unique") || msg.toLowerCase().includes("duplicate")
          ? "That coin ID is already linked to another terminal"
          : msg,
      );
    },
  });

  const patch = useMutation({
    mutationFn: (v: {
      id: string;
      serial_number: string;
      status: DeviceStatus;
      assigned_rep_id: string | null;
    }) => save({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-devices"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const bulkAdd = useMutation({
    mutationFn: (v: {
      serial_number: string;
      model: string;
      status: DeviceStatus;
      assigned_rep_id: string | null;
    }) => save({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(`Added ${v.serial_number}`);
      qc.invalidateQueries({ queryKey: ["crm-devices"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add device"),
  });

  const focusDevice = (id: string, serial?: string) => {
    setHighlightId(id);
    // Make sure the row is on the current page before scrolling to it.
    if (serial) {
      setSearch(serial);
      setStatusFilter("all");
    }
    setPage(0);
    setTimeout(() => {
      document.getElementById(`device-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 60);
  };

  const handleScan = useCallback(
    (raw: string) => {
      const serial = raw.trim();
      if (!serial) return;
      const mode = scanMode;

      // Coin QR capture: pull the 6-digit key into the add form.
      if (mode === "coin") {
        const digits = serial.match(/\d{6}/)?.[0] ?? "";
        if (!digits) {
          toast.error("No 6-digit coin ID found in that code");
          return;
        }
        setForm((f) => ({ ...f, coin_id: digits }));
        toast.success(`Coin ${digits} captured`);
        return;
      }

      const existing = devicesRef.current.find(
        (d) => d.serial_number.toLowerCase() === serial.toLowerCase(),
      );

      if (existing) {
        toast.info(`${existing.serial_number} is already in inventory`);
        focusDevice(existing.id, existing.serial_number);
        if (mode === "field") setForm((f) => ({ ...f, serial_number: existing.serial_number }));
        return;
      }

      if (mode === "lookup") {
        toast.warning(`${serial} isn't in inventory — added to the form`);
        setForm((f) => ({ ...f, serial_number: serial }));
        return;
      }

      if (mode === "field") {
        setForm((f) => ({ ...f, serial_number: serial }));
        return;
      }

      // bulk intake: create immediately with the current model / assignment
      const f = formRef.current;
      setRecent((r) => [serial, ...r]);
      bulkAdd.mutate({
        serial_number: serial,
        model: f.model,
        status: f.assigned_rep_id === "none" ? "in_inventory" : "assigned_to_rep",
        assigned_rep_id: f.assigned_rep_id === "none" ? null : f.assigned_rep_id,
      });
    },
    [scanMode],
  );

  if (query.isLoading) return <PageSkeleton />;
  if (query.error) return <p className="text-sm text-destructive">{(query.error as Error).message}</p>;

  const reps = query.data?.reps ?? [];
  const repName: Record<string, string> = {};
  for (const r of reps) repName[r.user_id] = r.full_name || r.email || "Rep";
  const leadName: Record<string, string> = {};
  for (const l of query.data?.leads ?? []) leadName[l.id] = l.business_name ?? "";
  const devices = query.data?.devices ?? [];
  devicesRef.current = devices;

  // "All terminals" tab: filter + paginate so we never render thousands of rows at once.
  const q = search.trim().toLowerCase();
  const filtered = devices.filter((d) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (!q) return true;
    return (
      d.serial_number.toLowerCase().includes(q) ||
      (d.coin_id ?? "").toLowerCase().includes(q) ||
      (d.model ?? "").toLowerCase().includes(q) ||
      (d.assigned_rep_id ? (repName[d.assigned_rep_id] ?? "").toLowerCase().includes(q) : false) ||
      (d.current_lead_id ? (leadName[d.current_lead_id] ?? "").toLowerCase().includes(q) : false)
    );
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);


  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Terminal inventory</h1>
          <p className="text-sm text-muted-foreground">Every device and where it physically is.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setScanMode("lookup")}>
            <ScanLine className="mr-2 h-4 w-4" /> Scan to look up
          </Button>
          <Button variant="secondary" onClick={() => setBulkAssign(true)}>
            <ScanLine className="mr-2 h-4 w-4" /> Bulk assign
          </Button>
          <Button
            onClick={() => {
              setRecent([]);
              setScanMode("bulk");
            }}
          >
            <ScanLine className="mr-2 h-4 w-4" /> Bulk intake
          </Button>
        </div>
      </header>


      <StatStrip
        cells={[
          {
            label: "Inventory value",
            value: fmtMoney(
              devices.filter((d) => ["in_inventory", "assigned_to_rep"].includes(d.status as string))
                .length * UNIT_VALUE,
            ),
            target: `@ ${fmtMoney(UNIT_VALUE)}/unit`,
          },
          {
            label: "Available",
            value: fmtInt(devices.filter((d) => d.status === "in_inventory").length),
            target: "in inventory",
          },
          {
            label: "On contingent",
            value: fmtInt(devices.filter((d) => d.status === "placed_contingent").length),
            target: "placed",
          },
          {
            label: "Sold",
            value: fmtInt(devices.filter((d) => d.status === "sold").length),
            target: fmtMoney(devices.filter((d) => d.status === "sold").length * UNIT_VALUE),
          },
        ]}
      />



      <div className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2 xl:grid-cols-[1.2fr_0.8fr_1fr_1fr_auto]">
        <div className="space-y-1.5">
          <Label className="text-xs">Serial number</Label>
          <div className="flex gap-2">
            <Input
              value={form.serial_number}
              onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
              placeholder="NP-0001"
            />
            <Button type="button" variant="secondary" size="icon" aria-label="Scan barcode" onClick={() => setScanMode("field")}>
              <ScanLine className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">
            Coin ID <span className="text-muted-foreground">(optional)</span>
          </Label>
          <div className="flex gap-2">
            <Input
              value={form.coin_id}
              inputMode="numeric"
              maxLength={6}
              onChange={(e) => setForm((f) => ({ ...f, coin_id: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
              placeholder="123456"
            />
            <Button type="button" variant="secondary" size="icon" aria-label="Scan coin QR" onClick={() => setScanMode("coin")}>
              <ScanLine className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Model</Label>
          <Input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Assign to</Label>
          <Select
            value={form.assigned_rep_id}
            onValueChange={(v) => setForm((f) => ({ ...f, assigned_rep_id: v }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Inventory</SelectItem>
              {reps.map((r) => (
                <SelectItem key={r.user_id} value={r.user_id}>
                  {r.full_name || r.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button onClick={() => add.mutate()} disabled={!form.serial_number.trim() || add.isPending}>
            Add device
          </Button>
        </div>
      </div>

      <Tabs defaultValue="rollup">
        <TabsList>
          <TabsTrigger value="rollup">By manager &amp; rep</TabsTrigger>
          <TabsTrigger value="all">All terminals</TabsTrigger>
        </TabsList>

        <TabsContent value="rollup" className="mt-4">
          <DeviceRollup
            devices={devices}
            reps={reps}
            teams={query.data?.teams ?? []}
            teamMembers={query.data?.teamMembers ?? []}
            leadName={leadName}
            onMarkLost={(d) => {
              if (!window.confirm(`Mark terminal ${d.serial_number} as lost?`)) return;
              patch.mutate(
                {
                  id: d.id,
                  serial_number: d.serial_number,
                  status: "lost" as DeviceStatus,
                  assigned_rep_id: d.assigned_rep_id,
                },
                { onSuccess: () => toast.success(`${d.serial_number} marked lost`) },
              );
            }}
            onDelete={(d) => {
              if (!window.confirm(`Delete terminal ${d.serial_number}? This cannot be undone.`)) return;
              del.mutate({ id: d.id });
            }}
          />

        </TabsContent>

        <TabsContent value="all" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search serial, coin, model, rep or business…"
              className="h-9 w-full sm:w-72"
            />
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as "all" | DeviceStatus);
                setPage(0);
              }}
            >
              <SelectTrigger className="h-9 w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {DEVICE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {DEVICE_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setPage(0);
              }}
            >
              <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[25, 50, 100, 200].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} per page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {fmtInt(filtered.length)} of {fmtInt(devices.length)} terminals
            </span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Serial</th>
                  <th className="px-4 py-2">Coin</th>
                  <th className="px-4 py-2">Model</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Held by</th>
                  <th className="px-4 py-2">At business</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((d) => (
                  <tr
                    key={d.id}
                    id={`device-${d.id}`}
                    className={`border-t border-border/40 ${highlightId === d.id ? "bg-primary/10" : ""}`}
                  >
                    <td className="px-4 py-2 font-mono text-xs">{d.serial_number}</td>
                    <td className="px-4 py-2">
                      <CoinCell
                        device={d}
                        isAdmin={isAdmin}
                        busy={unlink.isPending || link.isPending}
                        onUnlink={(dev) => setUnlinkTarget(dev)}
                        onLink={(dev, coinId) =>
                          link.mutate({
                            id: dev.id,
                            serial_number: dev.serial_number,
                            model: dev.model,
                            status: dev.status as DeviceStatus,
                            assigned_rep_id: dev.assigned_rep_id,
                            coin_id: coinId,
                          })
                        }
                      />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{d.model}</td>
                    <td className="px-4 py-2">
                      <Select
                        value={d.status as DeviceStatus}
                        onValueChange={(v) =>
                          patch.mutate({
                            id: d.id,
                            serial_number: d.serial_number,
                            status: v as DeviceStatus,
                            assigned_rep_id: d.assigned_rep_id,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DEVICE_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {DEVICE_STATUS_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2">
                      <Select
                        value={d.assigned_rep_id ?? "none"}
                        onValueChange={(v) =>
                          patch.mutate({
                            id: d.id,
                            serial_number: d.serial_number,
                            status:
                              v === "none" && d.status === "assigned_to_rep"
                                ? "in_inventory"
                                : v !== "none" && d.status === "in_inventory"
                                  ? "assigned_to_rep"
                                  : (d.status as DeviceStatus),
                            assigned_rep_id: v === "none" ? null : v,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-[190px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Inventory</SelectItem>
                          {reps.map((r) => (
                            <SelectItem key={r.user_id} value={r.user_id}>
                              {r.full_name || r.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {d.current_lead_id ? leadName[d.current_lead_id] ?? "—" : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${d.serial_number}`}
                        disabled={del.isPending}
                        onClick={() => {
                          if (!window.confirm(`Delete terminal ${d.serial_number}? This cannot be undone.`)) return;
                          del.mutate({ id: d.id });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      {devices.length === 0 ? "No devices yet." : "No terminals match those filters."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {pageCount > 1 ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                Page {safePage + 1} of {pageCount}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={safePage === 0}
                  onClick={() => setPage(safePage - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage(safePage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!unlinkTarget} onOpenChange={(v) => !v && setUnlinkTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink coin {unlinkTarget?.coin_id}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes coin {unlinkTarget?.coin_id} from terminal {unlinkTarget?.serial_number}.
              The terminal itself is unaffected — only the coin link is removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={unlink.isPending}
              onClick={() => unlinkTarget && unlink.mutate({ id: unlinkTarget.id })}
            >
              {unlink.isPending ? "Unlinking…" : "Unlink coin"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BarcodeScannerDialog
        open={scanMode !== null}
        onOpenChange={(v) => setScanMode(v ? scanMode : null)}
        onScan={handleScan}
        continuous={scanMode === "bulk"}
        recent={recent}
        title={
          scanMode === "bulk"
            ? "Bulk intake"
            : scanMode === "lookup"
              ? "Scan to look up"
              : scanMode === "coin"
                ? "Scan coin QR"
                : "Scan serial number"
        }
        description={
          scanMode === "bulk"
            ? `Each scan is added as ${form.model}${form.assigned_rep_id === "none" ? " in inventory" : " assigned to the selected rep"}. Keep scanning.`
            : scanMode === "lookup"
              ? "Scan a terminal to jump to its row, or capture it into the add form if it's new."
              : scanMode === "coin"
                ? "Point the camera at the coin's QR code, or type the 6-digit coin ID below."
                : "Scan a barcode to fill the serial number field."
        }
      />

      <BulkAssignTerminals
        open={bulkAssign}
        onOpenChange={setBulkAssign}
        devices={devices}
        reps={reps}
        model={form.model}
        onAssigned={() => qc.invalidateQueries({ queryKey: ["crm-devices"] })}
      />
    </div>

  );
}
