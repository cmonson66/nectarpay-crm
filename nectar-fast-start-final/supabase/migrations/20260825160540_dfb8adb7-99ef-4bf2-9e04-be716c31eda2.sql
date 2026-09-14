REVOKE EXECUTE ON FUNCTION public.run_contingent_maintenance() FROM anon;
REVOKE EXECUTE ON FUNCTION public.run_contingent_maintenance() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.run_contingent_maintenance() TO service_role;