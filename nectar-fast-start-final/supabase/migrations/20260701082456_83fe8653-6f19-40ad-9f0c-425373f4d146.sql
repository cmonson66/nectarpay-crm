REVOKE EXECUTE ON FUNCTION public.get_merchant_map_pins() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_merchant_map_pins() TO authenticated, service_role;