REVOKE SELECT (secret_hash) ON public.api_keys FROM authenticated, anon;
REVOKE INSERT (secret_hash), UPDATE (secret_hash) ON public.api_keys FROM authenticated, anon;
GRANT ALL ON public.api_keys TO service_role;

REVOKE SELECT (webhook_secret_hash) ON public.stores FROM authenticated, anon;
REVOKE INSERT (webhook_secret_hash), UPDATE (webhook_secret_hash) ON public.stores FROM authenticated, anon;
-- Re-assert the earlier revokes in case they regressed.
REVOKE SELECT (webhook_secret, kyc_advanced_api_key, kyc_advanced_app_token) ON public.stores FROM authenticated, anon;
REVOKE INSERT (webhook_secret, kyc_advanced_api_key, kyc_advanced_app_token) ON public.stores FROM authenticated, anon;
REVOKE UPDATE (webhook_secret, kyc_advanced_api_key, kyc_advanced_app_token) ON public.stores FROM authenticated, anon;
GRANT ALL ON public.stores TO service_role;