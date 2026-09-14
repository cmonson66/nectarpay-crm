import { createFileRoute } from "@tanstack/react-router";
import { KnowledgeShell } from "@/components/knowledge-shell";

export const Route = createFileRoute("/_authenticated/admin/knowledge")({
  component: KnowledgeShell,
});
