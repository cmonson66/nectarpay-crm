
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS default_confirmations_required integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS mempool_max_usd numeric;

-- Backfill from existing per-chain values if present (pick max conf, max threshold)
UPDATE public.stores s SET
  default_confirmations_required = COALESCE(sub.confs, s.default_confirmations_required),
  mempool_max_usd = COALESCE(sub.zc, s.mempool_max_usd)
FROM (
  SELECT store_id,
         MAX(confirmations_required) AS confs,
         MAX(zero_conf_max_usd) AS zc
  FROM public.chain_configs
  GROUP BY store_id
) sub
WHERE s.id = sub.store_id;

ALTER TABLE public.chain_configs
  DROP COLUMN IF EXISTS confirmations_required,
  DROP COLUMN IF EXISTS zero_conf_max_usd;

GRANT SELECT (default_confirmations_required, mempool_max_usd),
      UPDATE (default_confirmations_required, mempool_max_usd)
  ON public.stores TO authenticated;
