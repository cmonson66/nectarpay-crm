DROP POLICY IF EXISTS "Teams readable by members and admins" ON public.teams;
CREATE POLICY "Teams readable by members and admins"
ON public.teams
FOR SELECT
TO authenticated
USING (
  manager_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = teams.id
      AND tm.user_id = auth.uid()
      AND tm.left_at IS NULL
  )
);