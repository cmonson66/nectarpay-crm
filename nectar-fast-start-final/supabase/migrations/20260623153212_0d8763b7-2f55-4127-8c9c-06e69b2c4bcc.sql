
ALTER TABLE public.chain_configs
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

-- Seed existing rows so each store's chains have a stable initial order.
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY created_at) - 1 AS rn
  FROM public.chain_configs
)
UPDATE public.chain_configs c
SET display_order = ordered.rn
FROM ordered
WHERE c.id = ordered.id AND c.display_order = 0;

CREATE INDEX IF NOT EXISTS chain_configs_store_order_idx
  ON public.chain_configs (store_id, display_order);
