CREATE OR REPLACE FUNCTION public.list_rep_directory()
RETURNS TABLE(user_id uuid, full_name text, email text, is_active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name, p.email, p.is_active
  FROM public.profiles p
  WHERE (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'rep')
    )
    AND (
      p.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = p.user_id AND ur.role IN ('rep','manager')
      )
    )
  ORDER BY p.full_name NULLS LAST;
$$;

REVOKE EXECUTE ON FUNCTION public.list_rep_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_rep_directory() TO authenticated, service_role;