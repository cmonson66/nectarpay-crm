-- 1. Extend chain_kind with LTC and BCH so the wallet can push xpubs for them.
ALTER TYPE public.chain_kind ADD VALUE IF NOT EXISTS 'ltc';
ALTER TYPE public.chain_kind ADD VALUE IF NOT EXISTS 'bch';

-- 2. Wallet-link one-time codes.
CREATE TABLE public.wallet_link_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallet_link_codes_store_idx ON public.wallet_link_codes(store_id);
CREATE INDEX wallet_link_codes_hash_idx ON public.wallet_link_codes(code_hash);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_link_codes TO authenticated;
GRANT ALL ON public.wallet_link_codes TO service_role;

ALTER TABLE public.wallet_link_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own wallet link codes"
  ON public.wallet_link_codes
  FOR ALL
  TO authenticated
  USING (public.owns_store(store_id))
  WITH CHECK (public.owns_store(store_id));

-- 3. Chain config audit log — every xpub/address change is captured.
CREATE TABLE public.chain_config_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  chain public.chain_kind NOT NULL,
  action text NOT NULL CHECK (action IN ('insert', 'update')),
  old_xpub text,
  new_xpub text,
  old_xpub_or_address text,
  new_xpub_or_address text,
  source text,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chain_config_audit_store_idx ON public.chain_config_audit(store_id, created_at DESC);
CREATE INDEX chain_config_audit_unnotified_idx ON public.chain_config_audit(notified_at) WHERE notified_at IS NULL;

GRANT SELECT ON public.chain_config_audit TO authenticated;
GRANT ALL ON public.chain_config_audit TO service_role;

ALTER TABLE public.chain_config_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own audit"
  ON public.chain_config_audit
  FOR SELECT
  TO authenticated
  USING (public.owns_store(store_id));

-- 4. Trigger: record any insert or material change to xpub / xpub_or_address.
CREATE OR REPLACE FUNCTION public.chain_configs_audit_xpub()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.xpub IS NOT NULL OR NEW.xpub_or_address IS NOT NULL THEN
      INSERT INTO public.chain_config_audit
        (store_id, chain, action, old_xpub, new_xpub, old_xpub_or_address, new_xpub_or_address)
      VALUES
        (NEW.store_id, NEW.chain, 'insert', NULL, NEW.xpub, NULL, NEW.xpub_or_address);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.xpub IS DISTINCT FROM OLD.xpub
       OR NEW.xpub_or_address IS DISTINCT FROM OLD.xpub_or_address THEN
      INSERT INTO public.chain_config_audit
        (store_id, chain, action, old_xpub, new_xpub, old_xpub_or_address, new_xpub_or_address)
      VALUES
        (NEW.store_id, NEW.chain, 'update',
         OLD.xpub, NEW.xpub,
         OLD.xpub_or_address, NEW.xpub_or_address);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chain_configs_audit_xpub ON public.chain_configs;
CREATE TRIGGER chain_configs_audit_xpub
  AFTER INSERT OR UPDATE ON public.chain_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.chain_configs_audit_xpub();

-- 5. Backfill the new notification event into existing prefs and update default.
ALTER TABLE public.notification_prefs
  ALTER COLUMN events SET DEFAULT '{"invoice_paid": true, "plan_renewed": true, "grace_warning": true, "invoice_expired": true, "deposit_received": true, "invoice_underpaid": true, "security_xpub_change": true}'::jsonb;

UPDATE public.notification_prefs
SET events = events || '{"security_xpub_change": true}'::jsonb
WHERE NOT (events ? 'security_xpub_change');