
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS affiliate_id text;
CREATE INDEX IF NOT EXISTS profiles_affiliate_id_idx ON public.profiles(affiliate_id) WHERE affiliate_id IS NOT NULL;

CREATE TABLE public.affiliate_attributions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  affiliate_id text NOT NULL,
  landing_path text,
  first_seen_at timestamptz,
  signup_at timestamptz NOT NULL DEFAULT now(),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX affiliate_attributions_affiliate_id_idx ON public.affiliate_attributions(affiliate_id);
CREATE INDEX affiliate_attributions_signup_at_idx ON public.affiliate_attributions(signup_at DESC);

GRANT SELECT ON public.affiliate_attributions TO authenticated;
GRANT ALL ON public.affiliate_attributions TO service_role;

ALTER TABLE public.affiliate_attributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own attribution"
  ON public.affiliate_attributions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER affiliate_attributions_updated_at
  BEFORE UPDATE ON public.affiliate_attributions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
