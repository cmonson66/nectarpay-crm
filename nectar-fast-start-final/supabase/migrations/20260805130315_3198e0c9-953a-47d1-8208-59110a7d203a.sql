CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  total_count int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns readable" ON public.campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "managers create campaigns" ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')));
CREATE POLICY "owners update campaigns" ON public.campaigns FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins delete campaigns" ON public.campaigns FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('outbound','inbound')),
  body text NOT NULL,
  from_number text,
  to_number text,
  twilio_sid text UNIQUE,
  status text NOT NULL DEFAULT 'queued',
  error text,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_lead_idx ON public.messages(lead_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages visible" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = messages.lead_id
    AND l.owner_rep_id IN (SELECT v FROM public.visible_rep_ids(auth.uid()) AS v)));
CREATE POLICY "messages insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = messages.lead_id
    AND l.owner_rep_id IN (SELECT v FROM public.visible_rep_ids(auth.uid()) AS v)));

CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound','inbound')),
  from_number text,
  to_number text,
  twilio_sid text UNIQUE,
  status text NOT NULL DEFAULT 'initiated',
  duration_seconds int,
  recording_url text,
  rep_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX calls_lead_idx ON public.calls(lead_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calls visible" ON public.calls FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = calls.lead_id
    AND l.owner_rep_id IN (SELECT v FROM public.visible_rep_ids(auth.uid()) AS v)));
CREATE POLICY "calls insert" ON public.calls FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = calls.lead_id
    AND l.owner_rep_id IN (SELECT v FROM public.visible_rep_ids(auth.uid()) AS v)));

INSERT INTO public.app_settings(key, value) VALUES ('twilio_from_number', '') ON CONFLICT DO NOTHING;