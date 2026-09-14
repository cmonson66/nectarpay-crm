// Server-only: renders and queues the temporary-credentials email that goes out
// when an admin invites someone or issues a fresh temp password.
import { escapeHtml, baseUrl, EMAIL_FROM, EMAIL_SENDER_DOMAIN } from "@/lib/email-campaigns.server";

export interface CredentialEmailOpts {
  to: string;
  password: string;
  fullName?: string | null;
  kind: "invite" | "reset";
}

function render(opts: CredentialEmailOpts) {
  const url = `${baseUrl()}/auth`;
  const name = opts.fullName?.trim() || opts.to.split("@")[0];
  const invite = opts.kind === "invite";
  const subject = invite
    ? "Your NectarPay CRM account is ready"
    : "Your NectarPay CRM temporary password";
  const lead = invite
    ? "An account was created for you in the NectarPay CRM. Sign in with the temporary password below — you'll be asked to choose your own password right away."
    : "A new temporary password was issued for your NectarPay CRM account. Sign in with it below and you'll be asked to choose a new password.";

  const text = [
    `Hi ${name},`,
    "",
    lead,
    "",
    `Sign-in page: ${url}`,
    `Email: ${opts.to}`,
    `Temporary password: ${opts.password}`,
    "",
    "This password is single-use — it stops working once you set your own.",
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#0f172a;font-family:'Plus Jakarta Sans',Segoe UI,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px;">
      <tr><td>
        <p style="margin:0 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#b45309;font-weight:700;">NectarPay CRM</p>
        <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">${escapeHtml(invite ? "Your account is ready" : "Your temporary password")}</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">Hi ${escapeHtml(name)}, ${escapeHtml(lead)}</p>
        <table role="presentation" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:0 0 20px;">
          <tr><td style="font-size:13px;color:#64748b;padding-bottom:4px;">Email</td></tr>
          <tr><td style="font-size:15px;color:#0f172a;font-weight:600;padding-bottom:12px;">${escapeHtml(opts.to)}</td></tr>
          <tr><td style="font-size:13px;color:#64748b;padding-bottom:4px;">Temporary password</td></tr>
          <tr><td style="font-size:18px;color:#0f172a;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(opts.password)}</td></tr>
        </table>
        <a href="${url}" style="display:inline-block;background:#f59e0b;color:#0f172a;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:15px;">Sign in</a>
        <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b;">This password is single-use — it stops working once you set your own. If you weren't expecting this, contact your administrator.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  return { subject, html, text };
}

/** Queues the credentials email. Never throws — returns whether it was queued. */
export async function sendCredentialsEmail(
  db: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }> },
  opts: CredentialEmailOpts,
): Promise<{ emailed: boolean; error?: string }> {
  const rendered = render(opts);
  const messageId = crypto.randomUUID();
  const label = opts.kind === "invite" ? "user-invite" : "password-reset";
  const payload = {
    message_id: messageId,
    idempotency_key: messageId,
    to: opts.to,
    from: EMAIL_FROM,
    sender_domain: EMAIL_SENDER_DOMAIN,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    purpose: "transactional" as const,
    label,
  };

  // Credentials are time-critical, so send inline instead of relying on the
  // background queue drainer.
  try {
    const { sendLovableEmail } = await import("@lovable.dev/email-js");
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
    await sendLovableEmail(payload, { apiKey, sendUrl: process.env["LOVABLE_SEND_URL"] });
    try {
      await (db as unknown as {
        from: (t: string) => { insert: (v: Record<string, unknown>) => Promise<unknown> };
      })
        .from("email_send_log")
        .insert({
          message_id: messageId,
          template_name: label,
          recipient_email: opts.to,
          status: "sent",
        });
    } catch {
      /* logging is best-effort */
    }
    return { emailed: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send the email.";
    // Fall back to the queue so the message isn't lost.
    try {
      const { error } = await db.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: { ...payload, queued_at: new Date().toISOString() },
      });
      if (error) return { emailed: false, error: error.message };
    } catch {
      return { emailed: false, error: message };
    }
    return { emailed: false, error: message };
  }
}

