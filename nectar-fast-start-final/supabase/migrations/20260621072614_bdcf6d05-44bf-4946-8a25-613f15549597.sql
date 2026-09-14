REVOKE EXECUTE ON FUNCTION public.purge_expired_wallet_challenges() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;