import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/crm/loading-state";
import {
  getCommissionReport,
  upsertCommissionRule,
  upsertQuota,
} from "@/lib/commissions.functions";

export const Route = createFileRoute("/_authenticated/admin/commissions")({
  component: CommissionConfig,
  head: () => ({
    meta: [
      { title: "Commission rules & quotas · Nectar.Pay Admin" },
      {
        name: "description",
        content:
          "Configure commission rates per role and set per-rep quota targets for the current period.",
      },
      { property: "og:title", content: "Commission rules & quotas · Nectar.Pay Admin" },
      { property: "og:description", content: "Commission rates and per-rep quota targets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function CommissionConfig() {
  const qc = useQueryClient();
  const report = useServerFn(getCommissionReport);
  const saveRule = useServerFn(upsertCommissionRule);
  const saveQuota = useServerFn(upsertQuota);

  const { data, isLoading, error } = useQuery({
    queryKey: ["commission-config"],
    queryFn: () => report({ data: {} }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["commission-config"] });

  const ruleMut = useMutation({
    mutationFn: (v: {
      id: string;
      role_in_deal: "rep" | "manager_override" | "gm_override";
      rate_type: "flat" | "percent";
      rate_value: number;
      applies_to: "hardware" | "subscription" | "total";
    }) => saveRule({ data: v }),
    onSuccess: () => {
      toast.success("Rule saved");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const quotaMut = useMutation({
    mutationFn: (v: {
      rep_id: string;
      period_id: string;
      touches_target: number;
      sales_minimum: number;
      sales_target: number;
      contingents_target: number;
    }) => saveQuota({ data: v }),
    onSuccess: () => {
      toast.success("Quota saved");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <PageSkeleton />;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">No quota periods yet.</p>;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold uppercase tracking-tight">Commission rules & quotas</h1>
        <p className="text-sm text-muted-foreground">
          Configuration only — the rep-facing statement lives in the CRM under Commissions.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Rules
        </h2>
        <div className="space-y-2">
          {data.rules.map((r) => (
            <form
              key={r.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                ruleMut.mutate({
                  id: r.id,
                  role_in_deal: r.role_in_deal as "rep" | "manager_override" | "gm_override",
                  rate_type: String(f.get("rate_type")) as "flat" | "percent",
                  rate_value: Number(f.get("rate_value")),
                  applies_to: String(f.get("applies_to")) as "hardware" | "subscription" | "total",
                });
              }}
            >
              <span className="w-40 text-sm">{r.role_in_deal.replace(/_/g, " ")}</span>
              <select
                name="rate_type"
                defaultValue={r.rate_type}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="percent">percent</option>
                <option value="flat">flat</option>
              </select>
              <input
                name="rate_value"
                type="number"
                step="0.01"
                min="0"
                defaultValue={Number(r.rate_value)}
                className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
              <select
                name="applies_to"
                defaultValue={r.applies_to}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="total">total</option>
                <option value="hardware">hardware</option>
                <option value="subscription">subscription</option>
              </select>
              <Button size="sm" variant="outline" type="submit" disabled={ruleMut.isPending}>
                Save
              </Button>
            </form>
          ))}
          {data.rules.length === 0 && (
            <p className="rounded-lg border border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No commission rules configured.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          {data.period
            ? `Quotas · period ${new Date(`${data.period.period_start}T00:00:00`).toLocaleDateString()} – ${new Date(`${data.period.period_end}T00:00:00`).toLocaleDateString()}`
            : "Quotas · no quota period configured yet"}
        </h2>
        <div className="space-y-2">
          {!data.period && (
            <p className="rounded-lg border border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Create a quota period before setting targets.
            </p>
          )}
          {data.period && data.rows.map((r) => (
            <form
              key={r.rep_id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!data.period) return;
                const f = new FormData(e.currentTarget);
                quotaMut.mutate({
                  rep_id: r.rep_id,
                  period_id: data.period.id,
                  touches_target: Number(f.get("touches_target")),
                  sales_minimum: Number(f.get("sales_minimum")),
                  sales_target: Number(f.get("sales_target")),
                  contingents_target: Number(f.get("contingents_target")),
                });
              }}
            >
              <span className="w-48 truncate text-sm">{r.name}</span>
              {[
                { name: "touches_target", label: "touches", value: r.touches_target },
                { name: "sales_minimum", label: "sales min", value: r.sales_minimum },
                { name: "sales_target", label: "sales goal", value: r.sales_target },
                { name: "contingents_target", label: "contingents", value: r.contingents_target },
              ].map((f) => (
                <label key={f.name} className="flex items-center gap-1 text-xs text-muted-foreground">
                  {f.label}
                  <input
                    name={f.name}
                    type="number"
                    min="0"
                    defaultValue={f.value}
                    className="w-20 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                </label>
              ))}
              <Button size="sm" variant="outline" type="submit" disabled={quotaMut.isPending}>
                Save
              </Button>
            </form>
          ))}
          {data.rows.length === 0 && (
            <p className="rounded-lg border border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No reps yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
