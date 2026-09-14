import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getAdminOverview } from "@/lib/admin.functions";
import { PageSkeleton } from "@/components/crm/loading-state";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
  head: () => ({
    meta: [
      { title: "Sales Overview · Nectar.Pay CRM" },
      {
        name: "description",
        content: "Pipeline snapshot for the Nectar.Pay sales team: leads, won deals, live terminal trials and the latest rep activity.",
      },
    ],
  }),
});

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-5">
      <p className="text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function AdminOverview() {
  const fn = useServerFn(getAdminOverview);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fn(),
  });

  if (isLoading) return <PageSkeleton />;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold uppercase tracking-tight">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Leads" value={data.lead_count} />
        <Stat label="Deals won" value={data.won_deal_count} />
        <Stat label="Live trials" value={data.active_placement_count} />
        <Stat label="Team members" value={data.user_count} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Recent activity
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Business</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_activities.map((a) => (
                <tr key={a.id} className="border-t border-border/40">
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(a.occurred_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      to="/crm/leads/$id"
                      params={{ id: a.lead_id }}
                      className="hover:underline"
                    >
                      {a.business_name ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{a.type}</td>
                  <td className="px-4 py-2 text-muted-foreground">{a.outcome ?? "—"}</td>
                </tr>
              ))}
              {data.recent_activities.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    No activity logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
