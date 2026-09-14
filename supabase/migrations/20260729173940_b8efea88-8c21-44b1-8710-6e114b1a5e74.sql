DROP POLICY "Leads updatable in scope" ON public.leads;
DROP POLICY "Leads readable in scope" ON public.leads;

CREATE POLICY "Leads readable in scope" ON public.leads FOR SELECT TO authenticated
USING (
  owner_rep_id IN (SELECT public.visible_rep_ids(auth.uid()))
  OR (owner_rep_id IS NULL AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')))
);

CREATE POLICY "Leads updatable in scope" ON public.leads FOR UPDATE TO authenticated
USING (owner_rep_id IN (SELECT public.visible_rep_ids(auth.uid())))
WITH CHECK (owner_rep_id IS NOT NULL AND owner_rep_id IN (SELECT public.visible_rep_ids(auth.uid())));

CREATE POLICY "Managers claim unowned leads" ON public.leads FOR UPDATE TO authenticated
USING (owner_rep_id IS NULL AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')))
WITH CHECK (
  (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  AND (owner_rep_id IS NULL OR owner_rep_id IN (SELECT public.visible_rep_ids(auth.uid())))
);