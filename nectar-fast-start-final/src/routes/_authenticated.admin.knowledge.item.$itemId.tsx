import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { deleteKnowledgeItem, getKnowledgeItem } from "@/lib/knowledge.functions";
import { EmbedViewer, FileViewer, SafeHtml } from "@/components/knowledge/viewers";
import { KindBadge, useIsKnowledgeAdmin } from "@/components/knowledge-shell";
import { btn, EmptyState } from "@/components/crm/kit";

export const Route = createFileRoute("/_authenticated/admin/knowledge/item/$itemId")({
  head: () => ({
    meta: [
      { title: "Knowledge · Nectar-PAY" },
      { name: "description", content: "Internal Nectar-PAY knowledge base article." },
    ],
  }),
  component: ItemPage,
});

function ItemPage() {
  const { itemId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isAdmin = useIsKnowledgeAdmin();
  const get = useServerFn(getKnowledgeItem);
  const del = useServerFn(deleteKnowledgeItem);

  const { data, isLoading, error } = useQuery({
    queryKey: ["knowledge", "item", itemId],
    queryFn: () => get({ data: { id: itemId } }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (error || !data) {
    return (
      <EmptyState
        title="Couldn't load this item"
        hint={error instanceof Error ? error.message : "It may have been removed."}
        action={
          <Link to="/admin/knowledge" className={btn.secondary}>
            Back to Knowledge
          </Link>
        }
      />
    );
  }

  const { item, fileUrl } = data;

  async function onDelete() {
    if (!window.confirm(`Delete “${item.title}”? This can't be undone.`)) return;
    try {
      await del({ data: { id: item.id } });
      await qc.invalidateQueries({ queryKey: ["knowledge"] });
      toast.success("Deleted");
      navigate({ to: "/admin/knowledge" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  }

  return (
    <div>
      <header className="border-b border-border bg-comb/40">
        <div className="mx-auto max-w-3xl px-8 py-12">
          <div className="flex flex-wrap items-center gap-2">
            <KindBadge
              kind={item.kind as "article" | "file" | "embed"}
              provider={item.provider}
              fileType={item.file_type}
            />
            {!item.published ? (
              <span className="rounded-md bg-chip px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                Draft · admins only
              </span>
            ) : null}
          </div>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.1] text-ink">
            {item.title}
          </h1>
          {item.summary ? (
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              {item.summary}
            </p>
          ) : null}
          {isAdmin ? (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Link
                to="/admin/knowledge/item/$itemId/edit"
                params={{ itemId: item.id }}
                className={btn.secondary}
              >
                <Pencil className="h-4 w-4" /> Edit
              </Link>
              <button type="button" onClick={onDelete} className={btn.danger}>
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-8 py-12">
        {item.kind === "article" ? (
          item.body ? (
            <SafeHtml html={item.body} className="doc-prose" />
          ) : (
            <p className="text-[14px] text-muted-foreground">This article is empty.</p>
          )
        ) : null}
        {item.kind === "embed" && item.embed_url ? (
          <EmbedViewer url={item.embed_url} title={item.title} />
        ) : null}
        {item.kind === "file" ? (
          <FileViewer
            url={fileUrl}
            fileName={item.file_name ?? item.title}
            fileType={item.file_type}
          />
        ) : null}
      </div>
    </div>
  );
}
