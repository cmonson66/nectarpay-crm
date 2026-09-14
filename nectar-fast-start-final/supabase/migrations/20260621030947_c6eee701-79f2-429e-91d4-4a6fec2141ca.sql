
CREATE TYPE public.kyc_level AS ENUM ('none','basic','advanced');
CREATE TYPE public.kyc_status AS ENUM ('not_required','pending','passed','failed');
CREATE TYPE public.kyc_provider AS ENUM ('none','sumsub','persona','didit','veriff');

ALTER TABLE public.stores
  ADD COLUMN kyc_level public.kyc_level NOT NULL DEFAULT 'none',
  ADD COLUMN kyc_threshold_usd numeric(20,4),
  ADD COLUMN kyc_basic_checks text[] NOT NULL DEFAULT ARRAY['sanctions','risk','geo']::text[],
  ADD COLUMN kyc_basic_require_email boolean NOT NULL DEFAULT false,
  ADD COLUMN kyc_advanced_provider public.kyc_provider NOT NULL DEFAULT 'none',
  ADD COLUMN kyc_advanced_api_key text,
  ADD COLUMN kyc_advanced_app_token text;

ALTER TABLE public.invoices
  ADD COLUMN kyc_level_override public.kyc_level,
  ADD COLUMN kyc_status public.kyc_status NOT NULL DEFAULT 'not_required',
  ADD COLUMN kyc_reference text,
  ADD COLUMN buyer_email text;

CREATE TABLE public.kyc_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  level public.kyc_level NOT NULL,
  provider public.kyc_provider NOT NULL DEFAULT 'none',
  status public.kyc_status NOT NULL DEFAULT 'pending',
  reference text,
  wallet_address text,
  sanctions_flag boolean,
  risk_score integer,
  risk_label text,
  country_code text,
  ip_blocked boolean,
  email_verified boolean,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kyc_verifications_invoice_idx ON public.kyc_verifications(invoice_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kyc_verifications TO authenticated;
GRANT ALL ON public.kyc_verifications TO service_role;
ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view kyc for own invoices"
  ON public.kyc_verifications FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_id AND public.owns_store(i.store_id)
  ));

CREATE TRIGGER kyc_verifications_set_updated_at
  BEFORE UPDATE ON public.kyc_verifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
