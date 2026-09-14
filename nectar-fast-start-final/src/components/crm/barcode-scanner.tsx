import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { playBeep } from "@/lib/beep";

type Controls = { stop: () => void };

export function BarcodeScannerDialog({
  open,
  onOpenChange,
  onScan,
  title = "Scan barcode",
  description = "Point the camera at the terminal's serial barcode or QR code.",
  continuous = false,
  recent = [],
  doneLabel,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onScan: (value: string) => void;
  title?: string;
  description?: string;
  continuous?: boolean;
  recent?: string[];
  doneLabel?: string;
  onDone?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<Controls | null>(null);
  const lastRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");


  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        if (cancelled || !videoRef.current) return;
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => {
            if (!result) return;
            const text = result.getText().trim();
            if (!text) return;
            const now = Date.now();
            if (lastRef.current.text === text && now - lastRef.current.at < 2500) return;
            lastRef.current = { text, at: now };
            playBeep(true);
            onScan(text);

            if (!continuous) {
              controlsRef.current?.stop();
              onOpenChange(false);
            }
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls as Controls;
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error && e.name === "NotAllowedError"
              ? "Camera permission denied. Allow camera access or type the serial below."
              : "Could not start the camera on this device. Type or scan the serial into the field below.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, continuous, onScan, onOpenChange]);

  const submitManual = () => {
    const v = manual.trim();
    if (!v) return;
    playBeep(true);
    onScan(v);
    setManual("");
    if (!continuous) onOpenChange(false);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-lg border border-border bg-muted/40">
          {error ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <CameraOff className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Serial (handheld scanner or manual entry)</Label>
          <div className="flex gap-2">
            <Input
              autoFocus
              value={manual}
              placeholder="NP-0001"
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitManual();
                }
              }}
            />
            <Button type="button" variant="secondary" onClick={submitManual}>
              <Camera className="mr-2 h-4 w-4" /> Use
            </Button>
          </div>
        </div>

        {continuous && recent.length > 0 ? (
          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Scanned this session ({recent.length})</p>
            <ul className="max-h-28 space-y-0.5 overflow-y-auto font-mono">
              {recent.map((r, i) => (
                <li key={`${r}-${i}`}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {onDone ? (
          <Button type="button" className="w-full" onClick={onDone}>
            <Check className="mr-2 h-4 w-4" /> {doneLabel ?? "I'm done"}
            {recent.length ? ` (${recent.length})` : ""}
          </Button>
        ) : null}

      </DialogContent>
    </Dialog>
  );
}
