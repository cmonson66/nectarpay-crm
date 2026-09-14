import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toE164 } from "@/lib/phone";


const MARKETS = [
  "Dallas / Fort Worth",
  "Los Angeles",
  "Denver",
  "Salt Lake",
  "Nashville",
  "Singapore",
  "Other",
] as const;

const INTERESTS = [
  "Become a merchant",
  "Onramp demo",
  "Sales rep",
  "Open a market",
  "Support / question",
  "Other",
] as const;

const SITE_NAME = "NectarPay";
const SENDER_DOMAIN = "notify.nectar-pay.com";
const FROM_DOMAIN = "nectar-pay.com";
const ADMIN_NOTIFY_EMAILS = ["bobby@honest.money", "tim@nectar-pay.com"];

async function marketManagerEmail(supabase: any, marketName: string): Promise<string | null> {
  const { data } = await supabase
    .from("markets")
    .select("manager_email, active")
    .eq("name", marketName)
    .maybeSingle();
  if (!data || !data.active) return null;
  const em = (data.manager_email || "").trim();
  return em || null;
}


const submitSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(60).optional().or(z.literal("")),
  telegram: z.string().trim().max(120).optional().or(z.literal("")),
  business: z.string().trim().max(200).optional().or(z.literal("")),
  preferred_time: z.string().trim().max(200).optional().or(z.literal("")),
  market: z.enum(MARKETS),
  interest: z.enum(INTERESTS),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  source: z.string().trim().max(120).optional().or(z.literal("")),
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function confirmationEmail(name: string, interest: string) {
  const first = name.split(/\s+/)[0] || "there";
  const subject = `We got your ${interest.toLowerCase()} request`;
  const text = `Hey ${first},

Thanks for reaching out to NectarPay. We got your request (${interest}) and a real human will be in touch shortly to book time.

If you need us sooner, just reply to this email.

— The NectarPay team
https://nectar-pay.com`;
  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0b0d;color:#eee;padding:32px;">
<div style="max-width:520px;margin:0 auto;background:#141418;border:1px solid #2a2a30;border-radius:12px;padding:28px;">
  <h1 style="margin:0 0 12px;font-size:20px;color:#f5c542;">Got it, ${escapeHtml(first)}.</h1>
  <p style="line-height:1.55;color:#ddd;">Thanks for reaching out to NectarPay. We got your request (<strong>${escapeHtml(interest)}</strong>) and a real human will be in touch shortly to book time with you.</p>
  <p style="line-height:1.55;color:#ddd;">If you need us sooner, just reply to this email — it goes straight to the team.</p>
  <p style="margin-top:24px;color:#888;font-size:13px;">— The NectarPay team<br/><a href="https://nectar-pay.com" style="color:#f5c542;">nectar-pay.com</a></p>
</div></body></html>`;
  return { subject, html, text };
}

function adminEmail(data: z.infer<typeof submitSchema>) {
  const subject = `New lead: ${data.name} (${data.interest}) — ${data.market}`;
  const lines = [
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    data.phone ? `Phone: ${data.phone}` : null,
    data.telegram ? `Telegram: ${data.telegram}` : null,
    data.business ? `Business: ${data.business}` : null,
    `Market: ${data.market}`,
    `Interest: ${data.interest}`,
    data.preferred_time ? `Preferred time: ${data.preferred_time}` : null,
    `Source: ${data.source || "unknown"}`,
    "",
    data.message ? `Message:\n${data.message}` : null,
  ].filter(Boolean);
  const text = lines.join("\n");
  const rows = lines
    .map((l) => `<div style="padding:4px 0;color:#ddd;white-space:pre-wrap;">${escapeHtml(l as string)}</div>`)
    .join("");
  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0b0d;color:#eee;padding:24px;">
<div style="max-width:640px;margin:0 auto;background:#141418;border:1px solid #2a2a30;border-radius:12px;padding:24px;">
  <h1 style="margin:0 0 12px;font-size:18px;color:#f5c542;">New lead — ${escapeHtml(data.interest)}</h1>
  ${rows}
  <p style="margin-top:20px;"><a href="https://nectar-pay.com/crm/leads" style="color:#f5c542;">Open in admin →</a></p>
</div></body></html>`;
  return { subject, html, text };
}

async function enqueueTransactional(
  supabase: any,
  to: string,
  subject: string,
  html: string,
  text: string,
  label: string,
) {
  const messageId = crypto.randomUUID();
  await supabase.from("email_send_log").insert({
    message_id: messageId,
    template_name: label,
    recipient_email: to,
    status: "pending",
  });
  const { error } = await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      idempotency_key: messageId,
      to,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: "transactional",
      label,
      queued_at: new Date().toISOString(),
    },
  });
  if (error) {
    console.error("[leads] enqueue failed", { label, to, error });
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: label,
      recipient_email: to,
      status: "failed",
      error_message: "Failed to enqueue email",
    });
  }
}

export const submitLead = createServerFn({ method: "POST" })
  .inputValidator((d) => submitSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("leads").insert({
      contact_name: data.name,
      contact_email: data.email,
      contact_phone_e164: toE164(data.phone) || null,
      telegram: data.telegram || null,
      business_name: data.business || data.name,
      preferred_time: data.preferred_time || null,
      market: data.market,
      interest: data.interest,
      message: data.message || null,
      source: "web_intake" as const,
    });

    if (error) throw new Error(error.message);

    // Fire-and-forget email notifications (don't fail the submission if they hiccup)
    try {
      const conf = confirmationEmail(data.name, data.interest);
      await enqueueTransactional(
        supabaseAdmin,
        data.email,
        conf.subject,
        conf.html,
        conf.text,
        "lead-confirmation",
      );
      const admin = adminEmail(data);
      const recipients = new Set<string>(ADMIN_NOTIFY_EMAILS.map((e) => e.toLowerCase()));
      const managerEmail = await marketManagerEmail(supabaseAdmin, data.market);
      if (managerEmail) recipients.add(managerEmail.toLowerCase());
      for (const to of recipients) {
        await enqueueTransactional(supabaseAdmin, to, admin.subject, admin.html, admin.text, "lead-admin-notify");
      }

    } catch (e) {
      console.error("[leads] notification enqueue error", e);
    }

    return { ok: true };
  });

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const LEAD_STATUSES = [
  "new",
  "contacted",
  "thinking",
  "contingent",
  "won",
  "lost",
  "do_not_contact",
] as const;

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(LEAD_STATUSES).optional(),
  admin_notes: z.string().max(5000).optional(),
  follow_up_at: z.string().nullable().optional(),
  mark_contacted: z.boolean().optional(),
  market: z.enum(MARKETS).optional(),
});

export const updateLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: {
      status?: (typeof LEAD_STATUSES)[number];
      admin_notes?: string;
      follow_up_at?: string | null;
      last_contacted_at?: string;
      market?: string;
    } = {};
    if (data.status !== undefined) patch.status = data.status;
    if (data.admin_notes !== undefined) patch.admin_notes = data.admin_notes;
    if (data.follow_up_at !== undefined) patch.follow_up_at = data.follow_up_at;
    if (data.mark_contacted) patch.last_contacted_at = new Date().toISOString();
    if (data.market !== undefined) patch.market = data.market;
    const { error } = await supabaseAdmin.from("leads").update(patch).eq("id", data.id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Markets management ────────────────────────────────────────────────

export const listMarkets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("markets")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const marketUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/, "lowercase, digits, and dashes only"),
  manager_name: z.string().trim().max(120).optional().or(z.literal("")),
  manager_email: z.string().trim().email().max(255).optional().or(z.literal("")),
  manager_telegram: z.string().trim().max(120).optional().or(z.literal("")),
  active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export const upsertMarket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => marketUpsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      name: data.name,
      slug: data.slug,
      manager_name: data.manager_name || null,
      manager_email: data.manager_email || null,
      manager_telegram: data.manager_telegram || null,
      active: data.active,
      sort_order: data.sort_order,
      notes: data.notes || null,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("markets").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("markets").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteMarket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("markets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const LEAD_MARKETS = MARKETS;
export const LEAD_INTERESTS = INTERESTS;

