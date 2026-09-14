
-- Revoke public/anon EXECUTE on SECURITY DEFINER functions that should not be
-- callable by anonymous callers via the Data API (PostgREST RPC).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owns_store(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.txc_balance(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_subscription_active(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.purge_expired_wallet_challenges() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_txc_deposit_index() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;

-- Trigger-only functions: not meant to be invoked directly by any Data API caller.
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.chain_configs_audit_xpub() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_admin_for_allowlisted_email() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;

-- Keep get_merchant_map_pins() callable by anon on purpose — powers the public
-- /where merchant map. The function already masks fields per listing_visibility.
GRANT EXECUTE ON FUNCTION public.get_merchant_map_pins() TO anon, authenticated;
