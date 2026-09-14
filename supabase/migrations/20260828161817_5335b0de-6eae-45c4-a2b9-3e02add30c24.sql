DROP POLICY IF EXISTS "Admins delete leads" ON public.leads;
CREATE POLICY "Leads deletable in scope" ON public.leads
FOR DELETE TO authenticated
USING (owner_rep_id IN (SELECT public.visible_rep_ids(auth.uid())));