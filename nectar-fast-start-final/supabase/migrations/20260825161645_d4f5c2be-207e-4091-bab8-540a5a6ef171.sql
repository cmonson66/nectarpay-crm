ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS coin_id text;

ALTER TABLE public.devices ADD CONSTRAINT devices_coin_id_format CHECK (coin_id IS NULL OR coin_id ~ '^\d{6}$');

CREATE UNIQUE INDEX IF NOT EXISTS devices_coin_id_unique ON public.devices (coin_id) WHERE coin_id IS NOT NULL;

COMMENT ON COLUMN public.devices.coin_id IS 'Optional 6-digit coin key linked to this terminal.';