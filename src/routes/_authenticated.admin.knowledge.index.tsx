import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FolderPlus, Loader2, Plus, Search, Trash2 } from "lucide-react";
import {
  KindBadge,
  useIsKnowledgeAdmin,
  useKnowledgeData,
} from "@/components/knowledge-shell";
import {
  createKnowledgeCategory,
  deleteKnowledgeCategory,
} from "@/lib/knowledge.functions";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { btn, fieldCls, Field } from "@/components/crm/kit";

export const Route = createFileRoute("/_authenticated/admin/knowledge/")({
  head: () => ({
    meta: [
      { title: "Knowledge · Nectar-PAY" },
      {
        name: "description",
        content:
          "Internal pitch decks, training, and resources for the Nectar-PAY & CryptoPOP teams.",
      },
    ],
  }),
  component: Home,
});

const LEGACY_CARDS: Array<{ to: string; eyebrow: string; title: string; desc: string }> = [
  {
    to: "/admin/knowledge/convenience-doctrine",
    eyebrow: "Read First",
    title: "The Convenience Doctrine",
    desc: "The single bar we have to clear — or none of this works.",
  },
  {
    to: "/admin/knowledge/executive-summary",
    eyebrow: "Strategy",
    title: "Executive Summary",
    desc: "Where we are, where we're going, and why this is the moment.",
  },
  {
    to: "/admin/knowledge/pitch/new-markets",
    eyebrow: "Pitch · Franchise",
    title: "New Markets Deck",
    desc: "Recruit regional partners to launch in their territory.",
  },
  {
    to: "/admin/knowledge/pitch/merchants",
    eyebrow: "Pitch · Merchants",
    title: "Nectar-PAY for Merchants",
    desc: "Lower fees, instant settlement, new traffic.",
  },
  {
    to: "/admin/knowledge/pitch/consumers",
    eyebrow: "Pitch · Consumers",
    title: "CryptoPOP for Consumers",
    desc: "Why people show up, earn POP, and bring their friends.",
  },
  {
    to: "/admin/knowledge/training/cryptopop",
    eyebrow: "Training",
    title: "CryptoPOP Participants",
    desc: "Earn POP, invite merchants, climb the leaderboard.",
  },
  {
    to: "/admin/knowledge/training/merchant-onboarding",
    eyebrow: "Training",
    title: "Merchant Onboarding",
    desc: "Eight steps from yes to first crypto transaction.",
  },
  {
    to: "/admin/knowledge/training/sales-reps",
    eyebrow: "Training",
    title: "Sales Rep Manual",
    desc: "Conversations, objections, pricing, portfolio.",
  },
];

type ItemLite = {
  id: string;
  category_id: string | null;
  title: string;
  summary: string | null;
  kind: "article" | "file" | "embed";
  provider: string | null;
  file_type: string | null;
  published: boolean;
};

function ItemCard({ item }: { item: ItemLite }) {
  return (
    <Link
      to="/admin/knowledge/item/$itemId"
      params={{ itemId: item.id }}
      className="group rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-honey hover:shadow-[0_8px_28px_-12px_rgba(180,120,40,0.25)]"
    >
      <div className="flex items-center gap-2">
        <KindBadge kind={item.kind} provider={item.provider} fileType={item.file_type} />
        {!item.published ? (
          <span className="rounded-md bg-chip px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Draft
          </span>
        ) : null}
      </div>
      <div className="mt-2.5 font-display text-[17px] font-semibold text-ink">{item.title}</div>
      {item.summary ? (
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          {item.summary}
        </p>
      ) : null}
      <div className="mt-3 text-[13px] font-medium text-honey-deep opacity-0 transition-opacity group-hover:opacity-100">
        Open →
      </div>
    </Link>
  );
}

function CategoryManager({
  open,
  onOpenChange,
  categories,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: { id: string; name: string; description: string | null }[];
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createKnowledgeCategory);
  const deleteFn = useServerFn(deleteKnowledgeCategory);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createFn({ data: { name: name.trim(), description: desc.trim() || null } });
      setName("");
      setDesc("");
      await qc.invalidateQueries({ queryKey: ["knowledge"] });
      toast.success("Category created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create category");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, catName: string) {
    if (!window.confirm(`Delete category “${catName}”? Its items become uncategorized.`)) return;
    try {
      await deleteFn({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["knowledge"] });
      toast.success("Category deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete category");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage categories</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {categories.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No categories yet.</p>
          ) : (
            categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-inset px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold">{c.name}</div>
                  {c.description ? (
                    <div className="truncate text-[11.5px] text-muted-foreground">
                      {c.description}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => remove(c.id, c.name)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-red/10 hover:text-red-text"
                  aria-label={`Delete ${c.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="mt-3 space-y-2.5 border-t border-border pt-3">
          <Field label="New category name">
            <input
              className={fieldCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Objection handling"
            />
          </Field>
          <Field label="Description (optional)">
            <input
              className={fieldCls}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <button type="button" onClick={add} disabled={busy || !name.trim()} className={btn.primary}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add category
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Home() {
  const { data, isLoading } = useKnowledgeData();
  const isAdmin = useIsKnowledgeAdmin();
  const [query, setQuery] = useState("");
  const [catDialog, setCatDialog] = useState(false);

  const items = (data?.items ?? []) as ItemLite[];
  const categories = data?.categories ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) || (i.summary ?? "").toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <div>
      <section className="border-b border-border bg-comb/40">
        <div className="mx-auto max-w-5xl px-8 py-14 md:py-20">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-honey-deep">
            Internal · Confidential
          </div>
          <h1 className="mt-3 max-w-3xl font-display text-5xl font-semibold leading-[1.05] text-ink md:text-6xl">
            Everything the Nectar-PAY team needs, in one hive.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Articles, videos, and documents — organized by category. Legacy pitch decks and
            training manuals live below.
          </p>
          <div className="mt-8 flex max-w-md items-center gap-2 rounded-lg border border-border bg-card px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the knowledge base…"
              className="h-11 w-full bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          {isAdmin ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/admin/knowledge/new" className={btn.primary}>
                <Plus className="h-4 w-4" /> Add item
              </Link>
              <button type="button" onClick={() => setCatDialog(true)} className={btn.secondary}>
                <FolderPlus className="h-4 w-4" /> Manage categories
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-8 py-12">
        {isLoading ? (
          <div className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : null}

        {categories.map((cat) => {
          const catItems = filtered.filter((i) => i.category_id === cat.id);
          if (query && catItems.length === 0) return null;
          return (
            <div key={cat.id} className="mb-10">
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className="font-display text-xl font-semibold text-ink">{cat.name}</h2>
                {cat.description ? (
                  <span className="truncate text-[12.5px] text-muted-foreground">
                    {cat.description}
                  </span>
                ) : null}
              </div>
              {catItems.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">Nothing here yet.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {catItems.map((i) => (
                    <ItemCard key={i.id} item={i} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filtered.filter((i) => !i.category_id).length > 0 ? (
          <div className="mb-10">
            <h2 className="mb-3 font-display text-xl font-semibold text-ink">Library</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {filtered
                .filter((i) => !i.category_id)
                .map((i) => (
                  <ItemCard key={i.id} item={i} />
                ))}
            </div>
          </div>
        ) : null}

        {!isLoading && items.length === 0 && !query ? (
          <div className="mb-10 rounded-xl border border-dashed border-border bg-comb/30 px-6 py-10 text-center">
            <p className="font-display text-lg font-semibold text-ink">
              The knowledge base is empty
            </p>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              {isAdmin
                ? "Use “Add item” above to publish your first article, file, or video."
                : "Check back soon — an admin will start adding resources here."}
            </p>
          </div>
        ) : null}

        {!query ? (
          <div className="mb-4">
            <h2 className="mb-3 font-display text-xl font-semibold text-ink">Legacy docs</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {LEGACY_CARDS.map((c) => (
                <Link
                  key={c.to}
                  to={c.to as string}
                  className="group rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-honey hover:shadow-[0_8px_28px_-12px_rgba(180,120,40,0.25)]"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-honey-deep">
                    {c.eyebrow}
                  </div>
                  <div className="mt-2 font-display text-[17px] font-semibold text-ink">
                    {c.title}
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                    {c.desc}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <CategoryManager open={catDialog} onOpenChange={setCatDialog} categories={categories} />
    </div>
  );
}
