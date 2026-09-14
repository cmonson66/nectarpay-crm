ALTER TABLE public.txc_deposit_addresses
  ADD COLUMN IF NOT EXISTS address_index integer;

CREATE SEQUENCE IF NOT EXISTS public.txc_deposit_address_index_seq START 0 MINVALUE 0;

CREATE UNIQUE INDEX IF NOT EXISTS txc_deposit_addresses_address_index_uniq
  ON public.txc_deposit_addresses (address_index)
  WHERE address_index IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS txc_deposit_addresses_address_uniq
  ON public.txc_deposit_addresses (address);

GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.txc_deposit_address_index_seq TO service_role;