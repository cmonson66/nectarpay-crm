
-- =========================================================================
-- ENUMS
-- =========================================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'merchant');
CREATE TYPE public.chain_kind AS ENUM ('btc', 'eth', 'base', 'txc', 'doge', 'isk', 'zcu');
CREATE TYPE public.invoice_status AS ENUM ('pending', 'detected', 'confirmed', 'underpaid', 'overpaid', 'expired', 'cancelled', 'failed');

-- =========================================================================
-- UPDATED_AT HELPER
-- =========================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================================
-- PROFILES
-- =========================================================================
CREATE TABLE public.profiles (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Default everyone to merchant role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'merchant')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- =========================================================================
-- USER ROLES
-- =========================================================================
CREATE TABLE public.user_roles (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role    public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Now create the trigger that references both profiles + user_roles
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- STORES
-- =========================================================================
CREATE TABLE public.stores (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  website              TEXT,
  fiat_currency        TEXT NOT NULL DEFAULT 'USD',
  webhook_url          TEXT,
  webhook_secret_hash  TEXT,
  invoice_ttl_seconds  INTEGER NOT NULL DEFAULT 900,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own stores"
  ON public.stores FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER stores_set_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX stores_owner_id_idx ON public.stores(owner_id);

-- Helper: is the caller the owner of this store?
CREATE OR REPLACE FUNCTION public.owns_store(_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = _store_id
      AND (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  );
$$;

-- =========================================================================
-- API KEYS
-- =========================================================================
CREATE TABLE public.api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  label        TEXT NOT NULL DEFAULT 'Default key',
  prefix       TEXT NOT NULL,
  secret_hash  TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- secret_hash is sensitive; restrict column-level SELECT.
GRANT SELECT (id, store_id, label, prefix, last_used_at, revoked_at, created_at),
      INSERT, UPDATE, DELETE
  ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own api keys"
  ON public.api_keys FOR ALL TO authenticated
  USING (public.owns_store(store_id))
  WITH CHECK (public.owns_store(store_id));

CREATE INDEX api_keys_store_id_idx ON public.api_keys(store_id);
CREATE INDEX api_keys_prefix_idx ON public.api_keys(prefix);

-- =========================================================================
-- CHAIN CONFIGS
-- =========================================================================
CREATE TABLE public.chain_configs (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                 UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  chain                    public.chain_kind NOT NULL,
  xpub_or_address          TEXT NOT NULL,
  derivation_path          TEXT,
  next_derivation_index    INTEGER NOT NULL DEFAULT 0,
  confirmations_required   INTEGER NOT NULL DEFAULT 2,
  enabled                  BOOLEAN NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, chain)
);

-- xpub_or_address is sensitive (read via server fn only).
GRANT SELECT (id, store_id, chain, derivation_path, next_derivation_index, confirmations_required, enabled, created_at, updated_at),
      INSERT, UPDATE, DELETE
  ON public.chain_configs TO authenticated;
GRANT ALL ON public.chain_configs TO service_role;

ALTER TABLE public.chain_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own chain configs"
  ON public.chain_configs FOR ALL TO authenticated
  USING (public.owns_store(store_id))
  WITH CHECK (public.owns_store(store_id));

CREATE TRIGGER chain_configs_set_updated_at
  BEFORE UPDATE ON public.chain_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX chain_configs_store_id_idx ON public.chain_configs(store_id);

-- =========================================================================
-- INVOICES
-- =========================================================================
CREATE TABLE public.invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  chain               public.chain_kind NOT NULL,
  fiat_amount         NUMERIC(20, 4) NOT NULL,
  fiat_currency       TEXT NOT NULL,
  crypto_amount       NUMERIC(40, 18) NOT NULL,
  rate                NUMERIC(40, 18) NOT NULL,
  address             TEXT NOT NULL,
  derivation_index    INTEGER NOT NULL,
  status              public.invoice_status NOT NULL DEFAULT 'pending',
  external_order_id   TEXT,
  description         TEXT,
  redirect_url        TEXT,
  expires_at          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (public.owns_store(store_id));

CREATE POLICY "Owners create own invoices"
  ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (public.owns_store(store_id));

CREATE POLICY "Owners update own invoices"
  ON public.invoices FOR UPDATE TO authenticated
  USING (public.owns_store(store_id))
  WITH CHECK (public.owns_store(store_id));

CREATE TRIGGER invoices_set_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX invoices_store_id_idx ON public.invoices(store_id);
CREATE INDEX invoices_status_idx ON public.invoices(status);
CREATE INDEX invoices_address_idx ON public.invoices(address);
CREATE INDEX invoices_expires_at_idx ON public.invoices(expires_at);

-- =========================================================================
-- TRANSACTIONS
-- =========================================================================
CREATE TABLE public.transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  tx_hash         TEXT NOT NULL,
  amount          NUMERIC(40, 18) NOT NULL,
  confirmations   INTEGER NOT NULL DEFAULT 0,
  block_height    BIGINT,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at    TIMESTAMPTZ,
  raw             JSONB,
  UNIQUE (invoice_id, tx_hash)
);

GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id AND public.owns_store(i.store_id)
    )
  );

CREATE INDEX transactions_invoice_id_idx ON public.transactions(invoice_id);

-- =========================================================================
-- WEBHOOK DELIVERIES
-- =========================================================================
CREATE TABLE public.webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  payload         JSONB NOT NULL,
  signature       TEXT NOT NULL,
  attempt         INTEGER NOT NULL DEFAULT 1,
  status_code     INTEGER,
  response_body   TEXT,
  delivered_at    TIMESTAMPTZ,
  next_retry_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own webhook deliveries"
  ON public.webhook_deliveries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id AND public.owns_store(i.store_id)
    )
  );

CREATE INDEX webhook_deliveries_invoice_id_idx ON public.webhook_deliveries(invoice_id);
CREATE INDEX webhook_deliveries_next_retry_idx ON public.webhook_deliveries(next_retry_at);

-- =========================================================================
-- RATES CACHE
-- =========================================================================
CREATE TABLE public.rates_cache (
  chain       public.chain_kind NOT NULL,
  fiat        TEXT NOT NULL,
  rate        NUMERIC(40, 18) NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chain, fiat)
);

GRANT SELECT ON public.rates_cache TO authenticated, anon;
GRANT ALL ON public.rates_cache TO service_role;

ALTER TABLE public.rates_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read rates"
  ON public.rates_cache FOR SELECT
  USING (true);
