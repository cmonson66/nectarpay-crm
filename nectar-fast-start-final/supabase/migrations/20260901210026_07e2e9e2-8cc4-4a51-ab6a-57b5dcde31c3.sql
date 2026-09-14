CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

ALTER FUNCTION public.has_role(_user_id uuid, _role public.app_role) SET SCHEMA private;
ALTER FUNCTION public.visible_rep_ids(_user_id uuid) SET SCHEMA private;
ALTER FUNCTION public.list_rep_directory() SET SCHEMA private;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.visible_rep_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.list_rep_directory() TO authenticated;

REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.visible_rep_ids(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.list_rep_directory() FROM PUBLIC;