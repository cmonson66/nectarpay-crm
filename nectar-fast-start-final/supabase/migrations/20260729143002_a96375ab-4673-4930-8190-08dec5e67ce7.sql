-- ── enums ────────────────────────────────────────────────
CREATE TYPE public.deal_type AS ENUM ('sale','contingent');
CREATE TYPE public.deal_status AS ENUM ('open','won','lost','converted','returned');
CREATE TYPE public.device_status AS ENUM ('in_inventory','assigned_to_rep','placed_contingent','sold','returned','lost','damaged');
CREATE TYPE public.placement_status AS ENUM ('active','converted','returned','overdue','extended');
CREATE TYPE public.task_type AS ENUM ('contingent_followup','contingent_pickup','callback','manual');

-- ── deals ────────────────────────────────────────────────
CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  rep_id uuid NOT NULL,
  type public.deal_type NOT NULL DEFAULT 'sale',
  status public.deal_status NOT NULL DEFAULT 'open',
  hardware_amount numeric(12,2) NOT NULL DEFAULT 499.00,
  subscription_monthly numeric(12,2) NOT NULL DEFAULT 19.00,
  subscription_months integer NOT NULL DEFAULT 12,
  total_amount numeric(12,2) GENERATED ALWAYS AS
    (hardware_amount + subscription_monthly * subscription_months) STORED,
  notes text,
  closed_at timestamptz,
  converted_from_deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deals_lead_idx ON public.deals(lead_id);
CREATE INDEX deals_rep_idx ON public.deals(rep_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deals TO authenticated;
GRANT ALL ON public.deals TO service_role;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deals scoped read" ON public.deals FOR SELECT TO authenticated
  USING (rep_id IN (SELECT public.visible_rep_ids(auth.uid())));
CREATE POLICY "deals insert own" ON public.deals FOR INSERT TO authenticated
  WITH CHECK (rep_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "deals update scoped" ON public.deals FOR UPDATE TO authenticated
  USING (rep_id IN (SELECT public.visible_rep_ids(auth.uid())))
  WITH CHECK (rep_id IN (SELECT public.visible_rep_ids(auth.uid())));
CREATE POLICY "deals delete admin" ON public.deals FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER deals_set_updated_at BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── devices (CRM terminal inventory) ─────────────────────
CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number text NOT NULL UNIQUE,
  model text NOT NULL DEFAULT 'NectarPay POS',
  status public.device_status NOT NULL DEFAULT 'in_inventory',
  assigned_rep_id uuid,
  current_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devices TO authenticated;
GRANT ALL ON public.devices TO service_role;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "devices read all staff" ON public.devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "devices admin write" ON public.devices FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "devices update scoped" ON public.devices FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR assigned_rep_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'admin') OR assigned_rep_id = auth.uid());
CREATE POLICY "devices admin delete" ON public.devices FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER devices_set_updated_at BEFORE UPDATE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── contingent placements ────────────────────────────────
CREATE TABLE public.contingent_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  rep_id uuid NOT NULL,
  placed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  followup_due_at timestamptz NOT NULL DEFAULT (now() + interval '4 days'),
  followup_completed_at timestamptz,
  status public.placement_status NOT NULL DEFAULT 'active',
  outcome_notes text,
  picked_up_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX placements_lead_idx ON public.contingent_placements(lead_id);
CREATE INDEX placements_rep_idx ON public.contingent_placements(rep_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contingent_placements TO authenticated;
GRANT ALL ON public.contingent_placements TO service_role;
ALTER TABLE public.contingent_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "placements scoped read" ON public.contingent_placements FOR SELECT TO authenticated
  USING (rep_id IN (SELECT public.visible_rep_ids(auth.uid())));
CREATE POLICY "placements insert own" ON public.contingent_placements FOR INSERT TO authenticated
  WITH CHECK (rep_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "placements update scoped" ON public.contingent_placements FOR UPDATE TO authenticated
  USING (rep_id IN (SELECT public.visible_rep_ids(auth.uid())))
  WITH CHECK (rep_id IN (SELECT public.visible_rep_ids(auth.uid())));
CREATE POLICY "placements delete admin" ON public.contingent_placements FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER placements_set_updated_at BEFORE UPDATE ON public.contingent_placements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── tasks ────────────────────────────────────────────────
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  placement_id uuid REFERENCES public.contingent_placements(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL,
  type public.task_type NOT NULL DEFAULT 'manual',
  title text NOT NULL,
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  auto_generated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tasks_assigned_idx ON public.tasks(assigned_to);
CREATE UNIQUE INDEX tasks_auto_unique_idx ON public.tasks(placement_id, type)
  WHERE auto_generated AND placement_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks scoped read" ON public.tasks FOR SELECT TO authenticated
  USING (assigned_to IN (SELECT public.visible_rep_ids(auth.uid())));
CREATE POLICY "tasks insert scoped" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (assigned_to IN (SELECT public.visible_rep_ids(auth.uid())));
CREATE POLICY "tasks update scoped" ON public.tasks FOR UPDATE TO authenticated
  USING (assigned_to IN (SELECT public.visible_rep_ids(auth.uid())))
  WITH CHECK (assigned_to IN (SELECT public.visible_rep_ids(auth.uid())));
CREATE POLICY "tasks delete scoped" ON public.tasks FOR DELETE TO authenticated
  USING (assigned_to IN (SELECT public.visible_rep_ids(auth.uid())) OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER tasks_set_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── maintenance job: overdue placements + auto tasks ─────
CREATE OR REPLACE FUNCTION public.run_contingent_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  overdue_count int := 0;
  followup_count int := 0;
  pickup_count int := 0;
BEGIN
  WITH upd AS (
    UPDATE public.contingent_placements
       SET status = 'overdue'
     WHERE status = 'active' AND expires_at < now()
     RETURNING 1
  ) SELECT count(*) INTO overdue_count FROM upd;

  WITH ins AS (
    INSERT INTO public.tasks (lead_id, deal_id, placement_id, assigned_to, type, title, due_at, auto_generated)
    SELECT p.lead_id, p.deal_id, p.id, p.rep_id, 'contingent_followup',
           'Day-4 follow-up: ' || COALESCE(l.business_name, 'placement'),
           p.followup_due_at, true
      FROM public.contingent_placements p
      JOIN public.leads l ON l.id = p.lead_id
     WHERE p.followup_due_at < now()
       AND p.followup_completed_at IS NULL
       AND p.status IN ('active','extended')
    ON CONFLICT DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO followup_count FROM ins;

  WITH ins2 AS (
    INSERT INTO public.tasks (lead_id, deal_id, placement_id, assigned_to, type, title, due_at, auto_generated)
    SELECT p.lead_id, p.deal_id, p.id, p.rep_id, 'contingent_pickup',
           'Pick up or convert: ' || COALESCE(l.business_name, 'placement'),
           p.expires_at, true
      FROM public.contingent_placements p
      JOIN public.leads l ON l.id = p.lead_id
     WHERE p.status = 'overdue'
    ON CONFLICT DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO pickup_count FROM ins2;

  RETURN jsonb_build_object('overdue', overdue_count, 'followup_tasks', followup_count, 'pickup_tasks', pickup_count);
END;
$$;

REVOKE ALL ON FUNCTION public.run_contingent_maintenance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_contingent_maintenance() TO service_role;