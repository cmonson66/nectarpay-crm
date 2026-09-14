// Notification dispatch — Telegram (via bot token) and Email (placeholder until
// the user runs the email-domain scaffold; logged to notification_log with
// status='skipped' meanwhile).

import { createHmac } from "crypto";

const TELEGRAM_API = "https://api.telegram.org";

export type NotifyEvent =
  | "invoice_paid"
  | "invoice_underpaid"
  | "invoice_expired"
  | "deposit_received"
  | "plan_renewed"
  | "grace_warning"
  | "security_xpub_change";

export interface NotifyPayload {
  event: NotifyEvent;
  subject: string;
  text: string;
  metadata?: Record<string, unknown>;
}

async function sendTelegram(
  token: string,
  chatId: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const json = (await res.json()) as { ok: boolean; description?: string };
    if (!json.ok) return { ok: false, error: json.description ?? `tg ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function notifyUser(
  userId: string,
  payload: NotifyPayload,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: prefs } = await supabaseAdmin
    .from("notification_prefs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const events = (prefs?.events as Record<string, boolean>) ?? {};
  if (events[payload.event] === false) return;

  // Telegram
  if (prefs?.telegram_enabled && prefs.telegram_chat_id) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      const tgText = `<b>${escapeHtml(payload.subject)}</b>\n${escapeHtml(payload.text)}`;
      const result = await sendTelegram(token, prefs.telegram_chat_id, tgText);
      await supabaseAdmin.from("notification_log").insert({
        user_id: userId,
        channel: "telegram",
        event: payload.event,
        recipient: prefs.telegram_chat_id,
        subject: payload.subject,
        body: payload.text,
        status: result.ok ? "sent" : "failed",
        error: result.error ?? null,
        metadata: (payload.metadata ?? null) as never,
      });
    }
  }

  // Email — logged as skipped until Lovable Emails infrastructure is scaffolded
  // (run email-domain setup; this dispatcher will be swapped to enqueue_email then).
  if (prefs?.email_enabled && prefs.email_address) {
    await supabaseAdmin.from("notification_log").insert({
      user_id: userId,
      channel: "email",
      event: payload.event,
      recipient: prefs.email_address,
      subject: payload.subject,
      body: payload.text,
      status: "skipped",
      error: "email provider not configured",
      metadata: (payload.metadata ?? null) as never,
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Stable per-token secret for the telegram webhook secret_token. */
export function deriveTelegramWebhookSecret(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN ?? "";
  return createHmac("sha256", "telegram-webhook").update(t).digest("base64url");
}
