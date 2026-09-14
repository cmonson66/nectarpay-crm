ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS pos_tip_presets_bps integer[] NOT NULL DEFAULT ARRAY[1500, 1800, 2000];