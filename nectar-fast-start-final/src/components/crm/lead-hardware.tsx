/** Terminals currently placed with this prospect. */
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listLeadDevices } from "@/lib/crm.functions";
import { EmptyState, Pill, fmtDate, fmtRel } from "@/components/crm/kit";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  in_inventory: "In inventory",
  assigned_to_rep: "With rep",
  placed_contingent: "On trial",
  pending_sale: "Pending",
  sold: "Live",
  returned: "Returned",
  lost: "Lost",
  damaged: "Damaged",
};

const IDLE_DAYS = 3;

export function LeadHardware({ leadId }: { leadId: string }) {
  const list = useServerFn(listLeadDevices);
  const query = useQuery({
    queryKey: ["lead-devices", leadId],
    queryFn: () => list({ data: { lead_id: leadId } }),
  });

  const devices = query.data ?? [];
  const isIdle = (iso: string | null) =>
    !iso || Date.now() - new Date(iso).getTime() > IDLE_DAYS * 86_400_000;
  const idleCount = devices.filter((d) => isIdle(d.updated_at)).length;
  const liveCount = devices.filter((d) => !isIdle(d.updated_at)).length;

  if (query.isLoading)
    return <p className="p-3.5 text-[12.5px] text-muted-foreground">Loading terminals…</p>;

  if (devices.length === 0)
    return (
      <EmptyState
        title="No terminals here"
        hint="Terminals show up once you place a trial or close a sale for this prospect."
      />
    );

  return (
    <div className="min-w-0 p-3.5">
      {/* Rollup */}
      <div className="mb-3 flex flex-wrap gap-x-8 gap-y-3 rounded-xl border border-border bg-inset/60 px-4 py-3">
        <Stat label="Deployed" value={String(devices.length)} />
        <Stat label="Active" value={String(liveCount)} />
        <Stat label="Idle" value={String(idleCount)} tone={idleCount ? "red" : undefined} />
      </div>

      {/* Table — fluid columns, no horizontal scroll */}
      <div className="min-w-0 overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_auto] gap-x-3 border-b border-border bg-inset/60 px-3 py-2 max-sm:grid-cols-[minmax(0,1fr)_auto]">
          <span className="card-label">Device</span>
          <span className="card-label max-sm:hidden">Placed</span>
          <span className="card-label text-right">Last seen</span>
        </div>

        {devices.map((d) => {
          const idle = isIdle(d.updated_at);
          return (
            <div
              key={d.id}
              className={cn(
                "grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_auto] items-center gap-x-3 border-b border-divider px-3 py-2.5 last:border-b-0 max-sm:grid-cols-[minmax(0,1fr)_auto]",
                idle && "border-l-2 border-l-red bg-red/6",
              )}
            >
              <div className="min-w-0">
                <p className="num truncate text-[13px] font-semibold">{d.serial_number}</p>
                <p className="truncate text-[11.5px] text-muted-foreground">{d.model}</p>
              </div>
              <p className="num min-w-0 truncate text-[12.5px] text-secondary-text max-sm:hidden">
                {fmtDate(d.updated_at)}
              </p>
              <div className="flex items-center justify-end gap-2">
                <span
                  className={cn(
                    "num text-[12px]",
                    idle ? "text-red-text" : "text-secondary-text",
                  )}
                >
                  {fmtRel(d.updated_at)}
                </span>
                <Pill tone={idle ? "red" : d.status === "sold" ? "green" : "honey"}>
                  {idle ? "Idle" : (STATUS_LABEL[d.status] ?? d.status)}
                </Pill>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
        Serials are assigned at install. A terminal quiet for {IDLE_DAYS}+ days flags idle so you can
        check on it before the trial ends.
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "red" }) {
  return (
    <div className="min-w-0">
      <p className="card-label">{label}</p>
      <p className={cn("num text-[19px] font-semibold", tone === "red" && "text-red-text")}>
        {value}
      </p>
    </div>
  );
}
