-- 1. Migrate assignee -> owner_rep_id, then drop assignee
UPDATE public.leads SET owner_rep_id = assignee WHERE assignee IS NOT NULL AND owner_rep_id IS NULL;

DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.leads;

ALTER TABLE public.leads DROP COLUMN assignee;

CREATE POLICY "Anyone can submit a lead" ON public.leads
FOR INSERT TO anon, authenticated
WITH CHECK (
  ((contact_email IS NULL) OR ((length(contact_email) >= 3) AND (length(contact_email) <= 320) AND (contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')))
  AND ((contact_name IS NULL) OR ((length(contact_name) >= 1) AND (length(contact_name) <= 200)))
  AND ((business_name IS NULL) OR (length(business_name) <= 200))
  AND ((market IS NULL) OR (length(market) <= 100))
  AND ((interest IS NULL) OR (length(interest) <= 200))
  AND ((message IS NULL) OR (length(message) <= 5000))
  AND ((telegram IS NULL) OR (length(telegram) <= 100))
  AND (status = 'new'::lead_status)
  AND (source = 'web_intake'::lead_source)
  AND (owner_rep_id IS NULL)
  AND (admin_notes IS NULL)
);

-- 2. Foreign keys to profiles.user_id (ON DELETE RESTRICT)
ALTER TABLE public.leads
  ADD CONSTRAINT leads_owner_rep_id_fkey FOREIGN KEY (owner_rep_id)
  REFERENCES public.profiles(user_id) ON DELETE RESTRICT;

ALTER TABLE public.activities
  ADD CONSTRAINT activities_rep_id_fkey FOREIGN KEY (rep_id)
  REFERENCES public.profiles(user_id) ON DELETE RESTRICT;

ALTER TABLE public.deals
  ADD CONSTRAINT deals_rep_id_fkey FOREIGN KEY (rep_id)
  REFERENCES public.profiles(user_id) ON DELETE RESTRICT;

ALTER TABLE public.contingent_placements
  ADD CONSTRAINT contingent_placements_rep_id_fkey FOREIGN KEY (rep_id)
  REFERENCES public.profiles(user_id) ON DELETE RESTRICT;

ALTER TABLE public.devices
  ADD CONSTRAINT devices_assigned_rep_id_fkey FOREIGN KEY (assigned_rep_id)
  REFERENCES public.profiles(user_id) ON DELETE RESTRICT;

ALTER TABLE public.quotas
  ADD CONSTRAINT quotas_rep_id_fkey FOREIGN KEY (rep_id)
  REFERENCES public.profiles(user_id) ON DELETE RESTRICT;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to)
  REFERENCES public.profiles(user_id) ON DELETE RESTRICT;

ALTER TABLE public.commissions
  ADD CONSTRAINT commissions_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES public.profiles(user_id) ON DELETE RESTRICT;