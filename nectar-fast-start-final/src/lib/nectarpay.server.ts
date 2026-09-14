import { createHmac, timingSafeEqual } from "crypto";

const API_BASE = "https://app.nectar-pay.com";

export type NectarPayInvoice = {
  id: string;
  status: string;
  checkoutUrl: string | null;
  address: string | null;
};

function pick(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value) return value;
  }
  return null;
}

/** Create a hosted invoice on the Nectar.Pay gateway. */
export async function createNectarPayInvoice(input: {
  amount: number;
  chain: string;
  orderId: string;
  redirectUrl: string;
}): Promise<NectarPayInvoice> {
  const apiKey = process.env["NECTARPAY_API_KEY"];
  if (!apiKey) throw new Error("Nectar.Pay is not connected yet — add the gateway API key first.");

  const res = await fetch(`${API_BASE}/api/public/v1/invoices`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chain: input.chain,
      amount: Number(input.amount.toFixed(2)),
      currency: "USD",
      order_id: input.orderId,
      redirect_url: input.redirectUrl,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("[nectarpay] invoice create failed", res.status, text.slice(0, 500));
    throw new Error(
      res.status === 401
        ? "Nectar.Pay rejected the API key."
        : "Nectar.Pay could not create the invoice. Try again in a moment.",
    );
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Nectar.Pay returned an unexpected response.");
  }
  const invoice = (body["invoice"] as Record<string, unknown>) ?? body;

  const id = pick(invoice, ["id", "invoice_id", "uuid"]);
  if (!id) throw new Error("Nectar.Pay did not return an invoice id.");

  return {
    id,
    status: pick(invoice, ["status", "state"]) ?? "pending",
    checkoutUrl: pick(invoice, ["checkout_url", "payment_url", "hosted_url", "url"]),
    address: pick(invoice, ["address", "deposit_address"]),
  };
}

/**
 * Verify an `X-TXCPay-Signature: t=<unix>,v1=<hex>` header over the raw body.
 * Rejects signatures older than 5 minutes to stop replays.
 */
export function verifyNectarPaySignature(header: string | null, rawBody: string): boolean {
  const secret = process.env["NECTARPAY_WEBHOOK_SECRET"];
  if (!secret || !header) return false;

  const timestamp = header.match(/t=(\d+)/)?.[1];
  const signature = header.match(/v1=([a-f0-9]+)/)?.[1];
  if (!timestamp || !signature) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Map any gateway status string onto our outcomes. */
export function normalizeNectarPayStatus(status: string): "paid" | "underpaid" | "failed" | "pending" {
  const s = status.toLowerCase();
  if (["paid", "confirmed", "complete", "completed", "settled", "success"].includes(s)) return "paid";
  if (["underpaid"].includes(s)) return "underpaid";
  if (["expired", "cancelled", "canceled", "failed", "void"].includes(s)) return "failed";
  return "pending";
}
