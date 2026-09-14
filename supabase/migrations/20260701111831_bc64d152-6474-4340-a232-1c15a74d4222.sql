CREATE TABLE public.members_geo (
  id BIGSERIAL PRIMARY KEY,
  zip TEXT,
  state TEXT,
  city TEXT,
  country TEXT NOT NULL DEFAULT 'US',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.members_geo TO authenticated;
GRANT ALL ON public.members_geo TO service_role;

ALTER TABLE public.members_geo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read members_geo"
  ON public.members_geo FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX members_geo_country_idx ON public.members_geo (country);
CREATE INDEX members_geo_state_idx ON public.members_geo (state);