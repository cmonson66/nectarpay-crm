import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Plus } from "lucide-react";
import { listTasks, setTaskDone } from "@/lib/deals.functions";
import { PageSkeleton } from "@/components/crm/loading-state";
import { FollowUpModal } from "@/components/crm/modals";
import {
  Avatar,
  Chip,
  EmptyState,
  IconButton,
  PageHeader,
  RowDivider,
  StatStrip,
  btn,
  fmtDateTime,
  fmtInt,
} from "@/components/crm/kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/crm/tasks")({
  component: FollowUps,
  // Warm the cache while the route chunk loads instead of after it mounts.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery({ queryKey: ["crm-tasks"], queryFn: () => listTasks() });
  },
  head: () => ({
    meta: [
      { title: "Follow-ups | NectarPay Sales CRM" },
      {
        name: "description",
        content: "Callbacks, contingent reminders and pickups due across the sales team.",
      },
    ],
  }),
});

type TaskRow = {
  id: string;
  title: string;
  due_at: string | null;
  completed_at: string | null;
  assigned_to: string | null;
  auto_generated: boolean | null;
  type: string;
  leads: { id: string; business_name: string } | null;
};

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function FollowUps() {
  const list = useServerFn(listTasks);
  const done = useServerFn(setTaskDone);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState(false);

  const query = useQuery({ queryKey: ["crm-tasks"], queryFn: () => list() });

  const toggle = useMutation({
    mutationFn: (v: { id: string; done: boolean }) => done({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-tasks"] });
      qc.invalidateQueries({ queryKey: ["crm-home"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const repName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of query.data?.reps ?? []) map[r.user_id] = r.full_name || r.email || "Rep";
    return map;
  }, [query.data]);

  if (query.isLoading) return <PageSkeleton />;
  if (query.error)
    return <p className="text-[13px] text-red-text">{(query.error as Error).message}</p>;

  const all = (query.data?.tasks ?? []) as unknown as TaskRow[];
  const open = all.filter((t) => !t.completed_at);
  const now = Date.now();
  const eod = endOfToday();

  const overdue = open.filter((t) => t.due_at && new Date(t.due_at).getTime() < now);
  const today = open.filter(
    (t) => t.due_at && new Date(t.due_at).getTime() >= now && new Date(t.due_at).getTime() <= eod,
  );
  const later = open.filter((t) => !t.due_at || new Date(t.due_at).getTime() > eod);
  const completed = all.filter((t) => t.completed_at);

  const groups: { label: string; rows: TaskRow[]; danger?: boolean }[] = [
    { label: "Overdue", rows: overdue, danger: true },
    { label: "Today", rows: today },
    { label: "Later", rows: later },
  ];
  if (showDone) groups.push({ label: "Completed", rows: completed });

  const filterRows = (rows: TaskRow[]) => rows;

  return (
    <>
      <PageHeader
        title="Follow-ups"
        subtitle="Auto reminders from contingents, plus everything you promised to do."
        actions={
          <>
            <Chip active={showDone} onClick={() => setShowDone((s) => !s)}>
              Completed
            </Chip>
            <button type="button" className={btn.primary} onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add follow-up
            </button>
          </>
        }
      />

      <div className="flex flex-col gap-4">
        <StatStrip
          cells={[
            { label: "Overdue", value: fmtInt(overdue.length) },
            { label: "Due today", value: fmtInt(today.length) },
            { label: "Scheduled later", value: fmtInt(later.length) },
            { label: "Completed", value: fmtInt(completed.length) },
          ]}
        />

        <section className="surface overflow-hidden">
          {open.length === 0 && !showDone ? (
            <EmptyState
              title="Nothing due"
              hint="Clear board. Go knock a few doors and log what happens."
              action={
                <button type="button" className={btn.primary} onClick={() => setAdding(true)}>
                  <Plus className="h-4 w-4" /> Add follow-up
                </button>
              }
            />
          ) : (
            groups.map((g) =>
              g.rows.length === 0 ? null : (
                <div key={g.label}>
                  <RowDivider>
                    {g.label} · {g.rows.length}
                  </RowDivider>
                  {filterRows(g.rows).map((t) => {
                    const lead = t.leads;
                    return (
                      <div
                        key={t.id}
                        className={cn(
                          "flex items-center gap-3 border-b border-divider px-3.5 py-2.5 last:border-b-0",
                          g.danger && "border-l-2 border-l-red",
                          t.completed_at && "opacity-55",
                        )}
                      >
                        <button
                          type="button"
                          aria-label={t.completed_at ? "Reopen" : "Mark done"}
                          onClick={() =>
                            toggle.mutate({ id: t.id, done: !t.completed_at })
                          }
                          className={cn(
                            "grid h-6 w-6 shrink-0 place-items-center rounded-md border transition-colors max-sm:h-11 max-sm:w-11",
                            t.completed_at
                              ? "border-green/60 bg-green/20 text-green-text"
                              : "border-border bg-inset text-transparent hover:text-secondary-text",
                          )}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>

                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "truncate text-[13px] font-semibold",
                              t.completed_at && "line-through",
                            )}
                          >
                            {t.title}
                          </p>
                          <p className="flex flex-wrap items-center gap-x-2.5 text-[11.5px] text-muted-foreground">
                            {lead ? (
                              <Link
                                to="/crm/leads/$id"
                                params={{ id: lead.id }}
                                className="truncate text-secondary-text hover:text-honey-text"
                              >
                                {lead.business_name}
                              </Link>
                            ) : null}
                            {t.due_at ? (
                              <span className={cn("num", g.danger && "text-red-text")}>
                                {fmtDateTime(t.due_at)}
                              </span>
                            ) : (
                              <span>No date</span>
                            )}
                            {t.auto_generated ? <span>Auto</span> : null}
                          </p>
                        </div>

                        {t.assigned_to ? (
                          <span className="hidden items-center gap-2 sm:flex">
                            <Avatar name={repName[t.assigned_to]} size={22} />
                            <span className="max-w-[120px] truncate text-[12px] text-secondary-text">
                              {repName[t.assigned_to] ?? "Rep"}
                            </span>
                          </span>
                        ) : null}

                        {lead ? (
                          <IconButton
                            label="Open prospect"
                            onClick={() =>
                              navigate({ to: "/crm/leads/$id", params: { id: lead.id } })
                            }
                          >
                            <span className="text-[11px] font-semibold">→</span>
                          </IconButton>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ),
            )
          )}
        </section>
      </div>

      <FollowUpModal open={adding} onOpenChange={setAdding} />
    </>
  );
}
