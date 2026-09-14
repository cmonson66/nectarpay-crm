import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getRepDetail } from "@/lib/dashboard.functions";
import { PageSkeleton } from "@/components/crm/loading-state";

export const Route = createFileRoute("/_authenticated/crm/team/$repId")({
  beforeLoad: ({ context }) => {
    // UX guard only — getRepDetail refuses out-of-scope reps server-side.
    if (!context.canSeeTeam) throw redirect({ to: "/crm" });
  },
  component: RepDetail,
  head: () => ({
    meta: [
      { title: "Rep detail · Nectar.Pay CRM" },
      {
        name: "description",
        content: "One rep's full pipeline, activity timeline, deals and contingent placements.",
      },
      { property: "og:title", content: "Rep detail · Nectar.Pay CRM" },
      { property: "og:description", content: "Full pipeline and activity for a single rep." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-4">
      <p className="text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function RepDetail() {
  const { repId } = Route.useParams();
  const fn = useServerFn(getRepDetail);
  const { data, isLoading, error } = useQuery({
    queryKey: ["crm-rep-detail", repId],
    queryFn: () => fn({ data: { rep_id: repId } }),
  });

  if (isLoading) return <PageSkeleton />;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;
  if (!data.found)
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          This rep isn&apos;t in your scope, or doesn&apos;t exist.
        </p>
        <Link to="/crm/team" className="text-sm text-primary hover:underline">
          ← Back to team board
        </Link>
      </div>
    );

  const s = data.summary;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/crm/team" className="text-xs text-muted-foreground hover:underline">
            ← Team board
          </Link>
          <h1 className="text-2xl font-bold uppercase tracking-tight">
            {data.profile.full_name || data.profile.email}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.profile.email}
            {s?.team_name ? ` · ${s.team_name}` : ""}
            {data.profile.is_active ? "" : " · inactive"}
          </p>
        </div>
      </header>

      {s && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Touches" value={`${s.touches} / ${s.touches_target}`} />
          <Stat label="Today" value={s.activity_today} sub={`${s.calls_today} calls · ${s.emails_today} emails`} />
          <Stat label="Sales" value={`${s.sales} / ${s.sales_minimum}`} sub={money(s.revenue)} />
          <Stat label="Open leads" value={s.open_leads} />
          <Stat label="Contingents" value={`${s.active_contingents} / ${s.contingents_target}`} />
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Pipeline ({data.leads.length})
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Business</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Location</th>
                <th className="px-4 py-2">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {data.leads.map((l: any) => (
                <tr key={l.id} className="border-t border-border/40">
                  <td className="px-4 py-2">
                    <Link to="/crm/leads/$id" params={{ id: l.id }} className="hover:underline">
                      {l.business_name ?? "Untitled"}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{l.status.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {[l.city, l.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {l.last_activity_at ? new Date(l.last_activity_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
              {data.leads.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    No leads assigned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Recent activity
          </h2>
          <div className="divide-y divide-border/40 rounded-lg border border-border">
            {data.activities.map((a: any) => (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">
                    {a.type} · {a.direction}
                    {a.outcome ? ` · ${a.outcome.replace(/_/g, " ")}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.occurred_at).toLocaleString()}
                  </span>
                </div>
                {a.lead_id && (
                  <Link
                    to="/crm/leads/$id"
                    params={{ id: a.lead_id }}
                    className="text-xs text-primary hover:underline"
                  >
                    {a.lead_name ?? "lead"}
                  </Link>
                )}
                {a.notes && <p className="mt-1 text-xs text-muted-foreground">{a.notes}</p>}
              </div>
            ))}
            {data.activities.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No activity logged.
              </p>
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Deals
            </h2>
            <div className="divide-y divide-border/40 rounded-lg border border-border">
              {data.deals.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <Link to="/crm/leads/$id" params={{ id: d.lead_id }} className="hover:underline">
                    {d.lead_name ?? "lead"}
                  </Link>
                  <span className="text-muted-foreground">
                    {d.status} · {money(Number(d.total_amount ?? 0))}
                  </span>
                </div>
              ))}
              {data.deals.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">No deals.</p>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Contingents
            </h2>
            <div className="divide-y divide-border/40 rounded-lg border border-border">
              {data.placements.map((p: any) => {
                const days = Math.ceil(
                  (new Date(p.expires_at).getTime() - Date.now()) / 86_400_000,
                );
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <Link to="/crm/leads/$id" params={{ id: p.lead_id }} className="hover:underline">
                      {p.lead_name ?? "lead"}
                    </Link>
                    <span
                      className={
                        p.status === "overdue" ? "text-destructive" : "text-muted-foreground"
                      }
                    >
                      {p.status} · {days >= 0 ? `${days}d left` : `${Math.abs(days)}d over`}
                    </span>
                  </div>
                );
              })}
              {data.placements.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No placements.
                </p>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Open tasks
            </h2>
            <div className="divide-y divide-border/40 rounded-lg border border-border">
              {data.tasks.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="truncate">{t.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.due_at ? new Date(t.due_at).toLocaleDateString() : "—"}
                  </span>
                </div>
              ))}
              {data.tasks.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nothing outstanding.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
