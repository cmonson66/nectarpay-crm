
-- notification_prefs
CREATE TABLE public.notification_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  email_address text,
  telegram_enabled boolean NOT NULL DEFAULT false,
  telegram_chat_id text,
  telegram_username text,
  events jsonb NOT NULL DEFAULT '{"invoice_paid":true,"invoice_underpaid":true,"invoice_expired":true,"deposit_received":true,"plan_renewed":true,"grace_warning":true}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_prefs TO authenticated;
GRANT ALL ON public.notification_prefs TO service_role;
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages prefs" ON public.notification_prefs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_notification_prefs_updated_at BEFORE UPDATE ON public.notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- notification_log
CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email','telegram')),
  event text NOT NULL,
  recipient text NOT NULL,
  subject text,
  body text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','skipped')),
  error text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own log" ON public.notification_log
  FOR SELECT USING (auth.uid() = user_id);
CREATE INDEX idx_notification_log_user_created ON public.notification_log(user_id, created_at DESC);

-- watcher_cursors
CREATE TABLE public.watcher_cursors (
  chain text PRIMARY KEY,
  last_height bigint NOT NULL DEFAULT 0,
  last_run_at timestamptz NOT NULL DEFAULT now(),
  last_status text,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.watcher_cursors TO authenticated;
GRANT ALL ON public.watcher_cursors TO service_role;
ALTER TABLE public.watcher_cursors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can see watcher health" ON public.watcher_cursors
  FOR SELECT TO authenticated USING (true);
CREATE TRIGGER set_watcher_cursors_updated_at BEFORE UPDATE ON public.watcher_cursors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.watcher_cursors (chain) VALUES ('btc'), ('txc'), ('eth'), ('base')
  ON CONFLICT DO NOTHING;

-- derived_addresses
CREATE TABLE public.derived_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_config_id uuid NOT NULL REFERENCES public.chain_configs(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  address text NOT NULL,
  address_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain_config_id, address_index),
  UNIQUE (address)
);
GRANT SELECT ON public.derived_addresses TO authenticated;
GRANT ALL ON public.derived_addresses TO service_role;
ALTER TABLE public.derived_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads derived addresses" ON public.derived_addresses
  FOR SELECT USING (public.owns_store(store_id));
CREATE INDEX idx_derived_addresses_address ON public.derived_addresses(address);

-- telegram_bind_codes
CREATE TABLE public.telegram_bind_codes (
  code text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.telegram_bind_codes TO authenticated;
GRANT ALL ON public.telegram_bind_codes TO service_role;
ALTER TABLE public.telegram_bind_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own bind codes" ON public.telegram_bind_codes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- chain_configs additions
ALTER TABLE public.chain_configs
  ADD COLUMN IF NOT EXISTS xpub text,
  ADD COLUMN IF NOT EXISTS derivation_path text,
  ADD COLUMN IF NOT EXISTS next_address_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS network text NOT NULL DEFAULT 'mainnet';

-- invoices additions
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS address_index integer;

-- Seed rates (using real schema: chain enum, fiat, rate)
INSERT INTO public.rates_cache (chain, fiat, rate, fetched_at) VALUES
  ('btc'::chain_kind, 'USD', 0, now()),
  ('eth'::chain_kind, 'USD', 0, now()),
  ('txc'::chain_kind, 'USD', 0.10, now())
ON CONFLICT DO NOTHING;

-- cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$ BEGIN PERFORM cron.unschedule('texitpay-rates-poll'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('texitpay-watcher-tick'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('texitpay-billing-rollover'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('texitpay-rates-poll', '*/2 * * * *', $$
  SELECT net.http_post(
    url := 'https://project--faa7c23e-4f75-4eed-8c8c-23234e4242f7.lovable.app/api/public/cron/rates',
    headers := jsonb_build_object('Content-Type','application/json','apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eGd3c2lvZ3BpdHZ4bW5keHF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5ODQ5NTYsImV4cCI6MjA5NzU2MDk1Nn0.uVGN4CmfqcrMFLFInIU7Sze2cB0MsStDBMn5EXyaTVw'),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('texitpay-watcher-tick', '* * * * *', $$
  SELECT net.http_post(
    url := 'https://project--faa7c23e-4f75-4eed-8c8c-23234e4242f7.lovable.app/api/public/cron/watcher',
    headers := jsonb_build_object('Content-Type','application/json','apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eGd3c2lvZ3BpdHZ4bW5keHF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5ODQ5NTYsImV4cCI6MjA5NzU2MDk1Nn0.uVGN4CmfqcrMFLFInIU7Sze2cB0MsStDBMn5EXyaTVw'),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('texitpay-billing-rollover', '0 * * * *', $$
  SELECT net.http_post(
    url := 'https://project--faa7c23e-4f75-4eed-8c8c-23234e4242f7.lovable.app/api/public/cron/billing',
    headers := jsonb_build_object('Content-Type','application/json','apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eGd3c2lvZ3BpdHZ4bW5keHF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5ODQ5NTYsImV4cCI6MjA5NzU2MDk1Nn0.uVGN4CmfqcrMFLFInIU7Sze2cB0MsStDBMn5EXyaTVw'),
    body := '{}'::jsonb
  );
$$);
