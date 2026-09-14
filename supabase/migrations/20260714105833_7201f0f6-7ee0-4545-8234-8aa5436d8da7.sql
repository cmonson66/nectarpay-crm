
CREATE TABLE public.affiliate_external_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('blockchainmint','minetxc','idmc')),
  external_order_id TEXT NOT NULL,
  order_number TEXT,
  affiliate_code TEXT NOT NULL,
  affiliate_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  total_usd NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  customer_email_hash TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, external_order_id)
);

CREATE INDEX affiliate_external_sales_affiliate_idx
  ON public.affiliate_external_sales (affiliate_user_id, paid_at DESC);
CREATE INDEX affiliate_external_sales_code_idx
  ON public.affiliate_external_sales (affiliate_code);

GRANT SELECT ON public.affiliate_external_sales TO authenticated;
GRANT ALL ON public.affiliate_external_sales TO service_role;

ALTER TABLE public.affiliate_external_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own external sales select"
  ON public.affiliate_external_sales
  FOR SELECT
  TO authenticated
  USING (auth.uid() = affiliate_user_id);

CREATE TRIGGER affiliate_external_sales_set_updated_at
  BEFORE UPDATE ON public.affiliate_external_sales
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
