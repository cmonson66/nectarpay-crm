
ALTER TABLE public.chain_configs
  ADD COLUMN IF NOT EXISTS stables text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS token_symbol text;
