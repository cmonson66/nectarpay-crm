-- ── enums ─────────────────────────────────────────────
CREATE TYPE public.commission_role AS ENUM ('rep','manager_override','gm_override');
CREATE TYPE public.commission_rate_type AS ENUM ('flat','percent');
CREATE TYPE public.commission_applies_to AS ENUM ('hardware','subscription','total');
CREATE TYPE public.commission_status AS ENUM ('pending','approved','paid','clawed_back');

-- ── quota_periods ─────────────────────────────────────
CREATE TABLE public.quota_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL UNIQUE,
  period_end date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quota_periods TO authenticated;
GRANT ALL ON public.quota_periods TO service_role;
ALTER TABLE public.quota_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "periods readable by signed-in users" ON public.quota_periods
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage periods" ON public.quota_periods
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ── quotas ────────────────────────────────────────────
CREATE TABLE public.quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id uuid NOT NULL,
  period_id uuid NOT NULL REFERENCES public.quota_periods(id) ON DELETE CASCADE,
  touches_target integer NOT NULL DEFAULT 50,
  sales_minimum integer NOT NULL DEFAULT 5,
  sales_target integer NOT NULL DEFAULT 20,
  contingents_target integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rep_id, period_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotas TO authenticated;
GRANT ALL ON public.quotas TO service_role;
ALTER TABLE public.quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quotas visible to hierarchy" ON public.quotas
  FOR SELECT TO authenticated
  USING (rep_id IN (SELECT public.visible_rep_ids(auth.uid())));
CREATE POLICY "admins manage quotas" ON public.quotas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER quotas_set_updated_at BEFORE UPDATE ON public.quotas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── commission_rules ──────────────────────────────────
CREATE TABLE public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_in_deal public.commission_role NOT NULL,
  rate_type public.commission_rate_type NOT NULL,
  rate_value numeric NOT NULL,
  applies_to public.commission_applies_to NOT NULL DEFAULT 'total',
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_rules TO authenticated;
GRANT ALL ON public.commission_rules TO service_role;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rules readable by signed-in users" ON public.commission_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage rules" ON public.commission_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER commission_rules_set_updated_at BEFORE UPDATE ON public.commission_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── commissions ───────────────────────────────────────
CREATE TABLE public.commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role_in_deal public.commission_role NOT NULL,
  rule_id uuid REFERENCES public.commission_rules(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  period_id uuid REFERENCES public.quota_periods(id) ON DELETE SET NULL,
  status public.commission_status NOT NULL DEFAULT 'pending',
  approved_by uuid,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, user_id, role_in_deal)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commissions TO authenticated;
GRANT ALL ON public.commissions TO service_role;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commissions visible to hierarchy" ON public.commissions
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.visible_rep_ids(auth.uid())));
CREATE POLICY "admins manage commissions" ON public.commissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER commissions_set_updated_at BEFORE UPDATE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX commissions_period_user_idx ON public.commissions (period_id, user_id);
CREATE INDEX quotas_period_idx ON public.quotas (period_id);

-- ── seed the last 8 weeks + current week ──────────────
INSERT INTO public.quota_periods (period_start, period_end, is_current)
SELECT d::date,
       (d + interval '6 days')::date,
       d::date = (date_trunc('week', now())::date)
FROM generate_series(
  date_trunc('week', now()) - interval '8 weeks',
  date_trunc('week', now()),
  interval '1 week'
) AS d
ON CONFLICT (period_start) DO NOTHING;

-- ── starter commission rules (admins can edit) ────────
INSERT INTO public.commission_rules (role_in_deal, rate_type, rate_value, applies_to)
VALUES
  ('rep','percent',10,'total'),
  ('manager_override','percent',2,'total'),
  ('gm_override','percent',1,'total');