/** Streams one deal document PDF for a valid customer share token. */
import { createFileRoute } from "@tanstack/react-router";
import { readDealDocsToken } from "@/lib/doc-share.server";

export const Route = createFileRoute("/api/public/docs/$token/file/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const dealId = readDealDocsToken(params.token);
        if (!dealId) return new Response("Link expired", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: doc } = await supabaseAdmin
          .from("lead_documents")
          .select("storage_path, file_name, deal_id")
          .eq("id", params.id)
          .maybeSingle();
        // The token only unlocks paperwork belonging to that one deal.
        if (!doc || doc.deal_id !== dealId) return new Response("Not found", { status: 404 });

        const { data: file, error } = await supabaseAdmin.storage
          .from("lead-documents")
          .download(doc.storage_path);
        if (error || !file) return new Response("Not found", { status: 404 });

        return new Response(await file.arrayBuffer(), {
          headers: {
            "content-type": "application/pdf",
            "content-disposition": `attachment; filename="${doc.file_name}"`,
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
