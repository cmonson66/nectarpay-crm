CREATE TABLE public.affiliate_clickouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id text NOT NULL,
  target text NOT NULL,
  target_url text NOT NULL,
  user_agent text,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX affiliate_clickouts_affiliate_id_idx ON public.affiliate_clickouts(affiliate_id);
CREATE INDEX affiliate_clickouts_created_at_idx ON public.affiliate_clickouts(created_at DESC);
GRANT SELECT ON public.affiliate_clickouts TO authenticated;
GRANT ALL ON public.affiliate_clickouts TO service_role;
ALTER TABLE public.affiliate_clickouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read clickouts" ON public.affiliate_clickouts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));