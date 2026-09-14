ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS ext_ref_mode text NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS ext_ref_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ext_ref_label text,
  ADD COLUMN IF NOT EXISTS ext_ref_scan_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_mode text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS tax_bps integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pos_quick_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pos_custom_tenders jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pos_refund_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pos_void_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pos_hold_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pos_other_tender_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pos_eod_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pos_require_cashier_pin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS receipt_email_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS receipt_sms_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS receipt_reprint_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_allowed_chains text[],
  ADD COLUMN IF NOT EXISTS default_display_currency text,
  ADD COLUMN IF NOT EXISTS pos_refund_reasons text[] NOT NULL DEFAULT ARRAY['Customer request','Item out of stock','Duplicate charge','Wrong amount','Other']::text[];

ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_ext_ref_mode_chk;
ALTER TABLE public.stores
  ADD CONSTRAINT stores_ext_ref_mode_chk
  CHECK (ext_ref_mode IN ('off','prompt_before','prompt_after'));

ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_tax_mode_chk;
ALTER TABLE public.stores
  ADD CONSTRAINT stores_tax_mode_chk
  CHECK (tax_mode IN ('none','inclusive','added'));