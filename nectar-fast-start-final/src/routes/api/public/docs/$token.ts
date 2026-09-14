/**
 * Customer-facing paperwork page. Opened by the QR code shown on the payment
 * confirmation screen; lists the signed contract and the paid invoice.
 */
import { createFileRoute } from "@tanstack/react-router";
import { readDealDocsToken } from "@/lib/doc-share.server";

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const LABEL: Record<string, string> = {
  purchase_agreement: "Signed purchase agreement",
  trial_agreement: "Signed trial agreement",
  invoice: "Invoice",
};

export const Route = createFileRoute("/api/public/docs/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const dealId = readDealDocsToken(params.token);
        if (!dealId) {
          return new Response("This document link is invalid or has expired.", {
            status: 404,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: docs } = await supabaseAdmin
          .from("lead_documents")
          .select("id, document_type, title, created_at")
          .eq("deal_id", dealId)
          .order("created_at", { ascending: true });

        const rows = (docs ?? [])
          .map(
            (d) => `<li>
              <a class="doc" href="/api/public/docs/${escape(params.token)}/file/${escape(d.id)}">
                <span>${escape(LABEL[d.document_type] ?? d.title)}</span>
                <span class="dl">Download PDF</span>
              </a>
            </li>`,
          )
          .join("");

        const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Your NectarPay documents</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background:#0e1830; color:#0e1830; }
  .wrap { max-width: 520px; margin: 0 auto; padding: 32px 20px 56px; }
  .card { background:#fff; border-radius:18px; padding:24px; box-shadow:0 18px 40px rgba(0,0,0,.28); }
  h1 { font-size:20px; margin:0 0 6px; }
  p.sub { margin:0 0 20px; color:#5a6478; font-size:14px; }
  ul { list-style:none; margin:0; padding:0; display:grid; gap:12px; }
  a.doc { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 16px; border:1px solid #e3e6ec; border-radius:12px; text-decoration:none; color:#0e1830; font-weight:600; font-size:14.5px; }
  a.doc:hover { border-color:#f0b429; }
  .dl { color:#9a6b00; font-weight:600; font-size:12.5px; white-space:nowrap; }
  .empty { color:#5a6478; font-size:14px; }
  .foot { text-align:center; color:#8b97ad; font-size:12px; margin-top:18px; }
</style></head>
<body><div class="wrap"><div class="card">
  <h1>Your documents</h1>
  <p class="sub">Thanks for your purchase. Download your paperwork below.</p>
  ${rows ? `<ul>${rows}</ul>` : `<p class="empty">Your documents are still being prepared. Refresh this page in a moment.</p>`}
</div><p class="foot">NectarPay</p></div></body></html>`;

        return new Response(html, {
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        });
      },
    },
  },
});
