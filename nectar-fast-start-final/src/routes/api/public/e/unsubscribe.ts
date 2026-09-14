// One-click unsubscribe. Marks the prospect opted out of email immediately.

import { createFileRoute } from "@tanstack/react-router";

function page(title: string, message: string) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head>
<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#0B1729;color:#F4F1EA;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">
<div style="max-width:420px;padding:32px;text-align:center;">
  <h1 style="font-size:20px;margin:0 0 10px;">${title}</h1>
  <p style="color:#B4BCCC;line-height:1.6;margin:0;">${message}</p>
</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/e/unsubscribe")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const recipientId = url.searchParams.get("r") ?? "";
  const sig = url.searchParams.get("s") ?? "";

  const { verifyLink } = await import("@/lib/email-campaigns.server");
  if (!recipientId || !verifyLink(recipientId, "unsubscribe", sig)) {
    return page("Link expired", "That unsubscribe link isn't valid. Reply to any of our emails and we'll remove you.");
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { data: recipient } = await supabaseAdmin
      .from("email_recipients")
      .select("id, lead_id")
      .eq("id", recipientId)
      .maybeSingle();

    if (recipient) {
      await supabaseAdmin
        .from("email_recipients")
        .update({ unsubscribed_at: now })
        .eq("id", recipient.id);
      await supabaseAdmin
        .from("leads")
        .update({ email_opted_out_at: now })
        .eq("id", recipient.lead_id);
    }
  } catch (e) {
    console.error("[email-unsubscribe] failed", e);
  }

  return page("You're unsubscribed", "You won't receive any more marketing emails from NectarPay.");
}
