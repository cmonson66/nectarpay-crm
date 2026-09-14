/**
 * Chronological conversation for one prospect: texts, calls and logged
 * touches in a single stream, with a composer that can send a text,
 * record a visit/call note, or write an internal note.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarPlus,
  MessageSquare,
  NotebookPen,
  PhoneIncoming,
  PhoneOutgoing,
  Send,
  StickyNote,
} from "lucide-react";
import { getLeadComms, sendLeadSms } from "@/lib/comms.functions";
import { listLeadDeals } from "@/lib/deals.functions";
import { ACTIVITY_OUTCOMES, ACTIVITY_TYPES, logActivity } from "@/lib/crm.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { Chip, EmptyState, btn, fieldCls, fmtDateTime, fmtMoney } from "@/components/crm/kit";
import { cn } from "@/lib/utils";

export const OUTCOME_LABEL: Record<string, string> = {
  connected: "Connected",
  no_answer: "No answer",
  gatekeeper: "Gatekeeper",
  pitched: "Pitched",
  objection: "Objection",
  not_interested: "Not interested",
};

const TOUCH_TYPES = ACTIVITY_TYPES.filter((t) => t !== "sms" && t !== "note");

type ActivityRow = {
  id: string;
  type: string;
  direction: string | null;
  outcome: string | null;
  notes: string | null;
  occurred_at: string;
  rep_id: string;
  duration_seconds?: number | null;
};

type Entry = {
  key: string;
  at: string;
  kind: "text-out" | "text-in" | "call-in" | "call-out" | "touch" | "note" | "event";
  tone?: "honey" | "green" | "red" | "neutral";
  title: string;
  body?: string | null;
  meta?: string;
};

export function ProspectConversation({
  leadId,
  phone,
  optedOut,
  activities,
  repName,
  contactName,
  embedded,
  onNewTask,
  touchSignal,
}: {
  leadId: string;
  phone: string | null;
  optedOut: boolean;
  activities: ActivityRow[];
  repName: Record<string, string>;
  contactName?: string | null;
  embedded?: boolean;
  onNewTask?: () => void;
  touchSignal?: number;
}) {
  const qc = useQueryClient();
  const fetchComms = useServerFn(getLeadComms);
  const send = useServerFn(sendLeadSms);
  const log = useServerFn(logActivity);
  const listDeals = useServerFn(listLeadDeals);

  const [mode, setMode] = useState<"text" | "touch" | "internal">("text");
  const [body, setBody] = useState("");
  const [touchType, setTouchType] = useState<string>("call");
  const [outcome, setOutcome] = useState<string>("connected");

  useEffect(() => {
    if (touchSignal) setMode("touch");
  }, [touchSignal]);

  const comms = useQuery({
    queryKey: ["lead-comms", leadId],
    queryFn: () => fetchComms({ data: { leadId } }),
  });

  // Deal milestones (pending sale, contract signed, payment confirmed, trials)
  // are woven into the same stream.
  const dealsQuery = useQuery({
    queryKey: ["lead-deals", leadId],
    queryFn: () => listDeals({ data: { lead_id: leadId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["lead-comms", leadId] });
    qc.invalidateQueries({ queryKey: ["crm-lead", leadId] });
    qc.invalidateQueries({ queryKey: ["crm-pipeline"] });
    qc.invalidateQueries({ queryKey: ["crm-rollup"] });
    qc.invalidateQueries({ queryKey: ["crm-team-board"] });
    qc.invalidateQueries({ queryKey: ["crm-home"] });
    qc.invalidateQueries({ queryKey: ["crm-rep"] });
  };

  const sendText = useMutation({
    mutationFn: () => send({ data: { leadId, body } }),
    onSuccess: () => {
      setBody("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addTouch = useMutation({
    mutationFn: () =>
      log({
        data: {
          lead_id: leadId,
          type: (mode === "internal" ? "note" : touchType) as (typeof ACTIVITY_TYPES)[number],
          direction: "outbound" as const,
          outcome:
            mode === "internal" ? null : (outcome as (typeof ACTIVITY_OUTCOMES)[number]),
          notes: body,
        },
      }),
    onSuccess: () => {
      setBody("");
      toast.success(mode === "internal" ? "Note saved" : "Touch logged");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    for (const m of comms.data?.messages ?? []) {
      out.push({
        key: `m${m.id}`,
        at: m.created_at,
        kind: m.direction === "outbound" ? "text-out" : "text-in",
        title: m.direction === "outbound" ? "Text sent" : "Text received",
        body: m.body,
        meta: [m.status, m.error].filter(Boolean).join(" · "),
      });
    }
    for (const c of comms.data?.calls ?? []) {
      out.push({
        key: `c${c.id}`,
        at: c.created_at,
        kind: c.direction === "inbound" ? "call-in" : "call-out",
        title: c.direction === "inbound" ? "Inbound call" : "Outbound call",
        meta: [c.status, c.duration_seconds ? `${c.duration_seconds}s` : null]
          .filter(Boolean)
          .join(" · "),
      });
    }
    for (const a of activities) {
      if (a.type === "sms") continue;
      out.push({
        key: `a${a.id}`,
        at: a.occurred_at,
        kind: a.type === "note" ? "note" : "touch",
        title:
          a.type === "note"
            ? "Internal note"
            : `${a.type[0]?.toUpperCase()}${a.type.slice(1)}${
                a.outcome ? ` · ${OUTCOME_LABEL[a.outcome] ?? a.outcome}` : ""
              }`,
        body: a.notes,
        meta: repName[a.rep_id] ?? "Rep",
      });
    }
    for (const d of dealsQuery.data?.deals ?? []) {
      const label = d.type === "contingent" ? "Contingent trial" : "Sale";
      out.push({
        key: `d${d.id}-created`,
        at: d.created_at,
        kind: "event",
        tone: "honey",
        title:
          d.type === "contingent" ? "Trial started" : "Pending sale started",
        meta: `${label} · ${fmtMoney(Number(d.total_amount ?? 0))}`,
      });
      if (d.contract_signed_at) {
        out.push({
          key: `d${d.id}-signed`,
          at: d.contract_signed_at,
          kind: "event",
          tone: "honey",
          title: "Contract signed",
          meta: d.contract_signer_name ?? undefined,
        });
      }
      if (d.paid_at) {
        out.push({
          key: `d${d.id}-paid`,
          at: d.paid_at,
          kind: "event",
          tone: "green",
          title: "Payment confirmed — sale finalized",
          meta: `${fmtMoney(Number(d.total_amount ?? 0))}${d.payment_method ? ` · ${d.payment_method}` : ""}`,
        });
      }
      if (d.status === "lost") {
        out.push({
          key: `d${d.id}-lost`,
          at: d.closed_at ?? d.created_at,
          kind: "event",
          tone: "red",
          title: "Deal lost",
        });
      }
    }

    for (const p of dealsQuery.data?.placements ?? []) {
      if (p.picked_up_at) {
        out.push({
          key: `p${p.id}-pickup`,
          at: p.picked_up_at,
          kind: "event",
          tone: "neutral",
          title: "Terminal picked up",
        });
      }
      if (p.status === "converted") {
        out.push({
          key: `p${p.id}-conv`,
          at: p.expires_at,
          kind: "event",
          tone: "green",
          title: "Trial converted",
        });
      }
    }

    const ts = (v: string | null | undefined) => {
      const t = v ? new Date(v).getTime() : NaN;
      return Number.isFinite(t) ? t : 0;
    };
    return out
      .filter((e) => ts(e.at) > 0)
      .sort((x, y) => ts(x.at) - ts(y.at));
  }, [comms.data, activities, repName, dealsQuery.data]);

  const streamRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  const busy = sendText.isPending || addTouch.isPending;
  const canSubmit =
    body.trim().length > 0 && (mode !== "text" || (Boolean(phone) && !optedOut)) && !busy;

  const stream = (
    <div
      ref={streamRef}
      className="flex flex-1 flex-col gap-4 p-4 max-md:overflow-visible md:overflow-y-auto sm:p-5"
    >
      {comms.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : entries.length === 0 ? (
        <EmptyState
          title="Nothing logged yet"
          hint="Send a text, place a call, or write down what happened on your visit."
        />
      ) : (
        entries.map((e) => <EntryRow key={e.key} entry={e} />)
      )}
    </div>
  );

  const composer = (
    <footer className="border-t border-border bg-inset/60 p-3 max-md:sticky max-md:bottom-0 max-md:z-20 max-md:bg-inset [&_button]:max-md:min-h-11">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Chip active={mode === "text"} onClick={() => setMode("text")}>
          <span className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> Text
          </span>
        </Chip>
        <Chip active={mode === "touch"} onClick={() => setMode("touch")}>
          <span className="flex items-center gap-1.5">
            <NotebookPen className="h-3.5 w-3.5" /> Log a touch
          </span>
        </Chip>
        <Chip active={mode === "internal"} onClick={() => setMode("internal")}>
          <span className="flex items-center gap-1.5">
            <StickyNote className="h-3.5 w-3.5" /> Internal note
          </span>
        </Chip>

        {mode === "touch" ? (
          <>
            <select
              className={cn(fieldCls, "h-8 w-auto max-sm:h-11")}
              value={touchType}
              onChange={(e) => setTouchType(e.target.value)}
            >
              {TOUCH_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t[0]?.toUpperCase()}
                  {t.slice(1)}
                </option>
              ))}
            </select>
            <select
              className={cn(fieldCls, "h-8 w-auto max-sm:h-11")}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            >
              {ACTIVITY_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {OUTCOME_LABEL[o]}
                </option>
              ))}
            </select>
          </>
        ) : null}

        {onNewTask ? (
          <button type="button" className={cn(btn.secondary, "ml-auto")} onClick={onNewTask}>
            <CalendarPlus className="h-4 w-4" /> Task
          </button>
        ) : null}
      </div>

      {mode === "text" && optedOut ? (
        <p className="rounded-lg bg-red/12 px-3 py-2 text-[12.5px] text-red-text">
          This contact replied STOP. Texting is off.
        </p>
      ) : (
        <div className="flex items-end gap-2">
          <textarea
            rows={2}
            className="min-h-[44px] w-full resize-y rounded-lg border border-border bg-background px-2.5 py-2 text-[13px] outline-none placeholder:text-faint focus:border-honey/50"
            placeholder={
              mode === "text"
                ? phone
                  ? `Write a text${contactName ? ` to ${contactName.split(" ")[0]}` : ""}…`
                  : "Add a phone number first"
                : mode === "internal"
                  ? "Internal note — the customer never sees this…"
                  : "What happened?"
            }
            disabled={mode === "text" && !phone}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && canSubmit) {
                e.preventDefault();
                if (mode === "text") sendText.mutate();
                else addTouch.mutate();
              }
            }}
          />
          <button
            type="button"
            className={btn.primary}
            disabled={!canSubmit}
            onClick={() => (mode === "text" ? sendText.mutate() : addTouch.mutate())}
          >
            {mode === "text" ? <Send className="h-4 w-4" /> : <StickyNote className="h-4 w-4" />}
            {busy ? "Saving…" : mode === "text" ? "Send" : mode === "internal" ? "Submit" : "Log"}
          </button>
        </div>
      )}
    </footer>
  );

  if (embedded) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {stream}
        {composer}
      </div>
    );
  }

  return (
    <section className="surface flex min-h-[420px] flex-col overflow-hidden">
      <header className="flex min-h-[44px] items-center justify-between gap-3 border-b border-border px-3.5 py-2">
        <h2 className="sec-title">Conversation</h2>
        <span className="num text-[11.5px] text-muted-foreground">{entries.length}</span>
      </header>
      <div className="flex max-h-[54vh] min-h-0 flex-1 flex-col">{stream}</div>
      {composer}
    </section>
  );
}

function EntryRow({ entry }: { entry: Entry }) {
  if (entry.kind === "text-out" || entry.kind === "text-in") {
    const out = entry.kind === "text-out";
    return (
      <div className={cn("flex", out ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "max-w-[76%] rounded-2xl px-4 py-3",
            out ? "bg-chip/80 text-foreground" : "bg-inset text-foreground",
          )}
        >
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{entry.body}</p>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            {fmtDateTime(entry.at)}
            {entry.meta ? ` · ${entry.meta}` : ""}
          </p>
        </div>
      </div>
    );
  }

  if (entry.kind === "event") {
    const tone =
      entry.tone === "green"
        ? "text-green-text"
        : entry.tone === "red"
          ? "text-red-text"
          : entry.tone === "neutral"
            ? "text-secondary-text"
            : "text-honey-text";
    return (
      <div className="py-1.5 text-center">
        <span className="text-[11px] text-muted-foreground">
          <span className={cn("font-medium", tone)}>{entry.title}</span>
          {entry.meta ? ` · ${entry.meta}` : ""} · {fmtDateTime(entry.at)}
        </span>
      </div>
    );
  }

  if (entry.kind === "note") {
    return (
      <div className="rounded-xl border border-honey/35 border-l-[3px] border-l-honey bg-honey/[0.06] px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex items-center gap-2 text-[15px] font-semibold text-honey-text">
            <StickyNote className="h-4 w-4" /> Internal note
          </span>
          <span className="shrink-0 text-[12.5px] text-muted-foreground">
            {fmtDateTime(entry.at)}
            {entry.meta ? ` · ${entry.meta}` : ""}
          </span>
        </div>
        {entry.body ? (
          <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] italic leading-relaxed text-secondary-text">
            {entry.body}
          </p>
        ) : null}
      </div>
    );
  }

  const Icon =
    entry.kind === "call-in" ? PhoneIncoming : entry.kind === "call-out" ? PhoneOutgoing : NotebookPen;

  return (
    <div className="flex gap-3.5 rounded-xl border border-border bg-transparent px-4 py-3.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-chip text-secondary-text">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[16px] font-semibold leading-tight">{entry.title}</span>
          <span className="text-[12.5px] text-muted-foreground">
            {fmtDateTime(entry.at)}
            {entry.meta ? ` · ${entry.meta}` : ""}
          </span>
        </div>
        {entry.body ? (
          <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-secondary-text">
            {entry.body}
          </p>
        ) : null}
      </div>
    </div>
  );
}
