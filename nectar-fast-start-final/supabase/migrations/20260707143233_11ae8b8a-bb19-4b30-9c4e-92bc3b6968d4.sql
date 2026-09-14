-- Swap admin allowlist: tim@honest.money in, tim@blockchainmint.com out.
CREATE OR REPLACE FUNCTION public.grant_admin_for_allowlisted_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) IN ('bobby@honest.money', 'tim@honest.money') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- Revoke admin from tim@blockchainmint.com (demo merchant now).
DELETE FROM public.user_roles
WHERE role = 'admin'
  AND user_id = 'ae8b6f61-fc87-4420-98d0-e1be477d0516';

-- If tim@honest.money already exists and is confirmed, grant now.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE lower(u.email) = 'tim@honest.money'
  AND u.email_confirmed_at IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;