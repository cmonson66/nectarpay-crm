-- terminals: a paired POS device
CREATE TABLE public.terminals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Terminal',
  hmac_secret_hash text NOT NULL,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX terminals_store_id_idx ON public.terminals(store_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.terminals TO authenticated;
GRANT ALL ON public.terminals TO service_role;

ALTER TABLE public.terminals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners manage their terminals"
  ON public.terminals FOR ALL
  USING (public.owns_store(store_id))
  WITH CHECK (public.owns_store(store_id));

-- terminal_pairing_codes: one-shot codes that bind a device to a store
CREATE TABLE public.terminal_pairing_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT 'Terminal',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_terminal_id uuid REFERENCES public.terminals(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX terminal_pairing_codes_store_id_idx ON public.terminal_pairing_codes(store_id);
CREATE INDEX terminal_pairing_codes_code_idx ON public.terminal_pairing_codes(code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.terminal_pairing_codes TO authenticated;
GRANT ALL ON public.terminal_pairing_codes TO service_role;

ALTER TABLE public.terminal_pairing_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners manage their pairing codes"
  ON public.terminal_pairing_codes FOR ALL
  USING (public.owns_store(store_id))
  WITH CHECK (public.owns_store(store_id));