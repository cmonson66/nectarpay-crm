
CREATE TABLE public.markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  manager_name text,
  manager_email text,
  manager_telegram text,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.markets TO authenticated;
GRANT ALL ON public.markets TO service_role;

ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage markets"
  ON public.markets FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER markets_set_updated_at
  BEFORE UPDATE ON public.markets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.markets (name, slug, sort_order) VALUES
  ('Dallas / Fort Worth', 'dfw', 10),
  ('Los Angeles', 'la', 20),
  ('Denver', 'denver', 30),
  ('Salt Lake', 'slc', 40),
  ('Nashville', 'nashville', 50),
  ('Singapore', 'singapore', 60)
ON CONFLICT (name) DO NOTHING;
