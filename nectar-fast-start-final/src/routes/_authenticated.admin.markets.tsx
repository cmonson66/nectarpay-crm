import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listMarkets, upsertMarket, deleteMarket } from "@/lib/leads.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PageSkeleton } from "@/components/crm/loading-state";

export const Route = createFileRoute("/_authenticated/admin/markets")({
  component: AdminMarkets,
});

type Market = {
  id?: string;
  name: string;
  slug: string;
  manager_name?: string | null;
  manager_email?: string | null;
  manager_telegram?: string | null;
  active: boolean;
  sort_order: number;
  notes?: string | null;
};

function AdminMarkets() {
  const list = useServerFn(listMarkets);
  const save = useServerFn(upsertMarket);
  const del = useServerFn(deleteMarket);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-markets"],
    queryFn: () => list(),
  });

  const saveMut = useMutation({
    mutationFn: (m: Market) => save({ data: m as any }),
    onSuccess: () => {
      toast.success("Market saved");
      qc.invalidateQueries({ queryKey: ["admin-markets"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Market removed");
      qc.invalidateQueries({ queryKey: ["admin-markets"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  if (isLoading) return <PageSkeleton />;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;

  const markets: any[] = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold uppercase tracking-tight">Markets</h1>
        <p className="text-xs text-muted-foreground">
          Define the sales markets and who receives lead notifications for each one.
        </p>
      </div>

      <div className="space-y-3">
        {markets.map((m) => (
          <MarketRow
            key={m.id}
            market={m}
            onSave={(next) => saveMut.mutate({ ...next, id: m.id })}
            onDelete={() => {
              if (confirm(`Delete market "${m.name}"? Leads that reference it will keep the text but lose the manager mapping.`)) {
                delMut.mutate(m.id);
              }
            }}
          />
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-border p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Add new market
        </h2>
        <MarketRow
          key="new"
          market={{
            name: "",
            slug: "",
            manager_name: "",
            manager_email: "",
            manager_telegram: "",
            active: true,
            sort_order: (markets.at(-1)?.sort_order ?? 0) + 10,
            notes: "",
          }}
          isNew
          onSave={(next) => saveMut.mutate(next)}
        />
      </div>
    </div>
  );
}

function MarketRow({
  market,
  onSave,
  onDelete,
  isNew,
}: {
  market: Market;
  onSave: (m: Market) => void;
  onDelete?: () => void;
  isNew?: boolean;
}) {
  const [form, setForm] = useState<Market>(market);
  useEffect(() => setForm(market), [market.id]);

  const set = <K extends keyof Market>(k: K, v: Market[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="rounded-lg border border-border bg-card/40 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Name">
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Dallas / Fort Worth" />
        </Field>
        <Field label="Slug">
          <Input
            value={form.slug}
            onChange={(e) => set("slug", e.target.value.toLowerCase())}
            placeholder="dfw"
          />
        </Field>
        <Field label="Manager name">
          <Input value={form.manager_name ?? ""} onChange={(e) => set("manager_name", e.target.value)} />
        </Field>
        <Field label="Manager email">
          <Input
            type="email"
            value={form.manager_email ?? ""}
            onChange={(e) => set("manager_email", e.target.value)}
            placeholder="manager@nectar-pay.com"
          />
        </Field>
        <Field label="Manager Telegram">
          <Input
            value={form.manager_telegram ?? ""}
            onChange={(e) => set("manager_telegram", e.target.value)}
            placeholder="@handle"
          />
        </Field>
        <Field label="Sort order">
          <Input
            type="number"
            value={form.sort_order}
            onChange={(e) => set("sort_order", parseInt(e.target.value || "0", 10))}
          />
        </Field>
      </div>

      <div className="mt-3">
        <Field label="Notes">
          <Textarea
            rows={2}
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
          <span className="text-muted-foreground">Active (receives lead notifications)</span>
        </label>
        <div className="flex gap-2">
          {onDelete && (
            <Button size="sm" variant="ghost" onClick={onDelete}>Delete</Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              if (!form.name.trim() || !form.slug.trim()) {
                toast.error("Name and slug are required");
                return;
              }
              onSave(form);
            }}
          >
            {isNew ? "Add market" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
