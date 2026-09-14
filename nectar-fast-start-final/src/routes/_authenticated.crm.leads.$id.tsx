import { createFileRoute, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  Download,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  NotebookPen,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react";
import { LEAD_STATUSES, deleteLead, getLeadDetail, updateCrmLead, type LeadStatus } from "@/lib/crm.functions";
import { formatPhone } from "@/lib/phone";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/lead-status";
import { setTaskDone } from "@/lib/deals.functions";
import { getLeadDocumentUrl, listLeadDocuments, type LeadDocument } from "@/lib/deal-documents.functions";
import { LeadSalesCard } from "@/components/crm/lead-sales-card";
import { LeadHardware } from "@/components/crm/lead-hardware";
import { NearbyProspects } from "@/components/crm/nearby-prospects";
import { ProspectConversation } from "@/components/crm/conversation";
import { FollowUpModal, LogSaleModal, SOURCE_LABEL } from "@/components/crm/modals";
import { PageSkeleton } from "@/components/crm/loading-state";
import {
  Avatar,
  Card,
  Chip,
  EmptyState,
  Pill,
  PageHeader,
  btn,
  fieldCls,
  fmtDate,
  fmtRel,
} from "@/components/crm/kit";
import { AddressAutocomplete, type ResolvedAddress } from "@/components/crm/address-autocomplete";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/crm/leads/$id")({
  component: ProspectDetail,
  head: () => ({
    meta: [
      { title: "Prospect | NectarPay Sales CRM" },
      { name: "description", content: "Everything said and done with this prospect, in one place." },
    ],
  }),
});

type TabKey = "activity" | "details" | "tasks" | "sales" | "documents" | "hardware" | "nearby";

function ProspectDetail() {
  const { id } = Route.useParams();
  const detail = useServerFn(getLeadDetail);
  const update = useServerFn(updateCrmLead);
  const remove = useServerFn(deleteLead);
  const setDone = useServerFn(setTaskDone);
  const listDocuments = useServerFn(listLeadDocuments);
  const getDocumentUrl = useServerFn(getLeadDocumentUrl);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isAdmin, isManager } = useRouteContext({ from: "/_authenticated/crm" });

  const [saleOpen, setSaleOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [touchSignal, setTouchSignal] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState<TabKey>("activity");
  const [editContact, setEditContact] = useState(false);

  const query = useQuery({ queryKey: ["crm-lead", id], queryFn: () => detail({ data: { id } }) });
  const documentsQuery = useQuery({
    queryKey: ["crm-lead-documents", id],
    queryFn: () => listDocuments({ data: { lead_id: id } }),
  });

  const openDocument = async (document: LeadDocument, download = false) => {
    try {
      const result = await getDocumentUrl({ data: { id: document.id, download } });
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open document");
    }
  };

  const toggleTask = useMutation({
    mutationFn: (vars: { id: string; done: boolean }) => setDone({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-lead", id] });
      qc.invalidateQueries({ queryKey: ["crm-tasks"] });
      qc.invalidateQueries({ queryKey: ["crm-home"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const patch = useMutation({
    mutationFn: (vars: Record<string, unknown>) => update({ data: { id, ...vars } as never }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-lead", id] });
      qc.invalidateQueries({ queryKey: ["crm-pipeline"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  // The rail collapses into a Details tab on phones; drop back to Activity on resize.
  useEffect(() => {
    if (!isMobile) setTab((t) => (t === "details" ? "activity" : t));
  }, [isMobile]);

  const del = useMutation({
    mutationFn: () => remove({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-pipeline"] });
      toast.success("Prospect deleted");
      void navigate({ to: "/crm/leads" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  if (query.isLoading) return <PageSkeleton />;
  if (query.error || !query.data)
    return (
      <p className="text-[13px] text-red-text">
        {query.error instanceof Error ? query.error.message : "Prospect not found"}
      </p>
    );

  const { lead, activities, reps, tasks } = query.data;
  const repName: Record<string, string> = {};
  for (const r of reps) repName[r.user_id] = r.full_name || r.email || "Unknown";

  const status = lead.status as LeadStatus;
  // Only admins and managers may close a prospect as won.
  const canCloseWon = isAdmin || isManager;
  const phone = lead.contact_phone_e164 ?? null;
  const lastTouch = activities[0]?.occurred_at ?? lead.last_activity_at ?? null;
  const openTasks = tasks.filter((t) => !t.completed_at);
  const documents = documentsQuery.data ?? [];
  const mapQuery = [lead.business_name, lead.address_line1, lead.city, lead.state, lead.postal_code]
    .filter(Boolean)
    .join(", ");

  const TaskRows = ({ rows }: { rows: typeof tasks }) => (
    <div className="flex flex-col gap-1.5 text-[12.5px]">
      {rows.length === 0 ? (
        <p className="text-muted-foreground">No follow-ups scheduled.</p>
      ) : (
        rows.map((t) => {
          const done = Boolean(t.completed_at);
          const overdue = !done && t.due_at && new Date(t.due_at) < new Date();
          return (
            <label
              key={t.id}
              className={cn(
                "flex items-start gap-2 rounded-lg px-2 py-1.5",
                overdue ? "border-l-2 border-red bg-red/8" : "hover:bg-chip/60",
              )}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--honey)] max-md:h-6 max-md:w-6"
                checked={done}
                onChange={(e) => toggleTask.mutate({ id: t.id, done: e.target.checked })}
              />
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate", done && "text-muted-foreground line-through")}>
                  {t.title}
                </span>
                <span
                  className={cn(
                    "block text-[11.5px]",
                    overdue ? "text-red-text" : "text-muted-foreground",
                  )}
                >
                  {t.due_at ? fmtDate(t.due_at) : "No due date"}
                  {overdue ? " · overdue" : ""}
                </span>
              </span>
            </label>
          );
        })
      )}
    </div>
  );

  const rail = (
    <>
          <Card
            title={
              <span className="flex items-center gap-2">
                Tasks
                {openTasks.length ? <Pill tone="honey">{openTasks.length}</Pill> : null}
              </span>
            }
            action={
              <button
                type="button"
                className={cn(btn.secondary, "h-7 px-2")}
                title="Schedule follow-up"
                onClick={() => setFollowUpOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </button>
            }
          >
            <TaskRows rows={tasks.slice(0, 2)} />
            {tasks.length > 2 ? (
              <button
                type="button"
                className="mt-2 text-[12px] text-honey-text hover:underline"
                onClick={() => setTab("tasks")}
              >
                View all {tasks.length} tasks →
              </button>
            ) : null}
          </Card>

          <Card
            title="Contact"
            action={
              <button
                type="button"
                className="text-[12px] text-honey-text hover:underline"
                onClick={() => setEditContact((v) => !v)}
              >
                {editContact ? "Done" : "Edit"}
              </button>
            }
          >
            {editContact ? (
              <div className="flex flex-col gap-1">
                <EditableField
                  label="Contact name"
                  value={lead.contact_name ?? ""}
                  onSave={(v) => patch.mutate({ contact_name: v })}
                />
                <EditableField
                  label="Phone"
                  value={lead.contact_phone_e164 ?? ""}
                  display={formatPhone(lead.contact_phone_e164)}
                  onSave={(v) => patch.mutate({ contact_phone: v })}
                />
                <EditableField
                  label="Email"
                  value={lead.contact_email ?? ""}
                  onSave={(v) => patch.mutate({ contact_email: v })}
                />
                <EditableField
                  label="Address"
                  value={lead.address_line1 ?? ""}
                  onSave={(v) => patch.mutate({ address_line1: v })}
                  autocompleteAddress
                  onSelectAddress={(a) =>
                    patch.mutate({
                      address_line1: a.addressLine1,
                      city: a.city || lead.city,
                      state: a.state || lead.state,
                      postal_code: a.postalCode || lead.postal_code,
                    })
                  }
                />
                <EditableField
                  label="City"
                  value={lead.city ?? ""}
                  onSave={(v) => patch.mutate({ city: v })}
                />
                <EditableField
                  label="State"
                  value={lead.state ?? ""}
                  onSave={(v) => patch.mutate({ state: v })}
                />
                <EditableField
                  label="Postal code"
                  value={lead.postal_code ?? ""}
                  onSave={(v) => patch.mutate({ postal_code: v })}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 text-[13px]">
                <p className="font-semibold">{lead.contact_name || "No contact name"}</p>
                {phone ? (
                  <a className="num text-secondary-text hover:text-honey-text" href={`tel:${phone}`}>
                    {formatPhone(phone)}
                  </a>
                ) : (
                  <p className="text-muted-foreground">No phone</p>
                )}
                {lead.contact_email ? (
                  <a
                    className="truncate text-secondary-text hover:text-honey-text"
                    href={`mailto:${lead.contact_email}`}
                  >
                    {lead.contact_email}
                  </a>
                ) : null}
                <p className="mt-1 text-[12.5px] text-secondary-text">
                  {lead.address_line1 || "No address"}
                  {lead.city ? (
                    <>
                      <br />
                      {[lead.city, lead.state].filter(Boolean).join(", ")} {lead.postal_code ?? ""}
                    </>
                  ) : null}
                </p>
                {mapQuery ? (
                  <a
                    className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] text-honey-text hover:underline"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPin className="h-3.5 w-3.5" /> Open in maps
                  </a>
                ) : null}
              </div>
            )}

            {lead.contact_email ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <a className={btn.secondary} href={`mailto:${lead.contact_email}`}>
                  <Mail className="h-4 w-4" /> Email
                </a>
              </div>
            ) : null}
          </Card>

          <div className="mt-auto">
            <LeadSalesCard
              leadId={lead.id}
              onAdd={() => setSaleOpen(true)}
              limit={2}
              onViewAll={() => setTab("sales")}
              compact
            />
          </div>
    </>
  );

  return (
    <>
      <PageHeader
        back="/crm/leads"
        title={lead.business_name}
        subtitle={
          [lead.business_type, lead.city, lead.state].filter(Boolean).join(" · ") ||
          (SOURCE_LABEL[lead.source] ?? lead.source)
        }
        actions={
          <>
            <button
              type="button"
              className={btn.secondary}
              onClick={() => {
                setTab("activity");
                setTouchSignal((n) => n + 1);
              }}
            >
              <NotebookPen className="h-4 w-4" /> Log a touch
            </button>
            <button
              type="button"
              className={cn(btn.green, "max-md:h-11 max-md:w-11 max-md:justify-center max-md:px-0")}
              title="Log a sale"
              aria-label="Log a sale"
              onClick={() => setSaleOpen(true)}
            >
              <Receipt className="h-4 w-4" /> <span className="max-md:hidden">Log a sale</span>
            </button>
            {confirmDelete ? (
              <button
                type="button"
                className={cn(btn.secondary, "border-red-text/50 text-red-text")}
                disabled={del.isPending}
                onClick={() => del.mutate()}
              >
                <Trash2 className="h-4 w-4" /> {del.isPending ? "Deleting…" : "Confirm delete?"}
              </button>
            ) : (
              <button
                type="button"
                className={btn.secondary}
                title="Delete prospect"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </>
        }
      />

      {/* Summary bar */}
      <div className="surface mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 px-3.5 py-3">
        <SummaryItem label="Stage">
          <div className="flex items-center gap-2">
            <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>
            <select
              className={cn(fieldCls, "h-8 w-auto max-sm:h-11")}
              value={status}
              onChange={(e) => patch.mutate({ status: e.target.value })}
            >
              {LEAD_STATUSES.filter((s) => s !== "won" || canCloseWon || status === "won").map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        </SummaryItem>

        <SummaryItem label="Owner">
          <div className="flex items-center gap-2">
            {lead.owner_rep_id ? <Avatar name={repName[lead.owner_rep_id]} size={22} /> : null}
            <select
              className={cn(fieldCls, "h-8 w-auto max-sm:h-11")}
              value={lead.owner_rep_id ?? "none"}
              onChange={(e) =>
                patch.mutate({
                  owner_rep_id: e.target.value === "none" ? null : e.target.value,
                })
              }
            >
              <option value="none">Unassigned</option>
              {reps.map((r) => (
                <option key={r.user_id} value={r.user_id}>
                  {r.full_name || r.email}
                </option>
              ))}
            </select>
          </div>
        </SummaryItem>

        <SummaryItem label="Last touch">
          <span className="text-[13px] text-secondary-text">{fmtRel(lastTouch)}</span>
        </SummaryItem>

        <SummaryItem label="Added">
          <span className="num text-[13px] text-secondary-text">{fmtDate(lead.created_at)}</span>
        </SummaryItem>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Left rail — hidden on phones, surfaced through the Details tab */}
        <aside className="flex min-w-0 flex-col gap-4 max-md:hidden">{rail}</aside>

        {/* Tabbed work area */}
        <section className="surface flex min-w-0 flex-col md:h-[calc(100vh-180px)] md:min-h-[560px] md:overflow-hidden">
          <header className="flex items-center gap-1.5 border-b border-border px-3 py-2 max-md:sticky max-md:top-0 max-md:z-20 max-md:overflow-x-auto max-md:bg-surface md:flex-wrap [&_button]:max-md:h-11 [&_button]:max-md:shrink-0">
            <Chip active={tab === "activity"} count={activities.length} onClick={() => setTab("activity")}>
              Activity
            </Chip>
            {isMobile ? (
              <Chip active={tab === "details"} onClick={() => setTab("details")}>
                Details
              </Chip>
            ) : null}
            <Chip active={tab === "tasks"} count={openTasks.length} onClick={() => setTab("tasks")}>
              Tasks
            </Chip>
            <Chip active={tab === "sales"} onClick={() => setTab("sales")}>
              Sales
            </Chip>
            <Chip active={tab === "documents"} count={documents.length} onClick={() => setTab("documents")}>
              Documents
            </Chip>
            <Chip active={tab === "hardware"} onClick={() => setTab("hardware")}>
              Hardware
            </Chip>
            <Chip active={tab === "nearby"} onClick={() => setTab("nearby")}>
              Nearby
            </Chip>
          </header>

          {tab === "activity" ? (
            <ProspectConversation
              leadId={lead.id}
              phone={phone}
              optedOut={Boolean(lead.sms_opted_out_at)}
              activities={activities}
              repName={repName}
              contactName={lead.contact_name}
              embedded
              onNewTask={() => setFollowUpOpen(true)}
              touchSignal={touchSignal}
            />
          ) : null}

          {tab === "details" && isMobile ? (
            <div className="flex min-w-0 flex-col gap-4 p-3">{rail}</div>
          ) : null}

          {tab === "tasks" ? (
            <div className="flex-1 p-3.5 md:overflow-y-auto">
              <TaskRows rows={tasks} />
              <button
                type="button"
                className={cn(btn.secondary, "mt-3")}
                onClick={() => setFollowUpOpen(true)}
              >
                <CalendarClock className="h-4 w-4" /> Schedule follow-up
              </button>
            </div>
          ) : null}

          {tab === "sales" ? (
            <div className="min-w-0 flex-1 p-3 md:overflow-auto">
              <LeadSalesCard leadId={lead.id} onAdd={() => setSaleOpen(true)} />
            </div>
          ) : null}

          {tab === "documents" ? (
            <div className="flex-1 md:overflow-y-auto">
              {documentsQuery.isLoading ? (
                <p className="p-3.5 text-[12.5px] text-muted-foreground">Loading documents…</p>
              ) : documents.length === 0 ? (
                <EmptyState
                  title="No paperwork yet"
                  hint="Signed agreements and paid invoices land here automatically."
                />
              ) : (
                documents.map((document) => (
                  <div
                    key={document.id}
                    className="flex items-center gap-2 border-b border-divider px-3.5 py-2.5 last:border-b-0"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-honey-text" />
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-[13px] font-medium hover:text-honey-text"
                      title={document.title}
                      onClick={() => void openDocument(document)}
                    >
                      {document.document_type === "trial_agreement"
                        ? "Trial agreement"
                        : document.document_type === "purchase_agreement"
                          ? "Purchase agreement"
                          : "Invoice"}
                    </button>
                    <button
                      type="button"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-chip hover:text-foreground"
                      title="Open document"
                      aria-label={`Open ${document.file_name}`}
                      onClick={() => void openDocument(document)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-chip hover:text-foreground"
                      title="Download document"
                      aria-label={`Download ${document.file_name}`}
                      onClick={() => void openDocument(document, true)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {tab === "hardware" ? (
            <div className="flex-1 md:overflow-y-auto">
              <LeadHardware leadId={lead.id} />
            </div>
          ) : null}

          {tab === "nearby" ? (
            <div className="flex-1 p-3.5 md:overflow-y-auto">
              <NearbyProspects leadId={lead.id} />
            </div>
          ) : null}
        </section>
      </div>

      <LogSaleModal leadId={lead.id} open={saleOpen} onOpenChange={setSaleOpen} />
      <FollowUpModal leadId={lead.id} open={followUpOpen} onOpenChange={setFollowUpOpen} />
    </>
  );
}

function SummaryItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="card-label">{label}</span>
      {children}
    </div>
  );
}

function EditableField({
  label,
  value,
  display,
  onSave,
  autocompleteAddress,
  onSelectAddress,
}: {
  label: string;
  value: string;
  display?: string;
  onSave: (v: string) => void;
  autocompleteAddress?: boolean;
  onSelectAddress?: (a: ResolvedAddress) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        className="flex items-baseline justify-between gap-3 border-b border-divider py-1.5 text-left last:border-b-0 hover:text-honey-text"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        <span className="card-label shrink-0">{label}</span>
        <span className="min-w-0 truncate text-[13px] text-secondary-text">
          {display || value || "—"}
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1 py-1.5">
      <span className="card-label">{label}</span>
      {autocompleteAddress ? (
        <AddressAutocomplete
          autoFocus
          className={fieldCls}
          value={draft}
          onChange={setDraft}
          onSelect={(a) => {
            setDraft(a.addressLine1);
            setEditing(false);
            onSelectAddress?.(a);
          }}
          onBlur={() => {
            setEditing(false);
            if (draft !== value) onSave(draft);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      ) : (
        <input
          autoFocus
          className={fieldCls}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (draft !== value) onSave(draft);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      )}
    </div>
  );
}

