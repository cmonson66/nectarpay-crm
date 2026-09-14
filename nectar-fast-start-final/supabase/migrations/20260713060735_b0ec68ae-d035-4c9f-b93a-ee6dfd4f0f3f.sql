
CREATE TABLE public.kit_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  invoice_id uuid NULL REFERENCES public.invoices(id) ON DELETE SET NULL,
  email text NOT NULL,
  full_name text NOT NULL,
  phone text NULL,
  ship_line1 text NOT NULL,
  ship_line2 text NULL,
  ship_city text NOT NULL,
  ship_region text NULL,
  ship_postal text NOT NULL,
  ship_country text NOT NULL,
  include_first_year boolean NOT NULL DEFAULT true,
  kit_price_usd numeric(10,2) NOT NULL DEFAULT 499.00,
  first_year_price_usd numeric(10,2) NOT NULL DEFAULT 228.00,
  subtotal_usd numeric(10,2) NOT NULL,
  total_usd numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending_payment',
  bm_order_id text NULL,
  bm_order_number text NULL,
  bm_synced_at timestamptz NULL,
  bm_last_error text NULL,
  bm_attempt_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kit_orders_status_check CHECK (status IN ('pending_payment','paid','submitted_to_bm','bm_failed','shipped','canceled'))
);

CREATE INDEX kit_orders_user_idx ON public.kit_orders(user_id);
CREATE INDEX kit_orders_invoice_idx ON public.kit_orders(invoice_id);
CREATE INDEX kit_orders_status_idx ON public.kit_orders(status);

GRANT SELECT ON public.kit_orders TO authenticated;
GRANT ALL ON public.kit_orders TO service_role;

ALTER TABLE public.kit_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own kit orders"
  ON public.kit_orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins see all kit orders"
  ON public.kit_orders FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER kit_orders_set_updated_at
  BEFORE UPDATE ON public.kit_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
