
CREATE TABLE public.invoice_tap_nonces (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  nonce text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoice_tap_nonces_invoice_id_idx ON public.invoice_tap_nonces(invoice_id);
CREATE INDEX invoice_tap_nonces_expires_at_idx ON public.invoice_tap_nonces(expires_at);

GRANT ALL ON public.invoice_tap_nonces TO service_role;
ALTER TABLE public.invoice_tap_nonces ENABLE ROW LEVEL SECURITY;
-- No policies: only service role (via signed nonce in URL) ever touches this.
