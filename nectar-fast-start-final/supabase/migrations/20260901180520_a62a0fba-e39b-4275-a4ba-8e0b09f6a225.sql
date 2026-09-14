GRANT EXECUTE ON FUNCTION public.visible_rep_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_rep_directory() TO authenticated;