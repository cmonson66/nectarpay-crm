import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Trash2 } from "lucide-react";
import {
  LEAD_STATUSES,
  deleteLead,
  listPipeline,
  listVisibleReps,
  updateCrmLead,
  type LeadStatus,
} from "@/lib/crm.functions";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/lead-status";
import { formatPhone } from "@/lib/phone";
import { PageSkeleton } from "@/components/crm/loading-state";
import { NewProspectModal, SOURCE_LABEL } from "@/components/crm/modals";
import { useDealValues } from "@/components/crm/use-deal-values";
import {
  Avatar,
  Chip,
  EmptyState,
  GridHead,
  GridRow,
  GridTable,
  PageHeader,
  Pill,
  Segmented,
  btn,
  fieldCls,
  fmtMoney,
  fmtRel,
} from "@/components/crm/kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/crm/leads/")({
  component: Pipeline,
  // Warm the cache while the route chunk loads instead of after it mounts.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery({ queryKey: ["crm-pipeline"], queryFn: () => listPipeline() });
    void context.queryClient.prefetchQuery({ queryKey: ["crm-reps"], queryFn: () => listVisibleReps() });
  },
  validateSearch: (search: Record<string, unknown>): { status?: string; new?: boolean } => {
    const out: { status?: string; new?: boolean } = {};
    if (typeof search["status"] === "string") out.status = search["status"];
    if (search["new"] === true || search["new"] === "true") out.new = true;
    return out;
  },
  head: () => ({
    meta: [
      { title: "Pipeline | NectarPay Sales CRM" },
      {
        name: "description",
        content: "Every prospect your team is working, in a list or a drag-and-drop board.",
      },
    ],
  }),
});

type LeadRow = {
  id: string;
  business_name: string;
  contact_name: string | null;
  contact_phone_e164: string | null;
  city: string | null;
  state: string | null;
  status: LeadStatus;
  source: string;
  owner_rep_id: string | null;
  last_activity_at: string | null;
  follow_up_at: string | null;
  created_at: string;
};

const COLS =
  "minmax(200px,2.2fr) minmax(150px,1.4fr) minmax(110px,1fr) 118px 92px minmax(120px,1fr) 96px 44px";

function Pipeline() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const pipeline = useServerFn(listPipeline);
  const reps = useServerFn(listVisibleReps);
  const patchLead = useServerFn(updateCrmLead);
  const removeLead = useServerFn(deleteLead);
  const qc = useQueryClient();
  const values = useDealValues();

  const [q, setQ] = useState("");
  const [owner, setOwner] = useState("all");
  const [source, setSource] = useState("all");
  const [view, setView] = useState<"list" | "board">("list");
  const [creating, setCreating] = useState(false);

  const status = search.status ?? "all";
  const setStatus = (s: string) =>
    navigate({
      to: "/crm/leads",
      search: (prev: Record<string, unknown>) => ({ ...prev, status: s === "all" ? undefined : s }) as { status?: string; new?: boolean },
      replace: true,
    });

  useEffect(() => {
    if (search.new) {
      setCreating(true);
      navigate({ to: "/crm/leads", search: (prev: Record<string, unknown>) => ({ ...prev, new: undefined }) as { status?: string; new?: boolean }, replace: true });
    }
  }, [search.new, navigate]);

  const leadsQuery = useQuery({ queryKey: ["crm-pipeline"], queryFn: () => pipeline() });
  const repsQuery = useQuery({ queryKey: ["crm-reps"], queryFn: () => reps() });

  const moveLead = useMutation({
    mutationFn: (v: { id: string; status: LeadStatus }) => patchLead({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-pipeline"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not move prospect"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeLead({ data: { id } }),
    onSuccess: () => {
      toast.success("Prospect deleted");
      qc.invalidateQueries({ queryKey: ["crm-pipeline"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete prospect"),
  });

  const confirmDelete = (lead: LeadRow) => {
    if (window.confirm(`Delete ${lead.business_name}? This removes the prospect and all related activity. This cannot be undone.`)) {
      deleteMutation.mutate(lead.id);
    }
  };

  const repName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of repsQuery.data ?? []) map[r.user_id] = r.full_name || r.email || "Unknown";
    return map;
  }, [repsQuery.data]);

  const rows = (leadsQuery.data ?? []) as unknown as LeadRow[];

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of rows) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const assignLead = useMutation({
    mutationFn: (v: { id: string; owner_rep_id: string }) => patchLead({ data: v }),
    onSuccess: () => {
      toast.success("Prospect assigned");
      qc.invalidateQueries({ queryKey: ["crm-pipeline"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not assign prospect"),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((l) => {
      if (status !== "all" && l.status !== status) return false;
      if (source !== "all" && l.source !== source) return false;
      if (owner === "unassigned" ? l.owner_rep_id !== null : owner !== "all" && l.owner_rep_id !== owner)
        return false;
      if (!term) return true;
      return [l.business_name, l.contact_name, l.contact_phone_e164, l.city]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [rows, q, status, owner, source]);

  const inboundUnassigned = rows.filter(
    (l) => l.source === "web_intake" && !l.owner_rep_id,
  ).length;

  const openValue = filtered.reduce((sum, l) => sum + (values.get(l.id) ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Pipeline"
        subtitle={`${filtered.length} of ${rows.length} prospects · ${fmtMoney(openValue)} booked`}
        actions={
          <>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: "list", label: "List" },
                { value: "board", label: "Board" },
              ]}
            />
            <button type="button" className={btn.primary} onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New prospect
            </button>
          </>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="scroll-x -mx-1 px-1">
          <div className="flex w-max gap-1.5">
            <Chip active={status === "all"} count={rows.length} onClick={() => setStatus("all")}>
              All
            </Chip>
            {LEAD_STATUSES.map((s) => (
              <Chip
                key={s}
                active={status === s}
                count={counts[s] ?? 0}
                tone={STATUS_TONE[s]}
                onClick={() => setStatus(status === s ? "all" : s)}
              >
                {STATUS_LABEL[s]}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={cn(fieldCls, "pl-8")}
              placeholder="Search business, contact, phone, city"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            className={cn(fieldCls, "w-auto min-w-[150px]")}
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          >
            <option value="all">All owners</option>
            <option value="unassigned">Unassigned</option>
            {(repsQuery.data ?? []).map((r) => (
              <option key={r.user_id} value={r.user_id}>
                {r.full_name || r.email}
              </option>
            ))}
          </select>
          <select
            className={cn(fieldCls, "w-auto min-w-[150px]")}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="all">All sources</option>
            {Object.entries(SOURCE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {inboundUnassigned > 0 ? (
            <button
              type="button"
              className={cn(btn.ghost, "whitespace-nowrap")}
              onClick={() => {
                setSource("web_intake");
                setOwner("unassigned");
                setStatus("all");
              }}
            >
              {inboundUnassigned} new inbound
            </button>
          ) : null}
        </div>


        {leadsQuery.isLoading ? (
          <PageSkeleton />
        ) : leadsQuery.error ? (
          <p className="text-[13px] text-red-text">
            {leadsQuery.error instanceof Error ? leadsQuery.error.message : "Failed to load"}
          </p>
        ) : filtered.length === 0 ? (
          <div className="surface">
            <EmptyState
              title="No prospects match"
              hint="Loosen the filters, or add the shop you just walked into."
              action={
                <button type="button" className={btn.primary} onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" /> New prospect
                </button>
              }
            />
          </div>
        ) : view === "board" ? (
          <Board
            leads={filtered}
            repName={repName}
            values={values}
            onMove={(id, s) => moveLead.mutate({ id, status: s })}
          />
        ) : (
          <ListView
            leads={filtered}
            repName={repName}
            values={values}
            onDelete={confirmDelete}
            reps={repsQuery.data ?? []}
            onAssign={(id, owner_rep_id) => assignLead.mutate({ id, owner_rep_id })}
          />
        )}
      </div>

      <NewProspectModal open={creating} onOpenChange={setCreating} />
    </>
  );
}

/* ── list ───────────────────────────────────────────────────────── */

function ListView({
  leads,
  repName,
  values,
  onDelete,
  reps,
  onAssign,
}: {
  leads: LeadRow[];
  repName: Record<string, string>;
  values: Map<string, number>;
  onDelete: (lead: LeadRow) => void;
  reps: { user_id: string; full_name: string | null; email: string | null }[];
  onAssign: (id: string, ownerRepId: string) => void;
}) {
  const navigate = useNavigate();
  return (
    <>
      {/* Mobile cards */}
      <ul className="flex flex-col gap-2 md:hidden">
        {leads.map((l) => (
          <li key={l.id}>
            <Link
              to="/crm/leads/$id"
              params={{ id: l.id }}
              className="surface flex flex-col gap-1.5 p-3 active:bg-chip/50"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                  {l.business_name}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <Pill tone={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Pill>
                  <button
                    type="button"
                    aria-label={`Delete ${l.business_name}`}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDelete(l);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </div>
              <span className="truncate text-[12.5px] text-secondary-text">
                {l.contact_name || "No contact"}
                {l.contact_phone_e164 ? ` · ${formatPhone(l.contact_phone_e164)}` : ""}
              </span>
              <div className="flex flex-wrap items-center gap-x-3 text-[11.5px] text-muted-foreground">
                <span>{[l.city, l.state].filter(Boolean).join(", ") || "—"}</span>
                <span className="num">{values.get(l.id) ? fmtMoney(values.get(l.id)) : "—"}</span>
                <span>{fmtRel(l.last_activity_at)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop grid */}
      <div className="surface hidden overflow-hidden md:block">
        <GridTable cols={COLS} minWidth={940}>
          <GridHead cols={COLS}>
            <span className="card-label">Business</span>
            <span className="card-label">Contact</span>
            <span className="card-label">Location</span>
            <span className="card-label">Status</span>
            <span className="card-label text-right">Value</span>
            <span className="card-label">Owner</span>
            <span className="card-label text-right">Activity</span>
            <span />
          </GridHead>
          {leads.map((l) => (
            <GridRow
              key={l.id}
              cols={COLS}
              onClick={() => navigate({ to: "/crm/leads/$id", params: { id: l.id } })}
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{l.business_name}</span>
                <span className="truncate text-[11.5px] text-muted-foreground">
                  {SOURCE_LABEL[l.source] ?? l.source}
                </span>
              </div>
              <div className="flex min-w-0 flex-col text-secondary-text">
                <span className="truncate">{l.contact_name || "—"}</span>
                {l.contact_phone_e164 ? (
                  <span className="num truncate text-[11.5px] text-muted-foreground">
                    {formatPhone(l.contact_phone_e164)}
                  </span>
                ) : null}
              </div>
              <span className="truncate text-secondary-text">
                {[l.city, l.state].filter(Boolean).join(", ") || "—"}
              </span>
              <span>
                <Pill tone={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Pill>
              </span>
              <span className="num text-right">
                {values.get(l.id) ? fmtMoney(values.get(l.id)) : "—"}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                {l.owner_rep_id ? (
                  <>
                    <Avatar name={repName[l.owner_rep_id]} size={22} />
                    <span className="truncate text-secondary-text">
                      {repName[l.owner_rep_id] ?? "—"}
                    </span>
                  </>
                ) : (
                  <select
                    className={cn(fieldCls, "h-7 w-full min-w-0 px-1.5 text-[12px]")}
                    value=""
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      if (e.target.value) onAssign(l.id, e.target.value);
                    }}
                  >
                    <option value="">Assign…</option>
                    {reps.map((r) => (
                      <option key={r.user_id} value={r.user_id}>
                        {r.full_name || r.email}
                      </option>
                    ))}
                  </select>
                )}
              </span>
              <span className="text-right text-[12px] text-muted-foreground">
                {fmtRel(l.last_activity_at)}
              </span>
              <span className="flex justify-end">
                <button
                  type="button"
                  aria-label={`Delete ${l.business_name}`}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(l);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </GridRow>
          ))}
        </GridTable>
      </div>
    </>
  );
}

/* ── board ──────────────────────────────────────────────────────── */

function Board({
  leads,
  repName,
  values,
  onMove,
}: {
  leads: LeadRow[];
  repName: Record<string, string>;
  values: Map<string, number>;
  onMove: (id: string, status: LeadStatus) => void;
}) {
  const [over, setOver] = useState<LeadStatus | null>(null);

  return (
    <div className="scroll-x pb-2">
      <div className="flex w-max gap-3">
        {LEAD_STATUSES.map((s) => {
          const items = leads.filter((l) => l.status === s);
          const total = items.reduce((sum, l) => sum + (values.get(l.id) ?? 0), 0);
          return (
            <div
              key={s}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(s);
              }}
              onDragLeave={() => setOver((c) => (c === s ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData("text/plain");
                const lead = leads.find((l) => l.id === id);
                // Closing a prospect as won is deliberate — it only happens
                // from the status dropdown on the prospect itself.
                if (s === "won") {
                  toast.error("Mark a prospect as won from the prospect's status dropdown");
                  return;
                }
                if (id && lead && lead.status !== s) onMove(id, s);
              }}
              className={cn(
                "flex w-[264px] shrink-0 flex-col rounded-[14px] border bg-inset/60 transition-colors",
                over === s ? "border-honey/60 bg-honey/8" : "border-border",
              )}
            >
              <header className="flex items-center justify-between gap-2 border-b border-divider px-3 py-2">
                <span className="truncate text-[12.5px] font-semibold">{STATUS_LABEL[s]}</span>
                <span className="num text-[11.5px] text-muted-foreground">
                  {items.length}
                  {total ? ` · ${fmtMoney(total, { compact: true })}` : ""}
                </span>
              </header>
              <div className="flex min-h-[120px] flex-col gap-2 p-2">
                {items.map((l) => (
                  <Link
                    key={l.id}
                    to="/crm/leads/$id"
                    params={{ id: l.id }}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)}
                    className="surface flex cursor-grab flex-col gap-1.5 p-2.5 active:cursor-grabbing hover:border-honey/35"
                  >
                    <span className="truncate text-[13px] font-semibold">{l.business_name}</span>
                    <span className="truncate text-[11.5px] text-muted-foreground">
                      {[l.city, l.state].filter(Boolean).join(", ") || "—"}
                    </span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {l.owner_rep_id ? <Avatar name={repName[l.owner_rep_id]} size={18} /> : null}
                        <span className="truncate text-[11.5px] text-secondary-text">
                          {l.owner_rep_id ? (repName[l.owner_rep_id] ?? "—") : "Unassigned"}
                        </span>
                      </span>
                      <span className="num shrink-0 text-[11.5px] text-honey-text">
                        {values.get(l.id) ? fmtMoney(values.get(l.id), { compact: true }) : ""}
                      </span>
                    </div>
                  </Link>
                ))}
                {items.length === 0 ? (
                  <p className="px-1 py-5 text-center text-[11.5px] text-muted-foreground">
                    Drop a prospect here
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
