REVOKE EXECUTE ON FUNCTION public.get_merchant_map_pins() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_merchant_map_pins() TO service_role;