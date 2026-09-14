ALTER TYPE public.deal_status ADD VALUE IF NOT EXISTS 'pending';

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS nectarpay_invoice_id text,
  ADD COLUMN IF NOT EXISTS nectarpay_checkout_url text,
  ADD COLUMN IF NOT EXISTS nectarpay_status text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS deals_nectarpay_invoice_id_idx ON public.deals (nectarpay_invoice_id);