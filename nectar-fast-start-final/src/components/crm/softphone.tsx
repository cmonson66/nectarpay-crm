// In-browser softphone. Registers the Twilio Voice SDK once for the signed-in
// rep, exposes a `useSoftphone().call(number, lead)` hook, and renders the
// floating call bar plus incoming-call ringer.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Call, Device } from "@twilio/voice-sdk";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Mic, MicOff, Phone, PhoneOff, PhoneIncoming, Loader2 } from "lucide-react";
import { getVoiceToken, lookupLeadByPhone } from "@/lib/comms.functions";
import { formatPhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";

type CallState = "idle" | "connecting" | "ringing-in" | "active";

interface ActiveLead {
  id: string;
  label: string;
}

interface SoftphoneApi {
  ready: boolean;
  state: CallState;
  call: (number: string, lead?: ActiveLead) => void;
  unavailableReason: string | null;
}

const SoftphoneContext = createContext<SoftphoneApi>({
  ready: false,
  state: "idle",
  call: () => {},
  unavailableReason: "Softphone not mounted",
});

export function useSoftphone() {
  return useContext(SoftphoneContext);
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SoftphoneProvider({ children }: { children: React.ReactNode }) {
  const tokenFn = useServerFn(getVoiceToken);
  const lookupFn = useServerFn(lookupLeadByPhone);
  const qc = useQueryClient();

  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const [ready, setReady] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const [state, setState] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [peer, setPeer] = useState<string>("");
  const [lead, setLead] = useState<ActiveLead | null>(null);

  // Register the device once, and keep the token fresh. Registration is deferred
  // until the browser is idle so it never competes with the page's own data.
  useEffect(() => {
    let cancelled = false;
    let device: Device | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const start = async () => {
      try {
        const { Device: DeviceCtor } = await import("@twilio/voice-sdk");
        const grant = await tokenFn();
        if (cancelled) return;


        device = new DeviceCtor(grant.token, {
          codecPreferences: ["opus", "pcmu"] as never,
          logLevel: "error" as never,
        });

        device.on("registered", () => setReady(true));
        device.on("error", (e: { message?: string }) => {
          setUnavailableReason(e?.message ?? "Voice device error");
        });
        device.on("tokenWillExpire", async () => {
          try {
            const refreshed = await tokenFn();
            device?.updateToken(refreshed.token);
          } catch {
            /* keep the current token; the next call will surface the error */
          }
        });
        device.on("incoming", async (incoming: Call) => {
          callRef.current = incoming;
          const from = incoming.parameters.From ?? "";
          setPeer(from);
          setState("ringing-in");
          try {
            const match = await lookupFn({ data: { phone: from } });
            if (match) {
              setLead({
                id: match.id,
                label: match.business_name || match.contact_name || formatPhone(from),
              });
            } else {
              setLead(null);
            }
          } catch {
            setLead(null);
          }
          wireCall(incoming);
        });

        await device.register();
        deviceRef.current = device;
      } catch (e) {
        if (!cancelled) setUnavailableReason((e as Error).message);
      }
    };

    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
      .requestIdleCallback;
    if (ric) ric(() => void start(), { timeout: 4000 });
    else timer = setTimeout(() => void start(), 1500);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      device?.destroy();
      deviceRef.current = null;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Call timer
  useEffect(() => {
    if (state !== "active") return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  const teardown = useCallback(() => {
    callRef.current = null;
    setState("idle");
    setMuted(false);
    setSeconds(0);
    setPeer("");
    setLead(null);
    qc.invalidateQueries({ queryKey: ["lead-comms"] });
    qc.invalidateQueries({ queryKey: ["crm-lead"] });
  }, [qc]);

  const wireCall = useCallback(
    (c: Call) => {
      c.on("accept", () => {
        setSeconds(0);
        setState("active");
      });
      c.on("disconnect", teardown);
      c.on("cancel", teardown);
      c.on("reject", teardown);
      c.on("error", (e: { message?: string }) => {
        toast.error(e?.message ?? "Call failed");
        teardown();
      });
    },
    [teardown],
  );

  const call = useCallback(
    async (number: string, forLead?: ActiveLead) => {
      const device = deviceRef.current;
      if (!device) {
        toast.error(unavailableReason ?? "Softphone is still connecting.");
        return;
      }
      if (state !== "idle") {
        toast.error("You're already on a call.");
        return;
      }
      try {
        setPeer(number);
        setLead(forLead ?? null);
        setState("connecting");
        const outgoing = await device.connect({ params: { To: number } });
        callRef.current = outgoing;
        wireCall(outgoing);
      } catch (e) {
        toast.error((e as Error).message);
        teardown();
      }
    },
    [state, teardown, unavailableReason, wireCall],
  );

  const hangUp = () => {
    const c = callRef.current;
    if (!c) return teardown();
    if (state === "ringing-in") c.reject();
    else c.disconnect();
    teardown();
  };

  const answer = () => {
    callRef.current?.accept();
  };

  const toggleMute = () => {
    const c = callRef.current;
    if (!c) return;
    const next = !muted;
    c.mute(next);
    setMuted(next);
  };

  const api = useMemo<SoftphoneApi>(
    () => ({ ready, state, call, unavailableReason }),
    [ready, state, call, unavailableReason],
  );

  return (
    <SoftphoneContext.Provider value={api}>
      {children}
      {state !== "idle" ? (
        <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-xl border border-border bg-card p-3 shadow-lg sm:inset-x-auto sm:right-4 sm:w-96">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                state === "ringing-in" ? "bg-primary/20 text-primary" : "bg-muted"
              }`}
            >
              {state === "connecting" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : state === "ringing-in" ? (
                <PhoneIncoming className="h-4 w-4 animate-pulse" />
              ) : (
                <Phone className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {lead ? (
                  <Link to="/crm/leads/$id" params={{ id: lead.id }} className="hover:underline">
                    {lead.label}
                  </Link>
                ) : (
                  formatPhone(peer) || peer || "Unknown caller"
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {state === "connecting"
                  ? "Connecting…"
                  : state === "ringing-in"
                    ? "Incoming call"
                    : `On call · ${formatDuration(seconds)}`}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {state === "ringing-in" ? (
                <Button size="sm" onClick={answer}>
                  <Phone className="mr-1 h-4 w-4" /> Answer
                </Button>
              ) : (
                <Button size="icon" variant="secondary" onClick={toggleMute} title="Mute">
                  {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}
              <Button size="icon" variant="destructive" onClick={hangUp} title="Hang up">
                <PhoneOff className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </SoftphoneContext.Provider>
  );
}
