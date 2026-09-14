// Server-only helpers for bulk email campaigns: link signing, tracked-link
// rewriting, and HTML rendering. Never import this from browser code.

import { createHmac, timingSafeEqual } from "crypto";
import { BRAND, fonts } from "@/lib/email-templates/_brand";

export const EMAIL_FROM_DOMAIN = "nectar-pay.com";
export const EMAIL_SENDER_DOMAIN = "notify.nectar-pay.com";
export const EMAIL_FROM = `NectarPay <noreply@${EMAIL_FROM_DOMAIN}>`;

function secret(): string {
  return process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "nectarpay-email-fallback";
}

/** Signature over recipient id + destination so tracked links can't be forged. */
export function signLink(recipientId: string, url: string): string {
  return createHmac("sha256", secret()).update(`${recipientId}|${url}`).digest("base64url");
}

export function verifyLink(recipientId: string, url: string, sig: string): boolean {
  const expected = signLink(recipientId, url);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig || "");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function baseUrl(): string {
  const explicit = process.env["PUBLIC_BASE_URL"];
  if (explicit) return explicit.replace(/\/+$/, "");
  return "https://crm.nectar-pay.com";
}

export function trackedUrl(recipientId: string, url: string, label?: string): string {
  const q = new URLSearchParams({ r: recipientId, u: url, s: signLink(recipientId, url) });
  if (label) q.set("l", label.slice(0, 80));
  return `${baseUrl()}/api/public/e/click?${q.toString()}`;
}

export function unsubscribeUrl(recipientId: string): string {
  const q = new URLSearchParams({ r: recipientId, s: signLink(recipientId, "unsubscribe") });
  return `${baseUrl()}/api/public/e/unsubscribe?${q.toString()}`;
}

export function openPixelUrl(recipientId: string): string {
  const q = new URLSearchParams({ r: recipientId, s: signLink(recipientId, "open") });
  return `${baseUrl()}/api/public/e/open?${q.toString()}`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function applyTokens(
  template: string,
  lead: { business_name?: string | null; contact_name?: string | null },
): string {
  const first = (lead.contact_name ?? "").split(/\s+/)[0] ?? "";
  return template
    .replaceAll("{business}", lead.business_name ?? "")
    .replaceAll("{contact}", lead.contact_name ?? "")
    .replaceAll("{first}", first);
}

/** Rewrites every bare http(s) link in the plain-text body into a tracked link. */
function linkifyTracked(text: string, recipientId: string): string {
  return text.replace(/https?:\/\/[^\s<>"')]+/g, (url) => trackedUrl(recipientId, url));
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderCampaignEmail(opts: {
  recipientId: string;
  subject: string;
  body: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}): RenderedEmail {
  const { recipientId } = opts;
  const unsub = unsubscribeUrl(recipientId);

  const paragraphs = opts.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const htmlParagraphs = paragraphs
    .map((p) => {
      const withLinks = escapeHtml(p).replace(/https?:\/\/[^\s<>"')]+/g, (url) => {
        const href = trackedUrl(recipientId, url);
        return `<a href="${href}" style="color:${BRAND.honeyDeep};">${escapeHtml(url)}</a>`;
      });
      return `<p style="margin:0 0 16px;line-height:1.6;color:${BRAND.ink};font-size:15px;">${withLinks.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");

  const ctaHtml =
    opts.ctaLabel && opts.ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr><td style="background:${BRAND.honey};border-radius:10px;">
<a href="${trackedUrl(recipientId, opts.ctaUrl, opts.ctaLabel)}" style="display:inline-block;padding:13px 26px;color:${BRAND.navy};font-weight:700;font-size:15px;text-decoration:none;">${escapeHtml(opts.ctaLabel)}</a>
</td></tr></table>`
      : "";

  const html = `<!doctype html><html><body style="margin:0;padding:24px 0;background:${BRAND.comb};font-family:${fonts};">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid ${BRAND.hairline};border-radius:18px;overflow:hidden;">
  <div style="background:${BRAND.navy};padding:22px 28px;border-bottom:3px solid ${BRAND.honey};">
    <p style="margin:0;color:#fff;font-size:20px;font-weight:900;">Nectar<span style="color:${BRAND.honey};">Pay</span></p>
  </div>
  <div style="padding:28px;">
    ${htmlParagraphs}
    ${ctaHtml}
  </div>
  <div style="padding:18px 28px;border-top:1px solid ${BRAND.hairline};background:${BRAND.mist};">
    <p style="margin:0;font-size:12px;color:${BRAND.slate};">
      NectarPay · <a href="${unsub}" style="color:${BRAND.slate};">Unsubscribe</a>
    </p>
  </div>
</div>
<img src="${openPixelUrl(recipientId)}" width="1" height="1" alt="" style="display:block;border:0;" />
</body></html>`;

  const text = `${linkifyTracked(opts.body, recipientId)}

${opts.ctaLabel && opts.ctaUrl ? `${opts.ctaLabel}: ${trackedUrl(recipientId, opts.ctaUrl, opts.ctaLabel)}\n\n` : ""}Unsubscribe: ${unsub}`;

  return { subject: opts.subject, html, text };
}
