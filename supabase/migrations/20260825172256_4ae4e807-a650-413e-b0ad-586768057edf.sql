CREATE TABLE public.rep_salaries (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  weekly_salary numeric NOT NULL DEFAULT 0 CHECK (weekly_salary >= 0),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rep_salaries TO authenticated;
GRANT ALL ON public.rep_salaries TO service_role;
ALTER TABLE public.rep_salaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage salaries" ON public.rep_salaries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER rep_salaries_set_updated_at BEFORE UPDATE ON public.rep_salaries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.pnl_settings (
  key text NOT NULL PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pnl_settings TO authenticated;
GRANT ALL ON public.pnl_settings TO service_role;
ALTER TABLE public.pnl_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage pnl settings" ON public.pnl_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER pnl_settings_set_updated_at BEFORE UPDATE ON public.pnl_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.commissions ADD COLUMN week_start date;
UPDATE public.commissions c
   SET week_start =
     (d.closed_at AT TIME ZONE 'America/New_York')::date
     - EXTRACT(dow FROM (d.closed_at AT TIME ZONE 'America/New_York')::date)::int
  FROM public.deals d
 WHERE d.id = c.deal_id
   AND d.closed_at IS NOT NULL;
CREATE INDEX commissions_week_start_idx ON public.commissions (week_start);