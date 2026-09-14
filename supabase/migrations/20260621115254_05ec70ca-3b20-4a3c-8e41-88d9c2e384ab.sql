
-- 1) Stop exposing plaintext store secrets to the store owner via the Data API.
REVOKE SELECT (webhook_secret, kyc_advanced_api_key, kyc_advanced_app_token)
  ON public.stores FROM authenticated;
REVOKE UPDATE (webhook_secret, kyc_advanced_api_key, kyc_advanced_app_token)
  ON public.stores FROM authenticated;
REVOKE INSERT (webhook_secret, kyc_advanced_api_key, kyc_advanced_app_token)
  ON public.stores FROM authenticated;

-- 2) Prevent cross-user role enumeration via has_role.
--    SECURITY DEFINER + explicit auth.uid() guard. RLS policies always call
--    has_role(auth.uid(), ...), so this does not break any existing checks.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;
