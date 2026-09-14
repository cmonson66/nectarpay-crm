DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.leads;

CREATE POLICY "Anyone can submit a lead"
ON public.leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(email) BETWEEN 3 AND 320
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND length(name) BETWEEN 1 AND 200
  AND length(market) <= 100
  AND length(interest) <= 200
  AND (message IS NULL OR length(message) <= 5000)
  AND (telegram IS NULL OR length(telegram) <= 100)
  AND status = 'new'
  AND assignee IS NULL
  AND admin_notes IS NULL
);