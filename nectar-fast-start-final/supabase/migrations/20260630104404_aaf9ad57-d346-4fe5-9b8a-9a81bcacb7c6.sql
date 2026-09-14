
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS admin_market text,
  ADD COLUMN IF NOT EXISTS admin_rep text,
  ADD COLUMN IF NOT EXISTS admin_notes text;
