ALTER TABLE public.deals
  ADD COLUMN device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL;

CREATE INDEX deals_device_idx ON public.deals(device_id);