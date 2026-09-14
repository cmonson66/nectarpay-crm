
CREATE TABLE public.pos_releases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  apk_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  notes TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pos_releases TO anon;
GRANT SELECT ON public.pos_releases TO authenticated;
GRANT ALL ON public.pos_releases TO service_role;

ALTER TABLE public.pos_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "POS releases are publicly readable"
  ON public.pos_releases FOR SELECT
  USING (true);

CREATE INDEX pos_releases_published_at_idx
  ON public.pos_releases (published_at DESC);
