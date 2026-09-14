CREATE TABLE public.alchemy_webhooks (
  chain text PRIMARY KEY,
  webhook_id text NOT NULL,
  signing_key text NOT NULL,
  callback_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.alchemy_webhooks TO service_role;

ALTER TABLE public.alchemy_webhooks ENABLE ROW LEVEL SECURITY;

-- No policies: this table is read/written only by service_role (server functions / webhook receiver).

CREATE TRIGGER alchemy_webhooks_set_updated_at
BEFORE UPDATE ON public.alchemy_webhooks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();