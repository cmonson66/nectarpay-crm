// SMS thread + calling controls for a single lead.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone, PhoneForwarded, Send } from "lucide-react";
import { getLeadComms, sendLeadSms, startBridgedCall } from "@/lib/comms.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useSoftphone } from "@/components/crm/softphone";
import { formatPhone } from "@/lib/phone";

export function LeadCommsPanel({
  leadId,
  phone,
  optedOut,
  leadName,
}: {
  leadId: string;
  phone: string | null;
  optedOut: boolean;
  leadName?: string | null;
}) {
  const qc = useQueryClient();
  const fetchComms = useServerFn(getLeadComms);
  const send = useServerFn(sendLeadSms);
  const call = useServerFn(startBridgedCall);
  const softphone = useSoftphone();
  const [body, setBody] = useState("");


  const query = useQuery({
    queryKey: ["lead-comms", leadId],
    queryFn: () => fetchComms({ data: { leadId } }),
  });

  const sendMut = useMutation({
    mutationFn: () => send({ data: { leadId, body } }),
    onSuccess: () => {
      setBody("");
      toast.success("Message sent");
      qc.invalidateQueries({ queryKey: ["lead-comms", leadId] });
      qc.invalidateQueries({ queryKey: ["crm-lead", leadId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const callMut = useMutation({
    mutationFn: () => call({ data: { leadId } }),
    onSuccess: (r) => toast.success(`Calling you at ${r.repNumber} — answer to connect.`),
    onError: (e: Error) => toast.error(e.message),
  });

  const messages = query.data?.messages ?? [];
  const calls = query.data?.calls ?? [];

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Messages &amp; calls</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!phone || softphone.state !== "idle"}
            onClick={() =>
              phone &&
              softphone.call(phone, { id: leadId, label: leadName || formatPhone(phone) })
            }
            title={softphone.ready ? "Call from your browser" : "Softphone connecting…"}
          >
            <Phone className="mr-2 h-4 w-4" />
            {softphone.state === "idle" ? "Call" : "On call"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!phone || callMut.isPending}
            onClick={() => callMut.mutate()}
            title="Ring my cell phone, then connect the lead"
          >
            <PhoneForwarded className="mr-2 h-4 w-4" />
            {callMut.isPending ? "Connecting…" : "Call my cell"}
          </Button>
        </div>
      </div>


      {query.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : messages.length === 0 ? (
        <p className="text-xs text-muted-foreground">No texts yet.</p>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  m.direction === "outbound"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className="mt-1 text-[10px] opacity-70">
                  {new Date(m.created_at).toLocaleString()} · {m.status}
                  {m.error ? ` · ${m.error}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {optedOut ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          This contact replied STOP. Texting is disabled.
        </p>
      ) : (
        <div className="space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={phone ? "Write a text…" : "Add a phone number first"}
            rows={2}
            disabled={!phone}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!phone || !body.trim() || sendMut.isPending}
              onClick={() => sendMut.mutate()}
            >
              <Send className="mr-2 h-4 w-4" />
              {sendMut.isPending ? "Sending…" : "Send text"}
            </Button>
          </div>
        </div>
      )}

      {calls.length > 0 ? (
        <div className="space-y-1 border-t border-border/60 pt-2">
          {calls.slice(0, 5).map((c) => (
            <p key={c.id} className="text-xs text-muted-foreground">
              {new Date(c.created_at).toLocaleString()} · {c.direction} · {c.status}
              {c.duration_seconds ? ` · ${c.duration_seconds}s` : ""}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
