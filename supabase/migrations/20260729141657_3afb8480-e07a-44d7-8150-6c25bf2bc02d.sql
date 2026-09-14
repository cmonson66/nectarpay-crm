-- ============ 1. Roles ============
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'rep';

-- Widen has_role so manager scope can be evaluated for any user.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- ============ 2. Teams ============
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  manager_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  region text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX team_members_active_unique
  ON public.team_members (team_id, user_id) WHERE left_at IS NULL;
CREATE INDEX team_members_user_idx ON public.team_members (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER teams_set_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ 3. Visibility helper ============
CREATE OR REPLACE FUNCTION public.visible_rep_ids(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.user_id FROM public.profiles p
    WHERE public.has_role(_user_id, 'admin')
  UNION
  SELECT tm.user_id FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE t.manager_id = _user_id AND tm.left_at IS NULL
  UNION
  SELECT _user_id;
$$;

REVOKE ALL ON FUNCTION public.visible_rep_ids(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.visible_rep_ids(uuid) TO authenticated, service_role;

CREATE POLICY "Teams readable by members and admins" ON public.teams
  FOR SELECT TO authenticated
  USING (manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
         OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = id AND tm.user_id = auth.uid()));
CREATE POLICY "Admins manage teams" ON public.teams
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team members readable in scope" ON public.team_members
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.visible_rep_ids(auth.uid())));
CREATE POLICY "Admins manage team members" ON public.team_members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ 4. Profiles ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS hire_date date,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS assigned_phone_number text;

CREATE POLICY "Profiles readable in scope" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.visible_rep_ids(auth.uid())));

-- ============ 5. New-user trigger grants rep ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  display_name text;
BEGIN
  display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (user_id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email, display_name, NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'rep')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- ============ 6. Leads -> prospect businesses ============
CREATE TYPE public.lead_status AS ENUM
  ('new', 'contacted', 'thinking', 'contingent', 'won', 'lost', 'do_not_contact');
CREATE TYPE public.lead_source AS ENUM
  ('cold_walk_in', 'referral', 'web_intake', 'campaign', 'manual');

DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.leads;

ALTER TABLE public.leads RENAME COLUMN name TO contact_name;
ALTER TABLE public.leads RENAME COLUMN email TO contact_email;
ALTER TABLE public.leads RENAME COLUMN phone TO contact_phone_e164;
ALTER TABLE public.leads RENAME COLUMN business TO business_name;

ALTER TABLE public.leads
  ALTER COLUMN contact_name DROP NOT NULL,
  ALTER COLUMN contact_email DROP NOT NULL,
  ALTER COLUMN market DROP NOT NULL,
  ALTER COLUMN interest DROP NOT NULL;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric,
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS referred_by_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_rep_id uuid,
  ADD COLUMN IF NOT EXISTS sms_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_opted_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_opted_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

UPDATE public.leads SET owner_rep_id = assignee WHERE owner_rep_id IS NULL;
UPDATE public.leads SET business_name = COALESCE(NULLIF(business_name, ''), contact_name);
UPDATE public.leads SET last_activity_at = COALESCE(last_activity_at, last_contacted_at);

ALTER TABLE public.leads ALTER COLUMN status DROP DEFAULT;
UPDATE public.leads SET status = CASE lower(status)
  WHEN 'new' THEN 'new'
  WHEN 'contacted' THEN 'contacted'
  WHEN 'in_progress' THEN 'contacted'
  WHEN 'qualified' THEN 'thinking'
  WHEN 'thinking' THEN 'thinking'
  WHEN 'contingent' THEN 'contingent'
  WHEN 'won' THEN 'won'
  WHEN 'closed' THEN 'won'
  WHEN 'lost' THEN 'lost'
  WHEN 'archived' THEN 'lost'
  WHEN 'spam' THEN 'do_not_contact'
  WHEN 'do_not_contact' THEN 'do_not_contact'
  ELSE 'new' END;
ALTER TABLE public.leads
  ALTER COLUMN status TYPE public.lead_status USING status::public.lead_status;
ALTER TABLE public.leads ALTER COLUMN status SET DEFAULT 'new';

UPDATE public.leads SET source = CASE lower(coalesce(source, ''))
  WHEN 'website' THEN 'web_intake'
  WHEN 'web' THEN 'web_intake'
  WHEN 'web_intake' THEN 'web_intake'
  WHEN 'referral' THEN 'referral'
  WHEN 'campaign' THEN 'campaign'
  WHEN 'cold_walk_in' THEN 'cold_walk_in'
  ELSE 'manual' END;
ALTER TABLE public.leads
  ALTER COLUMN source TYPE public.lead_source USING source::public.lead_source;
ALTER TABLE public.leads
  ALTER COLUMN source SET DEFAULT 'manual',
  ALTER COLUMN source SET NOT NULL;

CREATE INDEX IF NOT EXISTS leads_owner_rep_idx ON public.leads (owner_rep_id);
CREATE INDEX IF NOT EXISTS leads_status_idx ON public.leads (status);
CREATE INDEX IF NOT EXISTS leads_last_activity_idx ON public.leads (last_activity_at DESC NULLS LAST);

DROP POLICY IF EXISTS "Admins can view leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can update leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can delete leads" ON public.leads;

CREATE POLICY "Leads readable in scope" ON public.leads
  FOR SELECT TO authenticated
  USING (owner_rep_id IS NULL OR owner_rep_id IN (SELECT public.visible_rep_ids(auth.uid())));
CREATE POLICY "Leads insertable in scope" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (owner_rep_id IS NULL OR owner_rep_id IN (SELECT public.visible_rep_ids(auth.uid())));
CREATE POLICY "Leads updatable in scope" ON public.leads
  FOR UPDATE TO authenticated
  USING (owner_rep_id IS NULL OR owner_rep_id IN (SELECT public.visible_rep_ids(auth.uid())))
  WITH CHECK (owner_rep_id IS NULL OR owner_rep_id IN (SELECT public.visible_rep_ids(auth.uid())));
CREATE POLICY "Admins delete leads" ON public.leads
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can submit a lead" ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    (contact_email IS NULL OR (length(contact_email) >= 3 AND length(contact_email) <= 320
      AND contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
    AND (contact_name IS NULL OR (length(contact_name) >= 1 AND length(contact_name) <= 200))
    AND (business_name IS NULL OR length(business_name) <= 200)
    AND (market IS NULL OR length(market) <= 100)
    AND (interest IS NULL OR length(interest) <= 200)
    AND (message IS NULL OR length(message) <= 5000)
    AND (telegram IS NULL OR length(telegram) <= 100)
    AND status = 'new'::public.lead_status
    AND source = 'web_intake'::public.lead_source
    AND assignee IS NULL
    AND owner_rep_id IS NULL
    AND admin_notes IS NULL
  );

-- ============ 7. Activities ============
CREATE TYPE public.activity_type AS ENUM ('call', 'email', 'sms', 'visit', 'note', 'meeting');
CREATE TYPE public.activity_direction AS ENUM ('outbound', 'inbound');
CREATE TYPE public.activity_outcome AS ENUM
  ('connected', 'no_answer', 'gatekeeper', 'pitched', 'objection', 'not_interested');

CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  rep_id uuid NOT NULL,
  type public.activity_type NOT NULL,
  direction public.activity_direction NOT NULL DEFAULT 'outbound',
  outcome public.activity_outcome,
  notes text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activities_lead_idx ON public.activities (lead_id, occurred_at DESC);
CREATE INDEX activities_rep_idx ON public.activities (rep_id, occurred_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Activities readable in scope" ON public.activities
  FOR SELECT TO authenticated
  USING (rep_id IN (SELECT public.visible_rep_ids(auth.uid())));
CREATE POLICY "Activities insertable by owner" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (rep_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Activities updatable by owner" ON public.activities
  FOR UPDATE TO authenticated
  USING (rep_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (rep_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Activities deletable by owner" ON public.activities
  FOR DELETE TO authenticated
  USING (rep_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.activities_touch_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.leads
     SET last_activity_at = GREATEST(COALESCE(last_activity_at, NEW.occurred_at), NEW.occurred_at),
         first_contacted_at = LEAST(COALESCE(first_contacted_at, NEW.occurred_at), NEW.occurred_at),
         updated_at = now()
   WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.activities_touch_lead() FROM PUBLIC;

CREATE TRIGGER activities_touch_lead_trg
  AFTER INSERT ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.activities_touch_lead();