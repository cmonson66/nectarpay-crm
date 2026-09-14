import { createFileRoute, redirect } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { KnowledgeItemForm } from "@/components/knowledge/item-form";
import { DocHeader, useKnowledgeData } from "@/components/knowledge-shell";

export const Route = createFileRoute("/_authenticated/admin/knowledge/new")({
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/admin/knowledge" });
  },
  head: () => ({
    meta: [
      { title: "New item · Knowledge · Nectar-PAY" },
      { name: "description", content: "Add an article, file, or video to the knowledge base." },
    ],
  }),
  component: NewItemPage,
});

function NewItemPage() {
  const { data, isLoading } = useKnowledgeData();
  return (
    <div>
      <DocHeader
        eyebrow="Admin · Knowledge builder"
        title="Add to the knowledge base"
        lede="Write an article, upload a PDF or video file, or embed a YouTube / Vimeo / Loom link."
      />
      {isLoading || !data ? (
        <div className="flex items-center justify-center gap-2 py-20 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <KnowledgeItemForm categories={data.categories} />
      )}
    </div>
  );
}
