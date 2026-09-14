CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT private.has_role(_user_id, _role)
$$;

CREATE OR REPLACE FUNCTION public.visible_rep_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT private.visible_rep_ids(_user_id)
$$;

CREATE OR REPLACE FUNCTION public.list_rep_directory()
RETURNS TABLE(user_id uuid, full_name text, email text, is_active boolean)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT * FROM private.list_rep_directory()
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.visible_rep_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_rep_directory() TO authenticated;