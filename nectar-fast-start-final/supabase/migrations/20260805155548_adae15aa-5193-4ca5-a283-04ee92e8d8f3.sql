-- 1. Multiple managers per team
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'rep';

DO $$ BEGIN
  ALTER TABLE public.team_members
    ADD CONSTRAINT team_members_role_chk CHECK (role IN ('manager','rep'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill: existing single team manager becomes a team_members manager row
INSERT INTO public.team_members (team_id, user_id, role)
SELECT t.id, t.manager_id, 'manager'
  FROM public.teams t
 WHERE t.manager_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.team_members m
      WHERE m.team_id = t.id AND m.user_id = t.manager_id AND m.left_at IS NULL
   );

UPDATE public.team_members m
   SET role = 'manager'
  FROM public.teams t
 WHERE t.id = m.team_id AND t.manager_id = m.user_id AND m.left_at IS NULL;

-- 2. Visibility: admins see all; managers see every member of any team they
--    manage (via teams.manager_id OR a team_members manager row); everyone sees self.
CREATE OR REPLACE FUNCTION public.visible_rep_ids(_user_id uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.user_id FROM public.profiles p
    WHERE public.has_role(_user_id, 'admin')
  UNION
  SELECT tm.user_id FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE t.manager_id = _user_id AND tm.left_at IS NULL
  UNION
  SELECT tm.user_id
    FROM public.team_members tm
    WHERE tm.left_at IS NULL
      AND tm.team_id IN (
        SELECT mgr.team_id FROM public.team_members mgr
         WHERE mgr.user_id = _user_id AND mgr.role = 'manager' AND mgr.left_at IS NULL
      )
  UNION
  SELECT _user_id;
$function$;

-- 3. Devices were readable by every signed-in user. Scope them the same way:
--    unassigned inventory stays visible, assigned units follow the hierarchy.
DROP POLICY IF EXISTS "devices read all staff" ON public.devices;
CREATE POLICY "devices readable in scope" ON public.devices
  FOR SELECT TO authenticated
  USING (
    assigned_rep_id IS NULL
    OR assigned_rep_id IN (SELECT public.visible_rep_ids(auth.uid()))
  );
