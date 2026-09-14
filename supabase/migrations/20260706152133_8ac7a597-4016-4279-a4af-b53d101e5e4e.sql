
-- 1) Merchant payout address for USDC on Ethereum
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS usdc_payout_address_eth text;

-- Basic shape check: 0x + 40 hex chars, or NULL
ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_usdc_payout_address_eth_format;
ALTER TABLE public.stores
  ADD CONSTRAINT stores_usdc_payout_address_eth_format
  CHECK (usdc_payout_address_eth IS NULL OR usdc_payout_address_eth ~ '^0x[a-fA-F0-9]{40}$');

-- 2) Status enum for tangem pay intents
DO $$ BEGIN
  CREATE TYPE public.tangem_pay_intent_status AS ENUM
    ('pending','signed','broadcast','confirmed','failed','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) tangem_pay_intents table
CREATE TABLE IF NOT EXISTS public.tangem_pay_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  card_id text,
  card_public_key text NOT NULL,
  card_address text NOT NULL,
  chain_id integer NOT NULL DEFAULT 1,
  usdc_contract text NOT NULL,
  merchant_payout_address text NOT NULL,
  amount_usdc_units numeric(78,0) NOT NULL,
  onchain_nonce bigint NOT NULL,
  unsigned_tx_json jsonb NOT NULL,
  tx_hash_to_sign text NOT NULL,
  signature_hex text,
  signed_raw_tx text,
  broadcast_tx_hash text,
  status public.tangem_pay_intent_status NOT NULL DEFAULT 'pending',
  error_message text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 seconds'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tangem_pay_intents_invoice_idx
  ON public.tangem_pay_intents(invoice_id);
CREATE INDEX IF NOT EXISTS tangem_pay_intents_store_idx
  ON public.tangem_pay_intents(store_id);
CREATE INDEX IF NOT EXISTS tangem_pay_intents_status_idx
  ON public.tangem_pay_intents(status);
CREATE INDEX IF NOT EXISTS tangem_pay_intents_broadcast_hash_idx
  ON public.tangem_pay_intents(broadcast_tx_hash);

-- Basic address / hash shape checks
ALTER TABLE public.tangem_pay_intents
  ADD CONSTRAINT tangem_pay_intents_card_address_format
  CHECK (card_address ~ '^0x[a-fA-F0-9]{40}$');
ALTER TABLE public.tangem_pay_intents
  ADD CONSTRAINT tangem_pay_intents_merchant_address_format
  CHECK (merchant_payout_address ~ '^0x[a-fA-F0-9]{40}$');
ALTER TABLE public.tangem_pay_intents
  ADD CONSTRAINT tangem_pay_intents_usdc_contract_format
  CHECK (usdc_contract ~ '^0x[a-fA-F0-9]{40}$');
ALTER TABLE public.tangem_pay_intents
  ADD CONSTRAINT tangem_pay_intents_tx_hash_to_sign_format
  CHECK (tx_hash_to_sign ~ '^0x[a-fA-F0-9]{64}$');

-- 4) GRANTs (before RLS)
-- Merchants read via SELECT policy; all writes go through service_role (server fns).
GRANT SELECT ON public.tangem_pay_intents TO authenticated;
GRANT ALL ON public.tangem_pay_intents TO service_role;

-- 5) RLS
ALTER TABLE public.tangem_pay_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view their stores' tangem pay intents"
  ON public.tangem_pay_intents
  FOR SELECT
  TO authenticated
  USING (public.owns_store(store_id));

-- 6) updated_at trigger (reuses existing set_updated_at)
DROP TRIGGER IF EXISTS trg_tangem_pay_intents_updated_at ON public.tangem_pay_intents;
CREATE TRIGGER trg_tangem_pay_intents_updated_at
  BEFORE UPDATE ON public.tangem_pay_intents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
