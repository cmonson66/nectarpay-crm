# BlockchainMint Fulfillment Intake Endpoint

Nectar.Pay hosts its own crypto checkout for the Terminal Kit at
`/checkout`. When a buyer pays, the settled invoice hands the order off to
BlockchainMint by POSTing to a public endpoint on the BM side. BM then
creates its own internal order record and ships the physical kit.

**Direction:** Nectar.Pay → BlockchainMint (one call per confirmed order).

## Route

`POST /api/public/v1/external-orders`

Add this as a TSS server route on BlockchainMint.com under
`src/routes/api/public/v1/external-orders.ts`. The `/api/public/*` prefix
bypasses the site's app auth — verify the caller yourself.

## Auth

Bearer token in the `Authorization` header:

```
Authorization: Bearer <BM_FULFILLMENT_SECRET>
```

The same value lives as a secret on both sides:

- **Nectar.Pay side:** `BM_FULFILLMENT_SECRET`
- **BM side:** call it the same or something like `NECTARPAY_FULFILLMENT_SECRET`

Generate one strong random value (`openssl rand -hex 32`) and save it in both
projects' secret stores.

Nectar.Pay also stores the target URL as `BM_FULFILLMENT_URL`
(e.g. `https://blockchainmint.com/api/public/v1/external-orders`).

## Request body

```jsonc
{
  "external_order_id": "e3b0…",        // kit_orders.id on Nectar.Pay — use as idempotency key
  "source": "nectarpay",
  "email": "buyer@example.com",
  "full_name": "Jane Doe",
  "phone": "+1 512 555 0100",
  "shipping": {
    "line1": "123 Main St",
    "line2": null,
    "city": "Austin",
    "region": "TX",
    "postal_code": "78701",
    "country": "United States"
  },
  "line_items": [
    { "sku": "nectarpay-kit",        "name": "NectarPay Terminal Kit",         "qty": 1, "unit_price_usd": 499 },
    { "sku": "nectarpay-first-year", "name": "NectarPay First-Year Service",   "qty": 1, "unit_price_usd": 228 }
  ],
  "subtotal_usd": 727,
  "total_usd":    727,
  "payment": {
    "status": "paid",
    "invoice_id": "d17a…",           // Nectar.Pay invoices.id
    "currency": "USD"
  }
}
```

Notes:
- `line_items` always contains the kit. `nectarpay-first-year` is present
  only when the buyer opted in.
- Shipping is included in the total (flat rate baked in at $0 for v1).
  Add BM-side shipping later if you need per-country pricing.
- Nectar.Pay only calls this once payment has fully confirmed on-chain.

## Response

`200 OK` on success:

```jsonc
{
  "order_id": "bm_ord_01H…",   // BM's internal order id
  "order_number": "BM-24601"   // human-friendly order number
}
```

Both fields are stored on `kit_orders.bm_order_id` / `bm_order_number` and
shown on the buyer's `/checkout/thanks` page.

Non-2xx responses are recorded as `bm_failed` on Nectar.Pay's `kit_orders`
row along with the response body (first 500 chars) in `bm_last_error`. An
admin retry function (`retryKitOrderToBm`) will re-POST the same payload,
so the endpoint MUST be idempotent on `external_order_id`.

## Reference implementation (BM side)

```ts
// src/routes/api/public/v1/external-orders.ts
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { "Content-Type": "application/json", ...CORS },
  });

const Body = z.object({
  external_order_id: z.string().min(1).max(64),
  source: z.literal("nectarpay"),
  email: z.string().email(),
  full_name: z.string().min(1),
  phone: z.string().nullable().optional(),
  shipping: z.object({
    line1: z.string(),
    line2: z.string().nullable().optional(),
    city: z.string(),
    region: z.string().nullable().optional(),
    postal_code: z.string(),
    country: z.string(),
  }),
  line_items: z
    .array(
      z.object({
        sku: z.string(),
        name: z.string(),
        qty: z.number().int().positive(),
        unit_price_usd: z.number().nonnegative(),
      }),
    )
    .min(1),
  subtotal_usd: z.number().nonnegative(),
  total_usd: z.number().nonnegative(),
  payment: z.object({
    status: z.literal("paid"),
    invoice_id: z.string(),
    currency: z.string(),
  }),
});

export const Route = createFileRoute("/api/public/v1/external-orders")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const secret = process.env.NECTARPAY_FULFILLMENT_SECRET;
        const auth = request.headers.get("authorization") ?? "";
        if (!secret || auth !== `Bearer ${secret}`) {
          return json({ error: "Unauthorized" }, 401);
        }

        const raw = await request.json().catch(() => null);
        const parse = Body.safeParse(raw);
        if (!parse.success) {
          return json({ error: parse.error.errors[0]?.message ?? "Bad body" }, 400);
        }
        const body = parse.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotent on external_order_id.
        const { data: existing } = await supabaseAdmin
          .from("orders")
          .select("id, order_number")
          .eq("external_order_id", body.external_order_id)
          .maybeSingle();
        if (existing) {
          return json({ order_id: existing.id, order_number: existing.order_number });
        }

        // Create BM order in whatever shape BM's `orders` table expects.
        const { data: created, error } = await supabaseAdmin
          .from("orders")
          .insert({
            external_order_id: body.external_order_id,
            source: "nectarpay_external",
            payment_status: "paid",
            payhme_invoice_id: body.payment.invoice_id,
            customer_email: body.email,
            customer_name: body.full_name,
            phone: body.phone,
            ship_address_line1: body.shipping.line1,
            ship_address_line2: body.shipping.line2,
            ship_city: body.shipping.city,
            ship_region: body.shipping.region,
            ship_postal_code: body.shipping.postal_code,
            ship_country: body.shipping.country,
            subtotal_cents: Math.round(body.subtotal_usd * 100),
            total_cents: Math.round(body.total_usd * 100),
            items: body.line_items,
            status: "awaiting_fulfillment",
          })
          .select("id, order_number")
          .single();
        if (error || !created) return json({ error: error?.message ?? "Insert failed" }, 500);

        return json({ order_id: created.id, order_number: created.order_number });
      },
    },
  },
});
```

## Future: shipping status → back to Nectar.Pay

Once BM ships, POST back to
`https://nectar-pay.com/api/public/v1/hooks/kit-shipped` (not built yet)
with `{ external_order_id, tracking_number, carrier }` so we can flip
`kit_orders.status = 'shipped'` and email the buyer from our side too.
Not required for v1 — BM's own shipping email is enough.
