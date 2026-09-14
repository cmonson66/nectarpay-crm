ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS payment_method text;
COMMENT ON COLUMN public.deals.payment_method IS 'Payment method selected when logging the deal (Check, ACH, Zelle, Plaid).';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deals_payment_method_check'
  ) THEN
    ALTER TABLE public.deals
    ADD CONSTRAINT deals_payment_method_check
    CHECK (payment_method IS NULL OR payment_method IN ('Check', 'ACH', 'Zelle', 'Plaid'));
  END IF;
END $$;