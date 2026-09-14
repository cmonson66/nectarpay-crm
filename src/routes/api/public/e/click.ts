// Tracked-link redirect. Records the click, alerts the owning rep through the
// CRM (activity + follow-up task), then forwards the prospect to the real URL.

import { createFileRoute } from "@tanstack/react-router";

const DEDUPE_MINUTES = 10;

export const Route = createFileRoute("/api/public/e/click")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const recipientId = url.searchParams.get("r") ?? "";
        const dest = url.searchParams.get("u") ?? "";
        const sig = url.searchParams.get("s") ?? "";
        const label = url.searchParams.get("l");

        const { verifyLink, baseUrl } = await import("@/lib/email-campaigns.server");
        if (!recipientId || !dest || !verifyLink(recipientId, dest, sig)) {
          return Response.redirect(baseUrl(), 302);
        }
        // Only ever redirect to http(s) — never to javascript:/data: URIs.
        let target: URL;
        try {
          target = new URL(dest);
          if (target.protocol !== "https:" && target.protocol !== "http:") throw new Error("bad");
        } catch {
          return Response.redirect(baseUrl(), 302);
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: recipient } = await supabaseAdmin
            .from("email_recipients")
            .select("id, campaign_id, lead_id, click_count, last_clicked_at, first_clicked_at")
            .eq("id", recipientId)
            .maybeSingle();

          if (recipient) {
            const now = new Date();
            await supabaseAdmin.from("email_click_events").insert({
              recipient_id: recipient.id,
              campaign_id: recipient.campaign_id,
              lead_id: recipient.lead_id,
              url: target.toString(),
              label,
              user_agent: request.headers.get("user-agent"),
              ip_address:
                request.headers.get("cf-connecting-ip") ??
                request.headers.get("x-forwarded-for"),
            });

            await supabaseAdmin
              .from("email_recipients")
              .update({
                click_count: (recipient.click_count ?? 0) + 1,
                last_clicked_at: now.toISOString(),
                first_clicked_at: recipient.first_clicked_at ?? now.toISOString(),
              })
              .eq("id", recipient.id);

            await supabaseAdmin
              .from("email_campaigns")
              .select("click_count")
              .eq("id", recipient.campaign_id)
              .maybeSingle()
              .then(async ({ data }) => {
                if (data) {
                  await supabaseAdmin
                    .from("email_campaigns")
                    .update({ click_count: (data.click_count ?? 0) + 1 })
                    .eq("id", recipient.campaign_id);
                }
              });

            // Dedupe rep alerts: one per prospect per DEDUPE_MINUTES window.
            const recent =
              recipient.last_clicked_at &&
              now.getTime() - new Date(recipient.last_clicked_at).getTime() <
                DEDUPE_MINUTES * 60_000;

            if (!recent) {
              const [{ data: lead }, { data: campaign }] = await Promise.all([
                supabaseAdmin
                  .from("leads")
                  .select("id, business_name, contact_name, owner_rep_id")
                  .eq("id", recipient.lead_id)
                  .maybeSingle(),
                supabaseAdmin
                  .from("email_campaigns")
                  .select("name")
                  .eq("id", recipient.campaign_id)
                  .maybeSingle(),
              ]);

              const who = lead?.business_name || lead?.contact_name || "A prospect";
              const what = label || target.hostname;
              const note = `Clicked "${what}" in email campaign${campaign?.name ? ` "${campaign.name}"` : ""}`;

              if (lead?.owner_rep_id) {
                await supabaseAdmin.from("activities").insert({
                  lead_id: lead.id,
                  rep_id: lead.owner_rep_id,
                  type: "email",
                  direction: "inbound",
                  outcome: "connected",
                  notes: note,
                  occurred_at: now.toISOString(),
                });

                await supabaseAdmin.from("tasks").insert({
                  lead_id: lead.id,
                  assigned_to: lead.owner_rep_id,
                  type: "callback",
                  title: `${who} clicked "${what}" — call now`,
                  due_at: now.toISOString(),
                  auto_generated: true,
                });

                await supabaseAdmin.from("notification_log").insert({
                  user_id: lead.owner_rep_id,
                  channel: "in_app",
                  event: "email_click",
                  recipient: lead.owner_rep_id,
                  subject: `${who} clicked your email`,
                  body: note,
                  status: "sent",
                  metadata: { lead_id: lead.id, campaign_id: recipient.campaign_id },
                });
              }
            }
          }
        } catch (e) {
          console.error("[email-click] tracking failed", e);
        }

        return Response.redirect(target.toString(), 302);
      },
    },
  },
});
