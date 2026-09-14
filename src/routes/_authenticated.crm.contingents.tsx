import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { listPlacements, updatePlacement, type PlacementStatus } from "@/lib/deals.functions";
import { PageSkeleton } from "@/components/crm/loading-state";
import {
  Avatar,
  Chip,
  EmptyState,
  GridHead,
  GridRow,
  GridTable,
  PageHeader,
  Pill,
  StatStrip,
  btn,
  daysBetween,
  fmtDate,
  fmtInt,
} from "@/components/crm/kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/crm/contingents")({
  component: Contingents,
  // Warm the cache while the route chunk loads instead of after it mounts.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery({ queryKey: ["crm-placements"], queryFn: () => listPlacements() });
  },
  head: () => ({
    meta: [
      { title: "Contingents | NectarPay Sales CRM" },
      {
        name: "description",
        content: "Terminals out on free trial: what expires when, and who needs a pickup.",
      },
    ],
  }),
});

const TONE: Record<PlacementStatus, "neutral" | "honey" | "green" | "red" | "blue"> = {
  active: "green",
  extended: "blue",
  overdue: "red",
  converted: "honey",
  returned: "neutral",
};

const STATUS_LABEL: Record<PlacementStatus, string> = {
  active: "Active",
  extended: "Extended",
  overdue: "Overdue",
  converted: "Converted",
  returned: "Returned",
};

const COLS = "minmax(180px,2fr) minmax(130px,1.2fr) 130px 110px minmax(150px,1.2fr) 110px 190px";

function Contingents() {
  const list = useServerFn(listPlacements);
  const patch = useServerFn(updatePlacement);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"open" | "all">("open");

  const query = useQuery({ queryKey: ["crm-placements"], queryFn: () => list() });

  const mutate = useMutation({
    mutationFn: (v: Record<string, unknown>) => patch({ data: v as never }),
    onSuccess: () => {
      toast.success("Placement updated");
      qc.invalidateQueries({ queryKey: ["crm-placements"] });
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

  const all = query.data?.placements ?? [];
  const openRows = all.filter((p) => ["active", "extended", "overdue"].includes(p.status));
  const rows = filter === "open" ? openRows : all;

  const expiring = openRows.filter((p) => daysBetween(p.expires_at) <= 3).length;
  const overdue = openRows.filter((p) => daysBetween(p.expires_at) < 0).length;
  const converted = all.filter((p) => p.status === "converted").length;
  const conversionRate = all.length ? Math.round((converted / all.length) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Contingents"
        subtitle="Terminals sitting in a shop on a free trial. Convert before the clock runs out."
        actions={
          <Chip active={filter === "all"} onClick={() => setFilter(filter === "open" ? "all" : "open")}>
            {filter === "open" ? "Show all" : "Open only"}
          </Chip>
        }
      />

      <div className="flex flex-col gap-4">
        <StatStrip
          cells={[
            { label: "On trial now", value: fmtInt(openRows.length) },
            { label: "Expiring in 3 days", value: fmtInt(expiring) },
            { label: "Past due", value: fmtInt(overdue) },
            { label: "Converted", value: fmtInt(converted), target: `${conversionRate}% of all` },
          ]}
        />

        <section className="surface overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState
              title="No placements"
              hint="Log a contingent trial from a prospect to start the clock."
            />
          ) : (
            <GridTable cols={COLS} minWidth={1040}>
              <GridHead cols={COLS}>
                <span className="card-label">Business</span>
                <span className="card-label">Rep</span>
                <span className="card-label">Device</span>
                <span className="card-label">Placed</span>
                <span className="card-label">Expires</span>
                <span className="card-label">Status</span>
                <span className="card-label text-right">Actions</span>
              </GridHead>

              {rows.map((p) => {
                const lead = p.leads as {
                  id: string;
                  business_name: string;
                  city: string | null;
                } | null;
                const device = p.devices as { serial_number: string } | null;
                const left = daysBetween(p.expires_at);
                const status = p.status as PlacementStatus;
                const isOpen = ["active", "extended", "overdue"].includes(status);
                return (
                  <GridRow
                    key={p.id}
                    cols={COLS}
                    tone={isOpen && left < 0 ? "danger" : !isOpen ? "dim" : undefined}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-col text-left"
                      onClick={() =>
                        lead && navigate({ to: "/crm/leads/$id", params: { id: lead.id } })
                      }
                    >
                      <span className="truncate font-semibold hover:text-honey-text">
                        {lead?.business_name ?? "—"}
                      </span>
                      <span className="truncate text-[11.5px] text-muted-foreground">
                        {lead?.city ?? ""}
                      </span>
                    </button>

                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar name={repName[p.rep_id]} size={22} />
                      <span className="truncate text-secondary-text">
                        {repName[p.rep_id] ?? "—"}
                      </span>
                    </span>

                    <span className="num truncate text-[12px] text-secondary-text">
                      {device?.serial_number ?? "—"}
                    </span>

                    <span className="num text-[12px] text-muted-foreground">
                      {fmtDate(p.placed_at)}
                    </span>

                    <span className="flex min-w-0 flex-col">
                      <span className="num text-[12.5px]">{fmtDate(p.expires_at)}</span>
                      <span
                        className={cn(
                          "num text-[11.5px]",
                          left < 0 ? "text-red-text" : "text-muted-foreground",
                        )}
                      >
                        {left < 0 ? `${-left}d over` : `${left}d left`}
                      </span>
                    </span>

                    <span>
                      <Pill tone={TONE[status]}>{STATUS_LABEL[status]}</Pill>
                    </span>

                    <span className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        className={cn(btn.secondary, "h-8 px-2 text-[12px]")}
                        disabled={!isOpen}
                        onClick={() => mutate.mutate({ id: p.id, extend_days: 7 })}
                      >
                        +7d
                      </button>
                      <button
                        type="button"
                        className={cn(btn.green, "h-8 px-2.5 text-[12px]")}
                        disabled={status === "converted"}
                        onClick={() => mutate.mutate({ id: p.id, status: "converted" })}
                      >
                        Convert
                      </button>
                      <button
                        type="button"
                        className={cn(btn.secondary, "h-8 px-2.5 text-[12px]")}
                        disabled={status === "returned"}
                        onClick={() =>
                          mutate.mutate({ id: p.id, status: "returned", picked_up: true })
                        }
                      >
                        Pick up
                      </button>
                    </span>
                  </GridRow>
                );
              })}
            </GridTable>
          )}
        </section>
      </div>
    </>
  );
}
