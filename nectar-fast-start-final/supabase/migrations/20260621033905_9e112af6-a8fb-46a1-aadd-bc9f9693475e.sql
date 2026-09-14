
-- Lock down trigger/internal SECURITY DEFINER functions: not user-callable
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_expired_wallet_challenges() FROM PUBLIC, anon, authenticated;

-- Helper functions used by RLS policies: only authenticated users need to call them
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owns_store(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_subscription_active(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.txc_balance(uuid) FROM PUBLIC, anon;

-- wallet_login_challenges has RLS on but no policy: add explicit deny-all for anon/authenticated.
-- Service role bypasses RLS and continues to manage the table from edge/server code.
DROP POLICY IF EXISTS "Deny all client access to wallet challenges" ON public.wallet_login_challenges;
CREATE POLICY "Deny all client access to wallet challenges"
ON public.wallet_login_challenges
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
