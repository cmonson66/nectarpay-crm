DROP POLICY IF EXISTS "devices claim inventory on sale" ON public.devices;

CREATE POLICY "devices claim inventory on deal"
ON public.devices
FOR UPDATE
TO authenticated
USING (
  status IN ('in_inventory'::public.device_status, 'returned'::public.device_status)
  AND assigned_rep_id IS NULL
)
WITH CHECK (
  assigned_rep_id = auth.uid()
  AND current_lead_id IS NOT NULL
  AND status IN ('sold'::public.device_status, 'placed_contingent'::public.device_status)
);