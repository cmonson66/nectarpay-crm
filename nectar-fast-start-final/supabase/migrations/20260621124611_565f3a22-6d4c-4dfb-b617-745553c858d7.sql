-- The previous column-level REVOKEs were ineffective because table-level
-- SELECT/INSERT/UPDATE grants were still present and override column REVOKEs.
-- Fix: revoke table-level privileges, then grant only the safe columns.

-- ============ stores ============
REVOKE SELECT, INSERT, UPDATE ON public.stores FROM authenticated, anon;

GRANT SELECT (
  id, owner_id, name, website, fiat_currency, webhook_url,
  invoice_ttl_seconds, created_at, updated_at,
  kyc_level, kyc_threshold_usd, kyc_basic_checks, kyc_basic_require_email,
  kyc_advanced_provider,
  default_confirmations_required, mempool_max_usd
) ON public.stores TO authenticated;

GRANT INSERT (
  id, owner_id, name, website, fiat_currency, webhook_url,
  invoice_ttl_seconds,
  kyc_level, kyc_threshold_usd, kyc_basic_checks, kyc_basic_require_email,
  kyc_advanced_provider,
  default_confirmations_required, mempool_max_usd
) ON public.stores TO authenticated;

GRANT UPDATE (
  name, website, fiat_currency, webhook_url,
  invoice_ttl_seconds,
  kyc_level, kyc_threshold_usd, kyc_basic_checks, kyc_basic_require_email,
  kyc_advanced_provider,
  default_confirmations_required, mempool_max_usd
) ON public.stores TO authenticated;

GRANT DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;

-- ============ api_keys ============
REVOKE SELECT, INSERT, UPDATE ON public.api_keys FROM authenticated, anon;

GRANT SELECT (
  id, store_id, label, prefix, last_used_at, revoked_at, created_at
) ON public.api_keys TO authenticated;

GRANT INSERT (
  id, store_id, label, prefix, last_used_at, revoked_at, created_at
) ON public.api_keys TO authenticated;

GRANT UPDATE (
  label, last_used_at, revoked_at
) ON public.api_keys TO authenticated;

GRANT DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
