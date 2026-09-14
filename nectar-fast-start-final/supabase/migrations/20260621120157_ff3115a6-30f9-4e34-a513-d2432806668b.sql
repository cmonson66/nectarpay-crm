ALTER TABLE public.chain_configs
  ADD COLUMN IF NOT EXISTS zero_conf_max_usd numeric,
  ADD COLUMN IF NOT EXISTS qr_address_only boolean NOT NULL DEFAULT false;