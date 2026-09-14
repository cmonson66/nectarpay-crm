CREATE OR REPLACE FUNCTION public.next_txc_deposit_index()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nextval('public.txc_deposit_address_index_seq')::integer;
$$;

REVOKE EXECUTE ON FUNCTION public.next_txc_deposit_index() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_txc_deposit_index() TO service_role;