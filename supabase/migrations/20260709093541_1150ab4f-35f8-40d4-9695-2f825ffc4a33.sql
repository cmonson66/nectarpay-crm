
CREATE TABLE public.merchant_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  telegram text,
  postal_code text NOT NULL,
  country text NOT NULL DEFAULT 'US',
  radius_miles integer NOT NULL DEFAULT 10,
  lat double precision,
  lng double precision,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT merchant_alerts_contact_check CHECK (
    (email IS NOT NULL AND length(email) > 0)
    OR (telegram IS NOT NULL AND length(telegram) > 0)
  )
);

GRANT INSERT ON public.merchant_alerts TO anon, authenticated;
GRANT ALL ON public.merchant_alerts TO service_role;

ALTER TABLE public.merchant_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no_direct_reads" ON public.merchant_alerts FOR SELECT TO authenticated USING (false);
