/** Compact sales summary for one prospect: deals and contingent trials. */
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listLeadDeals, type DealStatus } from "@/lib/deals.functions";
import { DEAL_STATUS_LABEL } from "@/components/crm/lead-deals-panel";
import { Card, Pill, btn, daysBetween, fmtDate, fmtMoney } from "@/components/crm/kit";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<DealStatus, "neutral" | "honey" | "green" | "red" | "blue"> = {
  open: "blue",
  pending: "honey",
  won: "green",
  lost: "neutral",
  converted: "green",
  returned: "neutral",
};

export function LeadSalesCard({
  leadId,
  onAdd,
  limit,
  onViewAll,
  compact = false,
}: {
  leadId: string;
  onAdd?: () => void;
  limit?: number;
  onViewAll?: () => void;
  compact?: boolean;
}) {
  const list = useServerFn(listLeadDeals);
  const query = useQuery({
    queryKey: ["lead-deals", leadId],
    queryFn: () => list({ data: { lead_id: leadId } }),
  });

  const allDeals = query.data?.deals ?? [];
  const placements = query.data?.placements ?? [];
  const deals = limit ? allDeals.slice(0, limit) : allDeals;
  const hidden = allDeals.length - deals.length;

  return (
    <Card
      title="Sales"
      action={
        onAdd ? (
          <button type="button" className={cn(btn.secondary, "h-7 px-2")} onClick={onAdd}>
            Add
          </button>
        ) : null
      }
      bodyClassName="p-0"
    >
      {query.isLoading ? (
        <p className="px-3.5 py-3 text-[12.5px] text-muted-foreground">Loading…</p>
      ) : deals.length === 0 && placements.length === 0 ? (
        <p className="px-3.5 py-3 text-[12.5px] text-muted-foreground">No sales yet.</p>
      ) : (
        <>
          {compact ? (
            <div className="divide-y divide-divider overflow-hidden rounded-xl border border-border">
              {deals.map((d) => {
                const status = d.status as DealStatus;
                const placement = placements.find((p) => p.deal_id === d.id);
                const left = placement ? daysBetween(placement.expires_at) : null;
                return (
                  <div key={d.id} className="min-w-0 px-3 py-2.5">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold">
                          {d.type === "contingent" ? "Contingent" : "Sale"}
                        </p>
                        <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                          {fmtDate(d.created_at)} · {fmtMoney(Number(d.hardware_amount ?? 0))} base +{" "}
                          {fmtMoney(Number(d.subscription_monthly ?? 0))}/mo
                        </p>
                      </div>
                      <p className="num shrink-0 text-[13px] font-semibold">
                        {fmtMoney(Number(d.total_amount ?? 0))}
                      </p>
                    </div>
                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
                      <Pill tone={STATUS_TONE[status]}>{DEAL_STATUS_LABEL[status]}</Pill>
                      {d.type === "contingent" ? (
                        <Pill tone="honey">TRIAL</Pill>
                      ) : d.payment_method ? (
                        <Pill tone="neutral">{d.payment_method}</Pill>
                      ) : null}
                      {left !== null && placement?.status === "active" ? (
                        <Pill tone={left <= 3 ? "red" : "honey"}>
                          {left <= 0 ? "EXPIRED" : `${left}d left`}
                        </Pill>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
          <div className="min-w-0 overflow-x-auto rounded-xl border border-border">
            <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.8fr)_auto_auto] items-center gap-x-3 border-b border-border bg-inset/60 px-3 py-2 max-sm:grid-cols-[minmax(0,1fr)_auto]">
              <span className="card-label">Type</span>
              <span className="card-label max-sm:hidden">Total</span>
              <span className="card-label max-sm:hidden">Terms</span>
              <span className="card-label max-sm:hidden">Date</span>
              <span className="card-label max-sm:hidden">Status</span>
              <span className="card-label text-right">Trial</span>
            </div>

            {deals.map((d) => {
              const status = d.status as DealStatus;
              const placement = placements.find((p) => p.deal_id === d.id);
              const left = placement ? daysBetween(placement.expires_at) : null;
              return (
                <div
                  key={d.id}
                  className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.8fr)_auto_auto] items-center gap-x-3 border-b border-divider px-3 py-2.5 last:border-b-0 max-sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">
                      {d.type === "contingent" ? "Contingent" : "Sale"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1 max-sm:hidden">
                      {d.type === "contingent" ? (
                        <Pill tone="honey">TRIAL</Pill>
                      ) : d.payment_method ? (
                        <Pill tone="neutral">{d.payment_method}</Pill>
                      ) : null}
                    </div>
                  </div>
                  <p className="num min-w-0 truncate text-[13px] font-semibold max-sm:hidden">
                    {fmtMoney(Number(d.total_amount ?? 0))}
                  </p>
                  <p className="num min-w-0 truncate text-[12.5px] text-secondary-text max-sm:hidden">
                    {fmtMoney(Number(d.hardware_amount ?? 0))} + {fmtMoney(Number(d.subscription_monthly ?? 0))} ×{" "}
                    {d.subscription_months}
                  </p>
                  <p className="num min-w-0 truncate text-[12.5px] text-secondary-text max-sm:hidden">
                    {fmtDate(d.created_at)}
                  </p>
                  <div className="min-w-0 max-sm:hidden">
                    <Pill tone={STATUS_TONE[status]}>{DEAL_STATUS_LABEL[status]}</Pill>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <span className="num text-[12.5px] text-secondary-text sm:hidden">
                      {fmtMoney(Number(d.total_amount ?? 0))}
                    </span>
                    {left !== null && placement?.status === "active" ? (
                      <Pill tone={left <= 3 ? "red" : "honey"}>
                        {left <= 0 ? "EXPIRED" : `${left}d`}
                      </Pill>
                    ) : (
                      <span className="text-[12px] text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          )}

          {hidden > 0 && onViewAll ? (
            <button
              type="button"
              className="mt-2 w-full rounded-xl border border-border px-3.5 py-2 text-left text-[12px] font-semibold text-honey-text hover:bg-white/5"
              onClick={onViewAll}
            >
              View all {allDeals.length} sales →
            </button>
          ) : null}
        </>
      )}
    </Card>
  );
}
