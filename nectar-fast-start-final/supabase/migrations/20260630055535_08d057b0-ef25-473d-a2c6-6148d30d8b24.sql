
-- 1. Lock search_path on email queue functions (search_path_mutable findings)
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pg_temp;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pg_temp;

-- 2. Revoke broad execute on all SECURITY DEFINER functions, then grant narrowly.
-- Email queue: only service_role (used by cron/edge processing).
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

-- Internal/admin helpers: not callable by anon or authenticated.
REVOKE EXECUTE ON FUNCTION public.purge_expired_wallet_challenges() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_wallet_challenges() TO service_role;

REVOKE EXECUTE ON FUNCTION public.next_txc_deposit_index() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_txc_deposit_index() TO service_role;

-- Trigger functions: never called directly through the API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.chain_configs_audit_xpub() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- RLS / subscription helpers: needed by authenticated users via policies and app reads.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owns_store(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_subscription_active(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.txc_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_store(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_subscription_active(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.txc_balance(uuid) TO authenticated, service_role;

-- Public merchant map: intentionally readable without sign-in.
-- Keep EXECUTE for anon and authenticated; function already filters sensitive columns server-side.
REVOKE EXECUTE ON FUNCTION public.get_merchant_map_pins() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_merchant_map_pins() TO anon, authenticated, service_role;
