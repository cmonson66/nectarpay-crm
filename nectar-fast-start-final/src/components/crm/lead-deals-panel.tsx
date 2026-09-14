import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PAYMENT_METHODS,
  createDeal,
  listLeadDeals,
  updateDeal,
  updatePlacement,
  type DealStatus,
  type PaymentMethod,
} from "@/lib/deals.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListSkeleton } from "@/components/crm/loading-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const money = (n: unknown) => `$${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

/** Fixed company pricing — reps cannot change these. */
export const DEAL_TERMS = {
  hardware_amount: 499,
  subscription_monthly: 49.99,
  subscription_months: 12,
} as const;


export const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  open: "Open",
  pending: "Pending payment",
  won: "Won",
  lost: "Lost",
  converted: "Converted",
  returned: "Returned",
};

export function LeadDealsPanel({ leadId, hideCreate }: { leadId: string; hideCreate?: boolean }) {
  const list = useServerFn(listLeadDeals);
  const create = useServerFn(createDeal);
  const patchDeal = useServerFn(updateDeal);
  const patchPlacement = useServerFn(updatePlacement);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["lead-deals", leadId],
    queryFn: () => list({ data: { lead_id: leadId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["lead-deals", leadId] });
    qc.invalidateQueries({ queryKey: ["crm-lead", leadId] });
    qc.invalidateQueries({ queryKey: ["crm-pipeline"] });
    qc.invalidateQueries({ queryKey: ["crm-placements"] });
  };

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: "sale" as "sale" | "contingent",
    device_id: "",
    duration_days: 14,
    payment_method: "ACH" as PaymentMethod,
  });

  const add = useMutation({
    mutationFn: () =>
      create({
        data: {
          lead_id: leadId,
          type: form.type,
          hardware_amount: DEAL_TERMS.hardware_amount,
          subscription_monthly: DEAL_TERMS.subscription_monthly,
          subscription_months: DEAL_TERMS.subscription_months,
          device_id: form.device_id,
          duration_days: form.type === "contingent" ? form.duration_days : undefined,
          payment_method: form.type === "sale" ? form.payment_method : null,
        },
      }),
    onSuccess: () => {
      toast.success(form.type === "contingent" ? "Contingent placed" : "Deal created");
      setOpen(false);
      setForm({ type: "sale", device_id: "", duration_days: 14, payment_method: "ACH" });
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create deal"),
  });

  const placement = useMutation({
    mutationFn: (v: Record<string, unknown>) => patchPlacement({ data: v as never }),
    onSuccess: () => {
      toast.success("Placement updated");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const deals = query.data?.deals ?? [];
  const placements = query.data?.placements ?? [];
  const devices = query.data?.availableDevices ?? [];

  return (
    <div className="surface overflow-hidden">
      <div className="flex min-h-[44px] items-center justify-between border-b border-border px-3.5 py-2">
        <h2 className="sec-title">Deals &amp; contingents</h2>
        {hideCreate ? null : (
          <Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)}>
            {open ? "Cancel" : "New deal"}
          </Button>
        )}
      </div>

      {open ? (
        <div className="space-y-3 border-b border-border bg-muted/20 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as "sale" | "contingent" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sale">Sale</SelectItem>
                  <SelectItem value="contingent">Contingent placement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.type === "contingent" ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Trial length</Label>
                <Select
                  value={String(form.duration_days)}
                  onValueChange={(v) => setForm((f) => ({ ...f, duration_days: Number(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="14">2 weeks</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Terminal <span className="text-red-text">*</span>
              </Label>
              <Select
                value={form.device_id}
                onValueChange={(v) => setForm((f) => ({ ...f, device_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a terminal" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.serial_number} — {d.status.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Hardware</Label>
              <p className="pt-2 text-sm font-medium tabular-nums">{money(DEAL_TERMS.hardware_amount)}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subscription</Label>
              <p className="pt-2 text-sm font-medium tabular-nums">
                {money(DEAL_TERMS.subscription_monthly)}/mo × {DEAL_TERMS.subscription_months} mo
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">First-year total</Label>
              <p className="pt-2 text-lg font-semibold tabular-nums">
                {money(
                  DEAL_TERMS.hardware_amount +
                    DEAL_TERMS.subscription_monthly * DEAL_TERMS.subscription_months,
                )}
              </p>
            </div>
            {form.type === "sale" ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Payment method</Label>
                <Select
                  value={form.payment_method}
                  onValueChange={(v) => setForm((f) => ({ ...f, payment_method: v as PaymentMethod }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <Button
            size="sm"
            onClick={() => add.mutate()}
            disabled={add.isPending || !form.device_id}
          >
            {add.isPending ? "Saving…" : form.type === "contingent" ? "Place contingent" : "Create deal"}
          </Button>
        </div>
      ) : null}

      {query.isLoading ? (
        <ListSkeleton />
      ) : deals.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">No deals yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {deals.map((d) => {
            const p = placements.find((x) => x.deal_id === d.id);
            return (
              <li key={d.id} className="space-y-2 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium capitalize">{d.type}</span>
                  {(d as { is_demo?: boolean }).is_demo ? (
                    <span className="rounded-full border border-honey/40 bg-honey/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-honey-text">
                      Demo
                    </span>
                  ) : null}
                  {(d as { payment_method?: string | null }).payment_method ? (
                    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {(d as { payment_method?: string | null }).payment_method}
                    </span>
                  ) : null}
                  <span className="tabular-nums text-muted-foreground">{money(d.total_amount)}</span>
                  <span className="text-xs text-muted-foreground">
                    {money(d.hardware_amount)} + {money(d.subscription_monthly)} × {d.subscription_months}
                  </span>
                  <span className="ml-auto rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {DEAL_STATUS_LABEL[d.status as DealStatus]}
                  </span>
                </div>

                {p ? (
                  <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                      <span>Placed {new Date(p.placed_at).toLocaleDateString()}</span>
                      <span>Expires {new Date(p.expires_at).toLocaleDateString()}</span>
                      <span>
                        Day-4 follow-up{" "}
                        {p.followup_completed_at
                          ? `done ${new Date(p.followup_completed_at).toLocaleDateString()}`
                          : `due ${new Date(p.followup_due_at).toLocaleDateString()}`}
                      </span>
                      <span className="capitalize text-foreground">{p.status}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {!p.followup_completed_at ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => placement.mutate({ id: p.id, followup_done: true })}
                        >
                          Follow-up done
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => placement.mutate({ id: p.id, extend_days: 7 })}
                      >
                        Extend 7 days
                      </Button>
                      <Button size="sm" onClick={() => placement.mutate({ id: p.id, status: "converted" })}>
                        Converted
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => placement.mutate({ id: p.id, status: "returned", picked_up: true })}
                      >
                        Picked up
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
