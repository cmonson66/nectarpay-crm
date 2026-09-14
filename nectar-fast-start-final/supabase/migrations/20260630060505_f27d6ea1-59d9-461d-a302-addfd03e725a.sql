REVOKE EXECUTE ON FUNCTION public.get_merchant_map_pins() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_merchant_map_pins() TO service_role;