import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { getKnowledgeItem } from "@/lib/knowledge.functions";
import { KnowledgeItemForm } from "@/components/knowledge/item-form";
import { DocHeader, useKnowledgeData } from "@/components/knowledge-shell";
import { EmptyState } from "@/components/crm/kit";

export const Route = createFileRoute("/_authenticated/admin/knowledge/item/$itemId/edit")({
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/admin/knowledge" });
  },
  head: () => ({
    meta: [
      { title: "Edit item · Knowledge · Nectar-PAY" },
      { name: "description", content: "Edit a knowledge base item." },
    ],
  }),
  component: EditItemPage,
});

function EditItemPage() {
  const { itemId } = Route.useParams();
  const list = useKnowledgeData();
  const get = useServerFn(getKnowledgeItem);
  const itemQuery = useQuery({
    queryKey: ["knowledge", "item", itemId],
    queryFn: () => get({ data: { id: itemId } }),
  });

  if (list.isLoading || itemQuery.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (!list.data || !itemQuery.data) {
    return <EmptyState title="Couldn't load this item" />;
  }

  return (
    <div>
      <DocHeader eyebrow="Admin · Knowledge builder" title={`Edit: ${itemQuery.data.item.title}`} />
      <KnowledgeItemForm
        categories={list.data.categories}
        item={itemQuery.data.item as import("@/components/knowledge/item-form").KnowledgeItemFull}
      />
    </div>
  );
}
