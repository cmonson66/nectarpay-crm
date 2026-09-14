REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.visible_rep_ids(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.list_rep_directory() FROM authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.visible_rep_ids(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_rep_directory() TO service_role;