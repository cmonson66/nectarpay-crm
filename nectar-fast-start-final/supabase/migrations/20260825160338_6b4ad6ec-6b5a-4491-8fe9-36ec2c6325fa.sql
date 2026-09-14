DROP POLICY IF EXISTS "devices claim inventory on sale" ON public.devices;
CREATE POLICY "devices claim inventory on sale" ON public.devices
  FOR UPDATE TO authenticated
  USING (
    status IN ('in_inventory', 'returned')
    AND assigned_rep_id IS NULL
  )
  WITH CHECK (
    assigned_rep_id = auth.uid()
    AND status IN ('sold', 'placed_contingent', 'assigned_to_rep')
  );