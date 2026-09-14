REVOKE EXECUTE ON FUNCTION public.increment_affiliate_click(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_affiliate_click(text) TO service_role;