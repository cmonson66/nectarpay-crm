REVOKE ALL ON FUNCTION public.visible_rep_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.visible_rep_ids(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.activities_touch_lead() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activities_touch_lead() TO service_role;