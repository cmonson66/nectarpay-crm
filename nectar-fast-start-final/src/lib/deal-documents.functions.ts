/** Client-callable access to the generated deal paperwork for a lead. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LeadDocument = {
  id: string;
  deal_id: string | null;
  document_type: "trial_agreement" | "purchase_agreement" | "invoice";
  title: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
};

export const listLeadDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ lead_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<LeadDocument[]> => {
    const { data: rows, error } = await context.supabase
      .from("lead_documents")
      .select("id, deal_id, document_type, title, file_name, file_size, created_at")
      .eq("lead_id", data.lead_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as LeadDocument[];
  });

/** Short-lived signed URL so the rep can open or download a document. */
export const getLeadDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), download: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase
      .from("lead_documents")
      .select("storage_path, file_name")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("Document not found");

    const { data: signed, error: signError } = await context.supabase.storage
      .from("lead-documents")
      .createSignedUrl(doc.storage_path, 300, data.download ? { download: doc.file_name } : undefined);
    if (signError) throw new Error(signError.message);
    return { url: signed.signedUrl, file_name: doc.file_name };
  });

/**
 * Customer-facing share link for a deal's paperwork (signed contract + invoice).
 * Rendered as a QR code on the payment confirmation screen.
 */
export const getDealDocsShareToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ deal_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // RLS scopes this read, so a rep can only share their own deals.
    const { data: deal, error } = await context.supabase
      .from("deals")
      .select("id")
      .eq("id", data.deal_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deal) throw new Error("Deal not found");

    const { createDealDocsToken } = await import("@/lib/doc-share.server");
    return { token: createDealDocsToken(deal.id) };
  });
