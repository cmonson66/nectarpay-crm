# NectarPay ← Partner Sale Notification

Partner sites (BlockchainMint, mineTXC, IDMC) notify us when a sale carrying
one of our affiliate codes reaches `payment_status = 'paid'`. This lets us
attribute external revenue to the affiliate who drove the traffic.

**Direction:** Partner → NectarPay (one call per confirmed order).

## Route

`POST https://nectar-pay.com/api/public/v1/hooks/affiliate-sale`

Stable URLs also work:
- `https://project--faa7c23e-4f75-4eed-8c8c-23234e4242f7.lovable.app/api/public/v1/hooks/affiliate-sale`

## Auth

Bearer token (required):

```
Authorization: Bearer <NECTARPAY_AFFILIATE_SECRET>
```

Optional HMAC signature (recommended; enforced if present):

```
X-Nectar-Signature: t=<unix_seconds>,v1=<hex>
```

Where `v1 = HMAC_SHA256(secret, `${t}.${rawBody}`)`. 5-minute replay window.

Same secret value lives on both sides:
- **NectarPay:** `NECTARPAY_AFFILIATE_SECRET`
- **Partner:** call it whatever you want (e.g. `NECTARPAY_AFFILIATE_SECRET`)

Ask the NectarPay admin for the value — it is generated once and stored in
our secret store; it will not be sent in the clear.

## Request body

```jsonc
{
  "source": "blockchainmint",          // "blockchainmint" | "minetxc" | "idmc"
  "external_order_id": "bm_ord_01H…",  // your internal id — our idempotency key
  "order_number": "BM-24601",          // optional, human-friendly
  "affiliate_code": "ABC12345",        // the code you received via ?ref=
  "total_usd": 727,
  "currency": "USD",                   // defaults to "USD"
  "paid_at": "2026-07-14T10:12:00Z",   // ISO timestamp of the paid transition
  "customer_email_hash": "sha256:…"    // optional; do NOT send plaintext email
}
```

## Response

`200 OK`:

```jsonc
{ "ok": true, "id": "…", "deduped": false }
```

`deduped: true` when we've already recorded `(source, external_order_id)` —
the endpoint is idempotent, so retrying is safe.

Errors: `401` (bad bearer / bad signature / stale timestamp), `400` (bad
body), `500` (misconfigured or DB error). Body: `{ "error": "…" }`.

## Trigger semantics

- Fire **once**, on the **first** transition to `payment_status = 'paid'`.
- Do **not** re-fire on later status changes.
- Refunds/cancellations: separate `POST /api/public/v1/hooks/affiliate-refund`
  (not built yet) that references the same `external_order_id`.

## What we do with it

1. Verify bearer + optional HMAC.
2. Resolve `affiliate_code` → `affiliate_user_id` via our `affiliate_codes`
   table (best-effort; unknown codes are still logged for audit).
3. Insert one row in `affiliate_external_sales` keyed on
   `(source, external_order_id)`.
4. That row surfaces on the affiliate's `/affiliate` dashboard as attributed
   external revenue.

## Example curl

```bash
BODY='{"source":"blockchainmint","external_order_id":"bm_ord_test_1","order_number":"BM-1","affiliate_code":"ABC12345","total_usd":727,"currency":"USD","paid_at":"2026-07-14T10:12:00Z"}'
T=$(date +%s)
SIG="t=$T,v1=$(printf "%s.%s" "$T" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')"
curl -sS -X POST https://nectar-pay.com/api/public/v1/hooks/affiliate-sale \
  -H "Authorization: Bearer $SECRET" \
  -H "X-Nectar-Signature: $SIG" \
  -H "Content-Type: application/json" \
  -d "$BODY"
```
