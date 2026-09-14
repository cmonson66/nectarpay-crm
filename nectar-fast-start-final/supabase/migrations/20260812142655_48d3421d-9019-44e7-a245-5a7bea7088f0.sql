DROP POLICY IF EXISTS "managers create campaigns" ON public.campaigns;
CREATE POLICY "admins create campaigns" ON public.campaigns FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "managers create email campaigns" ON public.email_campaigns;
CREATE POLICY "admins create email campaigns" ON public.email_campaigns FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "owners update campaigns" ON public.campaigns;
CREATE POLICY "admins update campaigns" ON public.campaigns FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "owners update email campaigns" ON public.email_campaigns;
CREATE POLICY "admins update email campaigns" ON public.email_campaigns FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));