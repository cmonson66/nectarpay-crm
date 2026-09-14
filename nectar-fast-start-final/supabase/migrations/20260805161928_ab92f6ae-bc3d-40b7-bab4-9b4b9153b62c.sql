DROP POLICY IF EXISTS "campaigns readable" ON public.campaigns;
CREATE POLICY "campaigns readable in scope" ON public.campaigns
FOR SELECT TO authenticated
USING (created_by IN (SELECT public.visible_rep_ids(auth.uid())) OR public.has_role(auth.uid(), 'admin'));