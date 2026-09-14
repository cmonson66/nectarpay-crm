-- Restrict stores.webhook_secret_hash from authenticated SELECT.
-- The hash is sensitive and should never be readable client-side; only the
-- service role (edge functions/webhook signer) needs to access it.

REVOKE SELECT (webhook_secret_hash) ON public.stores FROM authenticated;
REVOKE UPDATE (webhook_secret_hash) ON public.stores FROM authenticated;

-- Explicitly re-grant SELECT/UPDATE on every other column so PostgREST
-- continues to serve owner CRUD on the rest of the row.
GRANT SELECT (id, owner_id, name, website, fiat_currency, webhook_url,
              invoice_ttl_seconds, created_at, updated_at)
  ON public.stores TO authenticated;
GRANT UPDATE (name, website, fiat_currency, webhook_url,
              invoice_ttl_seconds, updated_at)
  ON public.stores TO authenticated;
GRANT INSERT (owner_id, name, website, fiat_currency, webhook_url,
              invoice_ttl_seconds)
  ON public.stores TO authenticated;
GRANT DELETE ON public.stores TO authenticated;

-- Service role keeps full access (used by edge functions / cron / watchers).
GRANT ALL ON public.stores TO service_role;