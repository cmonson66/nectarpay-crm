// Bulk email campaigns with click tracking. Audience selection runs as the
// signed-in user (RLS scopes it), sending and tracking writes run server-side.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_RECIPIENTS = 500;

/** Prospects the caller may email: has an address, not opted out, not DNC. */
export const getEmailAudience = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("leads")
      .select("id, business_name, contact_name, contact_email, status, email_opted_out_at, owner_rep_id")
      .not("contact_email", "is", null)
      .neq("status", "do_not_contact")
      .is("email_opted_out_at", null)
      .order("business_name", { ascending: true })
      .limit(2000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listEmailCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("email_campaigns")
      .select(
        "id, name, subject, status, total_count, sent_count, failed_count, click_count, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getEmailCampaign = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: campaign }, { data: recipients }, { data: clicks }] = await Promise.all([
      context.supabase.from("email_campaigns").select("*").eq("id", data.id).maybeSingle(),
      context.supabase
        .from("email_recipients")
        .select("id, lead_id, email, status, opened_at, first_clicked_at, click_count, unsubscribed_at")
        .eq("campaign_id", data.id)
        .order("click_count", { ascending: false })
        .limit(1000),
      context.supabase
        .from("email_click_events")
        .select("id, lead_id, url, label, clicked_at")
        .eq("campaign_id", data.id)
        .order("clicked_at", { ascending: false })
        .limit(200),
    ]);
    return { campaign, recipients: recipients ?? [], clicks: clicks ?? [] };
  });

/** Recent click activity across every campaign the caller can see. */
export const listRecentEmailClicks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("email_click_events")
      .select("id, lead_id, campaign_id, url, label, clicked_at")
      .order("clicked_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const sendSchema = z.object({
  name: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(8000),
  ctaLabel: z.string().trim().max(60).optional().or(z.literal("")),
  ctaUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  leadIds: z.array(z.string().uuid()).min(1).max(MAX_RECIPIENTS),
});

export const sendEmailCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => sendSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: adminRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRow) throw new Error("Only a super admin can send campaigns.");

    const { data: leads, error: leadErr } = await supabase
      .from("leads")
      .select("id, business_name, contact_name, contact_email, status, email_opted_out_at")
      .in("id", data.leadIds);
    if (leadErr) throw new Error(leadErr.message);

    const eligible = (leads ?? []).filter(
      (l) => l.contact_email && !l.email_opted_out_at && l.status !== "do_not_contact",
    );
    if (eligible.length === 0) throw new Error("No eligible recipients in that selection.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Drop globally suppressed addresses (bounces, complaints).
    const emails = eligible.map((l) => (l.contact_email as string).toLowerCase());
    const { data: suppressed } = await supabaseAdmin
      .from("suppressed_emails")
      .select("email")
      .in("email", emails);
    const blocked = new Set((suppressed ?? []).map((s) => s.email.toLowerCase()));
    const targets = eligible.filter((l) => !blocked.has((l.contact_email as string).toLowerCase()));
    if (targets.length === 0) throw new Error("Every selected address is suppressed.");

    const { data: campaign, error: campErr } = await supabase
      .from("email_campaigns")
      .insert({
        name: data.name,
        subject: data.subject,
        body: data.body,
        cta_label: data.ctaLabel || null,
        cta_url: data.ctaUrl || null,
        status: "sending",
        total_count: targets.length,
        created_by: userId,
      })
      .select("id")
      .single();
    if (campErr) throw new Error(campErr.message);

    const { applyTokens, renderCampaignEmail, EMAIL_FROM, EMAIL_SENDER_DOMAIN } = await import(
      "@/lib/email-campaigns.server"
    );

    let sent = 0;
    let failed = 0;

    for (const lead of targets) {
      const email = lead.contact_email as string;
      const { data: recipient, error: recErr } = await supabaseAdmin
        .from("email_recipients")
        .insert({ campaign_id: campaign.id, lead_id: lead.id, email, status: "queued" })
        .select("id")
        .single();
      if (recErr || !recipient) {
        failed += 1;
        continue;
      }

      const rendered = renderCampaignEmail({
        recipientId: recipient.id,
        subject: applyTokens(data.subject, lead),
        body: applyTokens(data.body, lead),
        ctaLabel: data.ctaLabel || null,
        ctaUrl: data.ctaUrl || null,
      });

      const messageId = crypto.randomUUID();
      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: "campaign",
        recipient_email: email,
        status: "pending",
      });

      const { error: queueErr } = await supabaseAdmin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          message_id: messageId,
          idempotency_key: messageId,
          to: email,
          from: EMAIL_FROM,
          sender_domain: EMAIL_SENDER_DOMAIN,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          purpose: "transactional",
          label: "campaign",
          queued_at: new Date().toISOString(),
        },
      });

      if (queueErr) {
        failed += 1;
        await supabaseAdmin
          .from("email_recipients")
          .update({ status: "failed", error: queueErr.message })
          .eq("id", recipient.id);
        continue;
      }

      sent += 1;
      await supabaseAdmin
        .from("email_recipients")
        .update({ status: "sent", message_id: messageId })
        .eq("id", recipient.id);

      await supabaseAdmin.from("activities").insert({
        lead_id: lead.id,
        rep_id: userId,
        type: "email",
        direction: "outbound",
        notes: `Email campaign: ${data.name}`,
        occurred_at: new Date().toISOString(),
      });
    }

    await supabase
      .from("email_campaigns")
      .update({ status: "sent", sent_count: sent, failed_count: failed })
      .eq("id", campaign.id);

    return {
      ok: true,
      campaignId: campaign.id,
      sent,
      failed,
      skipped: (leads?.length ?? 0) - targets.length,
    };
  });
