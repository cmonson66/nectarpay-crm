
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS pos_tip_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pos_signature_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pos_email_receipt_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS receipt_business_name TEXT,
  ADD COLUMN IF NOT EXISTS receipt_address TEXT,
  ADD COLUMN IF NOT EXISTS receipt_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS receipt_footer TEXT,
  ADD COLUMN IF NOT EXISTS receipt_tax_id TEXT;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS signature_data_url TEXT;
