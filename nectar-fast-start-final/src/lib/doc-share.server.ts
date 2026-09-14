/**
 * Signed, expiring share tokens for customer-facing deal paperwork.
 *
 * The token is handed to the customer as a QR code on the payment
 * confirmation screen and lets them download the signed contract and the
 * paid invoice without an account.
 */
import { createHmac, timingSafeEqual } from "crypto";

const DEFAULT_TTL_DAYS = 30;

function secret(): string {
  const value =
    process.env["DOC_SHARE_SECRET"] ??
    process.env["NECTARPAY_WEBHOOK_SECRET"] ??
    process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!value) throw new Error("Document sharing is not configured");
  return value;
}

const b64url = (input: string | Buffer) =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function sign(payload: string): string {
  return b64url(createHmac("sha256", secret()).update(payload).digest());
}

/** Creates `<dealId>.<expiresAtMs>.<signature>` encoded for a URL path. */
export function createDealDocsToken(dealId: string, ttlDays = DEFAULT_TTL_DAYS): string {
  const expires = Date.now() + ttlDays * 86_400_000;
  const payload = `${dealId}.${expires}`;
  return `${b64url(payload)}.${sign(payload)}`;
}

/** Returns the deal id when the token is authentic and unexpired. */
export function readDealDocsToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  let payload: string;
  try {
    payload = Buffer.from(encoded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return null;
  }
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const [dealId, expiresRaw] = payload.split(".");
  const expires = Number(expiresRaw);
  if (!dealId || !Number.isFinite(expires) || Date.now() > expires) return null;
  return dealId;
}
