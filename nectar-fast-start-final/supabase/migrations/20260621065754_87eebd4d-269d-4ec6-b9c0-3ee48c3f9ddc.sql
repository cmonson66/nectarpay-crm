-- 1) api_keys.secret_hash: only server-side (service_role) may read
REVOKE SELECT (secret_hash) ON public.api_keys FROM authenticated;
REVOKE SELECT (secret_hash) ON public.api_keys FROM anon;

-- 2) stores: hide KYC provider credentials from owners' SELECT
REVOKE SELECT (kyc_advanced_api_key, kyc_advanced_app_token) ON public.stores FROM authenticated;
REVOKE SELECT (kyc_advanced_api_key, kyc_advanced_app_token) ON public.stores FROM anon;

-- 3) watcher_cursors: restrict to admins
DROP POLICY IF EXISTS "Anyone signed in can see watcher health" ON public.watcher_cursors;
CREATE POLICY "Admins can read watcher health"
  ON public.watcher_cursors
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));