import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, Phone, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { getDashboard } from "@/lib/dashboard.functions";
import { listPipeline } from "@/lib/crm.functions";
import { listPlacements, listTasks, setTaskDone } from "@/lib/deals.functions";
import { PageSkeleton } from "@/components/crm/loading-state";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/crm.functions";
import { STATUS_LABEL } from "@/lib/lead-status";
import {
  Avatar,
  Bar,
  Card,
  EmptyState,
  GridHead,
  GridRow,
  GridTable,
  IconButton,
  PageHeader,
  Pill,
  Segmented,
  StatStrip,
  btn,
  fmtDate,
  fmtInt,
  fmtMoney,
  fmtPct,
  fmtTime,
  attainmentTone,
} from "@/components/crm/kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/crm/")({
  component: CrmHome,
  // Warm the cache while the route chunk loads instead of after it mounts.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery({ queryKey: ["crm-home"], queryFn: () => getDashboard() });
    void context.queryClient.prefetchQuery({ queryKey: ["crm-tasks"], queryFn: () => listTasks() });
    void context.queryClient.prefetchQuery({ queryKey: ["crm-placements"], queryFn: () => listPlacements() });
    void context.queryClient.prefetchQuery({ queryKey: ["crm-pipeline"], queryFn: () => listPipeline() });
  },
  head: () => ({
    meta: [
      { title: "Today · NectarPay Sales CRM" },
      {
        name: "description",
        content:
          "Your day at a glance: follow-ups due, contingent terminals expiring, quota attainment and team activity.",
      },
      { property: "og:title", content: "Today · NectarPay Sales CRM" },
      { property: "og:description", content: "Follow-ups, contingents and quota attainment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const OPEN_STAGES = LEAD_STATUSES.filter((s) => !["won", "lost"].includes(s));

function CrmHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const dashboardFn = useServerFn(getDashboard);
  const tasksFn = useServerFn(listTasks);
  const placementsFn = useServerFn(listPlacements);
  const pipelineFn = useServerFn(listPipeline);
  const completeFn = useServerFn(setTaskDone);

  const dashboard = useQuery({ queryKey: ["crm-home"], queryFn: () => dashboardFn() });
  const tasks = useQuery({ queryKey: ["crm-tasks"], queryFn: () => tasksFn() });
  const placements = useQuery({ queryKey: ["crm-placements"], queryFn: () => placementsFn() });
  const pipeline = useQuery({ queryKey: ["crm-pipeline"], queryFn: () => pipelineFn() });

  const [scope, setScope] = useState<"mine" | "team">("mine");

  const complete = useMutation({
    mutationFn: (id: string) => completeFn({ data: { id, done: true } }),
    onSuccess: () => {
      toast.success("Follow-up completed");
      qc.invalidateQueries({ queryKey: ["crm-tasks"] });
      qc.invalidateQueries({ queryKey: ["crm-home"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not complete"),
  });

  const data = dashboard.data;
  const canSeeTeam = data ? data.role !== "rep" : false;

  const repName = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of tasks.data?.reps ?? []) map.set(r.user_id, r.full_name || r.email || "Rep");
    for (const r of placements.data?.reps ?? []) map.set(r.user_id, r.full_name || r.email || "Rep");
    return map;
  }, [tasks.data, placements.data]);

  const leadPhone = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const l of pipeline.data ?? []) map.set(l.id, l.contact_phone_e164 ?? null);
    return map;
  }, [pipeline.data]);

  /** Due today = open tasks whose due date is today or earlier. */
  const endOfDay = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, []);

  const dueRows = useMemo(() => {
    const all = (tasks.data?.tasks ?? []).filter(
      (t) => !t.completed_at && t.due_at && t.due_at <= endOfDay,
    );
    const mine = data ? all.filter((t) => t.assigned_to === data.me.rep_id) : all;
    return (scope === "mine" ? mine : all).sort((a, b) =>
      (a.due_at ?? "").localeCompare(b.due_at ?? ""),
    );
  }, [tasks.data, scope, data, endOfDay]);

  const expiring = useMemo(() => {
    const live = (placements.data?.placements ?? []).filter((p) =>
      ["active", "extended", "overdue"].includes(p.status as string),
    );
    return [...live].sort((a, b) => a.expires_at.localeCompare(b.expires_at)).slice(0, 8);
  }, [placements.data]);

  const liveTrials = (placements.data?.placements ?? []).filter((p) =>
    ["active", "extended", "overdue"].includes(p.status as string),
  );
  const expiringSoon = liveTrials.filter((p) => {
    const d = Math.ceil((new Date(p.expires_at).getTime() - Date.now()) / 86_400_000);
    return d <= 5;
  }).length;

  const stageCounts = useMemo(() => {
    const map = new Map<LeadStatus, number>();
    for (const s of LEAD_STATUSES) map.set(s, 0);
    for (const l of pipeline.data ?? []) {
      const s = l.status as LeadStatus;
      map.set(s, (map.get(s) ?? 0) + 1);
    }
    return map;
  }, [pipeline.data]);

  if (dashboard.isLoading) return <PageSkeleton />;
  if (dashboard.error)
    return <p className="text-[13px] text-red-text">{(dashboard.error as Error).message}</p>;
  if (!data) return null;

  const me = data.me;
  const avgDeal = me.sales > 0 ? me.revenue / me.sales : 0;
  const revenueTarget = avgDeal * me.sales_target;

  const pct = (v: number, t: number) => (t > 0 ? (v / t) * 100 : 0);

  const stageMax = Math.max(1, ...LEAD_STATUSES.map((s) => stageCounts.get(s) ?? 0));

  return (
    <>
      <PageHeader
        title={data.role === "admin" ? "Org board" : data.role === "manager" ? "Team board" : "Today"}
        subtitle={`Period ${fmtDate(`${data.period.period_start}T00:00:00Z`)} – ${fmtDate(
          `${data.period.period_end}T00:00:00Z`,
        )} · ${fmtInt(dueRows.length)} due today`}
        actions={
          <>
            <Link to="/crm/tasks" className={btn.secondary}>
              Log a touch
            </Link>
            <Link to="/crm/leads" search={{ new: true }} className={btn.primary}>
              New prospect
            </Link>
          </>
        }
      />

      <div className="flex flex-col gap-4">
        <StatStrip
          cells={[
            {
              label: "Touches",
              delta: `+${fmtInt(me.activity_today)} today`,
              value: fmtInt(me.touches),
              target: `/ ${fmtInt(me.touches_target)}`,
              pct: pct(me.touches, me.touches_target),
            },
            {
              label: "Sales",
              delta: `min ${fmtInt(me.sales_minimum)}`,
              value: fmtInt(me.sales),
              target: `/ ${fmtInt(me.sales_target)}`,
              pct: pct(me.sales, me.sales_target),
            },
            {
              label: "Contingents live",
              delta: expiringSoon ? `${fmtInt(expiringSoon)} expiring` : undefined,
              value: fmtInt(me.active_contingents),
              target: `/ ${fmtInt(me.contingents_target)}`,
              pct: pct(me.active_contingents, me.contingents_target),
            },
            {
              label: "Revenue booked",
              delta: avgDeal > 0 ? `avg ${fmtMoney(avgDeal)}` : undefined,
              value: fmtMoney(me.revenue, { compact: true }),
              target: revenueTarget > 0 ? `/ ${fmtMoney(revenueTarget, { compact: true })}` : undefined,
              pct: revenueTarget > 0 ? pct(me.revenue, revenueTarget) : undefined,
            },
          ]}
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <Card
            title="Due today"
            bodyClassName=""
            action={
              canSeeTeam ? (
                <Segmented
                  value={scope}
                  onChange={setScope}
                  options={[
                    { value: "mine", label: "Mine" },
                    { value: "team", label: "Team" },
                  ]}
                />
              ) : (
                <span className="num text-[11.5px] text-muted-foreground">{dueRows.length}</span>
              )
            }
          >
            {dueRows.length === 0 ? (
              <EmptyState title="Nothing due" hint="No open follow-ups scheduled for today." />
            ) : (
              <div className="flex flex-col">
                {dueRows.map((t) => {
                  const overdue = Boolean(t.due_at && t.due_at < new Date().toISOString());
                  const lead = t.leads as { id: string; business_name: string } | null;
                  const phone = lead ? leadPhone.get(lead.id) : null;
                  return (
                    <div
                      key={t.id}
                      className={cn(
                        "flex items-center gap-3 border-b border-divider px-3.5 py-2.5 last:border-b-0",
                        overdue && "border-l-2 border-l-red bg-red/8",
                      )}
                    >
                      <span
                        className={cn(
                          "num w-[44px] shrink-0 text-[12px]",
                          overdue ? "text-red-text" : "text-muted-foreground",
                        )}
                      >
                        {fmtTime(t.due_at)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{t.title}</p>
                        <p className="truncate text-[11.5px] text-muted-foreground">
                          {lead ? lead.business_name : "· internal"}
                          {t.assigned_to && scope === "team"
                            ? ` · ${repName.get(t.assigned_to) ?? "Rep"}`
                            : ""}
                          {overdue ? " · overdue" : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <IconButton
                          label="Call"
                          tone="honey"
                          disabled={!phone}
                          onClick={() => {
                            if (lead) navigate({ to: "/crm/leads/$id", params: { id: lead.id } });
                          }}
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton
                          label="Text"
                          disabled={!lead}
                          onClick={() => {
                            if (lead) navigate({ to: "/crm/leads/$id", params: { id: lead.id } });
                          }}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton
                          label="Complete"
                          tone="green"
                          onClick={() => complete.mutate(t.id)}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </IconButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card
            title="Contingents expiring"
            bodyClassName=""
            action={
              <Link to="/crm/contingents" className="text-[12px] text-honey-text hover:underline">
                All {liveTrials.length}
              </Link>
            }
          >
            {expiring.length === 0 ? (
              <EmptyState title="No live trials" hint="Place a terminal to start a trial clock." />
            ) : (
              <div className="flex flex-col">
                {expiring.map((p) => {
                  const lead = p.leads as { id: string; business_name: string } | null;
                  const days = Math.ceil(
                    (new Date(p.expires_at).getTime() - Date.now()) / 86_400_000,
                  );
                  const tone = days < 0 ? "red" : days <= 5 ? "honey" : "neutral";
                  return (
                    <Link
                      key={p.id}
                      to={lead ? "/crm/leads/$id" : "/crm/contingents"}
                      params={lead ? { id: lead.id } : undefined}
                      className="flex items-center gap-3 border-b border-divider px-3.5 py-2.5 last:border-b-0 hover:bg-chip/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">
                          {lead?.business_name ?? "Untitled"}
                        </p>
                        <p className="truncate text-[11.5px] text-muted-foreground">
                          {repName.get(p.rep_id) ?? "Rep"}
                        </p>
                      </div>
                      <Pill tone={tone}>
                        <span className="num">{days < 0 ? `${-days}d over` : `${days}d`}</span>
                      </Pill>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <Card title="Pipeline by stage" bodyClassName="p-3.5">
          <div className="flex flex-col gap-1.5">
            {OPEN_STAGES.map((s) => {
              const count = stageCounts.get(s) ?? 0;
              return (
                <Link
                  key={s}
                  to="/crm/leads"
                  search={{ status: s }}
                  className="grid grid-cols-[110px_minmax(0,1fr)_40px] items-center gap-3 rounded-lg px-1 py-1 hover:bg-chip/40"
                >
                  <span className="truncate text-[12.5px] text-secondary-text">
                    {STATUS_LABEL[s]}
                  </span>
                  <Bar pct={(count / stageMax) * 100} tone="honey" height={8} />
                  <span className="num text-right text-[12.5px]">{fmtInt(count)}</span>
                </Link>
              );
            })}
            <div className="my-1 h-px bg-border" />
            {(["won", "lost"] as LeadStatus[]).map((s) => {
              const count = stageCounts.get(s) ?? 0;
              return (
                <Link
                  key={s}
                  to="/crm/leads"
                  search={{ status: s }}
                  className="grid grid-cols-[110px_minmax(0,1fr)_40px] items-center gap-3 rounded-lg px-1 py-1 hover:bg-chip/40"
                >
                  <span
                    className={cn(
                      "truncate text-[12.5px]",
                      s === "won" ? "text-green-text" : "text-muted-foreground",
                    )}
                  >
                    {STATUS_LABEL[s]}
                  </span>
                  <Bar
                    pct={(count / stageMax) * 100}
                    tone={s === "won" ? "green" : "muted"}
                    height={8}
                  />
                  <span className="num text-right text-[12.5px]">{fmtInt(count)}</span>
                </Link>
              );
            })}
          </div>
        </Card>

        {canSeeTeam ? (
          <Card
            title={data.role === "admin" ? "All reps" : "My team"}
            bodyClassName=""
            action={
              <Link to="/crm/team" className="text-[12px] text-honey-text hover:underline">
                Team board
              </Link>
            }
          >
            <GridTable cols="" minWidth={860}>
              <GridHead cols={TEAM_COLS}>
                <span className="col-head">Rep</span>
                <span className="col-head">Touch attainment</span>
                <span className="col-head text-right">Today</span>
                <span className="col-head text-right">Sales</span>
                <span className="col-head text-right">Revenue</span>
                <span className="col-head text-right">Open</span>
              </GridHead>
              {data.rows.map((r) => {
                const attain = r.touches_target > 0 ? (r.touches / r.touches_target) * 100 : 0;
                const idle = r.activity_today === 0;
                return (
                  <GridRow
                    key={r.rep_id}
                    cols={TEAM_COLS}
                    tone={idle ? "danger" : undefined}
                    onClick={() =>
                      navigate({ to: "/crm/team/$repId", params: { repId: r.rep_id } })
                    }
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {idle ? (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red" aria-hidden />
                      ) : null}
                      <Avatar name={r.name} size={24} />
                      <span className="truncate font-medium">{r.name}</span>
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                      <Bar pct={attain} tone={attainmentTone(attain)} />
                      <span className="num shrink-0 text-[11.5px] text-muted-foreground">
                        {fmtPct(attain)}
                      </span>
                    </span>
                    <span className={cn("num text-right", idle && "text-red-text")}>
                      {fmtInt(r.activity_today)}
                    </span>
                    <span className="num text-right">{fmtInt(r.sales)}</span>
                    <span className="num text-right">{fmtMoney(r.revenue, { compact: true })}</span>
                    <span className="num text-right text-muted-foreground">
                      {fmtInt(r.open_leads)}
                    </span>
                  </GridRow>
                );
              })}
              {data.rows.length === 0 ? <EmptyState title="No reps visible yet" /> : null}
            </GridTable>
          </Card>
        ) : null}
      </div>
    </>
  );
}

const TEAM_COLS = "minmax(150px,1.6fr) minmax(140px,1.4fr) 70px 70px 100px 70px";
