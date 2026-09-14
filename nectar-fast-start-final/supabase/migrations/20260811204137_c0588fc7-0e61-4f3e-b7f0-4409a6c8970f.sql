CREATE TABLE public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  cta_label text,
  cta_url text,
  status text NOT NULL DEFAULT 'draft',
  total_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  click_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaigns TO authenticated;
GRANT ALL ON public.email_campaigns TO service_role;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email campaigns readable in scope" ON public.email_campaigns
  FOR SELECT TO authenticated
  USING (created_by IN (SELECT public.visible_rep_ids(auth.uid())) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "managers create email campaigns" ON public.email_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')));
CREATE POLICY "owners update email campaigns" ON public.email_campaigns
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete email campaigns" ON public.email_campaigns
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER email_campaigns_set_updated_at
  BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.email_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  email text NOT NULL,
  message_id text,
  status text NOT NULL DEFAULT 'queued',
  error text,
  opened_at timestamptz,
  first_clicked_at timestamptz,
  last_clicked_at timestamptz,
  click_count integer NOT NULL DEFAULT 0,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX email_recipients_campaign_idx ON public.email_recipients(campaign_id);
CREATE INDEX email_recipients_lead_idx ON public.email_recipients(lead_id);

GRANT SELECT ON public.email_recipients TO authenticated;
GRANT ALL ON public.email_recipients TO service_role;
ALTER TABLE public.email_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email recipients readable in scope" ON public.email_recipients
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = email_recipients.lead_id
        AND (l.owner_rep_id IN (SELECT public.visible_rep_ids(auth.uid())) OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE TABLE public.email_click_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.email_recipients(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  url text NOT NULL,
  label text,
  user_agent text,
  ip_address text,
  clicked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX email_click_events_lead_idx ON public.email_click_events(lead_id);
CREATE INDEX email_click_events_campaign_idx ON public.email_click_events(campaign_id);

GRANT SELECT ON public.email_click_events TO authenticated;
GRANT ALL ON public.email_click_events TO service_role;
ALTER TABLE public.email_click_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email clicks readable in scope" ON public.email_click_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = email_click_events.lead_id
        AND (l.owner_rep_id IN (SELECT public.visible_rep_ids(auth.uid())) OR public.has_role(auth.uid(), 'admin'))
    )
  );