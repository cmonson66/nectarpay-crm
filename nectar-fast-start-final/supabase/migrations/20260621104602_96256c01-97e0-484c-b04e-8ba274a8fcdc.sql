ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS webhook_secret TEXT;
REVOKE SELECT (webhook_secret) ON public.stores FROM authenticated;
REVOKE UPDATE (webhook_secret) ON public.stores FROM authenticated;
REVOKE INSERT (webhook_secret) ON public.stores FROM authenticated;
GRANT ALL ON public.stores TO service_role;