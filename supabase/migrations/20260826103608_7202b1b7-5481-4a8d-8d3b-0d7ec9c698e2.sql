ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS home_address text,
  ADD COLUMN IF NOT EXISTS home_lat numeric,
  ADD COLUMN IF NOT EXISTS home_lng numeric,
  ADD COLUMN IF NOT EXISTS location_sharing_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS google_place_id text;

CREATE UNIQUE INDEX IF NOT EXISTS leads_google_place_id_key
  ON public.leads (google_place_id) WHERE google_place_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.rep_locations (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  accuracy_meters numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rep_locations TO authenticated;
GRANT ALL ON public.rep_locations TO service_role;

ALTER TABLE public.rep_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visible reps' locations are readable"
  ON public.rep_locations FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.visible_rep_ids(auth.uid())));

CREATE POLICY "Users publish their own location"
  ON public.rep_locations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update their own location"
  ON public.rep_locations FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users clear their own location"
  ON public.rep_locations FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER rep_locations_set_updated_at
  BEFORE UPDATE ON public.rep_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();