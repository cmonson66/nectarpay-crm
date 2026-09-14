-- ============================================================
-- PLANS
-- ============================================================
CREATE TABLE public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  monthly_price_usd numeric(10,2) NOT NULL DEFAULT 0,
  invoice_limit integer,           -- null = unlimited
  volume_limit_usd numeric(14,2),  -- null = unlimited
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans are public" ON public.plans
  FOR SELECT USING (active = true OR public.has_role(auth.uid(), 'admin'));

INSERT INTO public.plans (id, name, monthly_price_usd, invoice_limit, volume_limit_usd, features, sort_order) VALUES
  ('free',    'Free',    0,     50,    2500,    '["Choose your free-tier metric","Email support","All chains"]'::jsonb, 0),
  ('starter', 'Starter', 29,    500,   25000,   '["500 invoices / month","$25k volume / month","Webhooks","Email support"]'::jsonb, 1),
  ('growth',  'Growth',  79,    5000,  250000,  '["5,000 invoices / month","$250k volume / month","Priority support","Custom webhooks"]'::jsonb, 2),
  ('scale',   'Scale',   199,   NULL,  NULL,    '["Unlimited invoices","Unlimited volume","Dedicated support","SLA"]'::jsonb, 3);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan_id text NOT NULL REFERENCES public.plans(id) DEFAULT 'free',
  status text NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing','active','past_due','canceled','blocked')),
  free_tier_metric text CHECK (free_tier_metric IN ('days','invoices','volume')),
  free_tier_started_at timestamptz NOT NULL DEFAULT now(),
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_period_ends_at timestamptz,
  last_charged_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their subscription" ON public.subscriptions
  FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TXC CREDIT LEDGER
-- ============================================================
CREATE TABLE public.txc_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_txc numeric(20,8) NOT NULL,
  kind text NOT NULL CHECK (kind IN ('deposit','subscription_debit','adjustment','refund')),
  txc_usd_rate numeric(14,6),
  usd_value numeric(14,2),
  reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_txc_ledger_user_created ON public.txc_credit_ledger(user_id, created_at DESC);

GRANT SELECT ON public.txc_credit_ledger TO authenticated;
GRANT ALL ON public.txc_credit_ledger TO service_role;
ALTER TABLE public.txc_credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their ledger" ON public.txc_credit_ledger
  FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- USAGE COUNTERS
-- ============================================================
CREATE TABLE public.usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz,
  invoice_count integer NOT NULL DEFAULT 0,
  volume_usd numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_start)
);

CREATE INDEX idx_usage_user_period ON public.usage_counters(user_id, period_start DESC);

GRANT SELECT ON public.usage_counters TO authenticated;
GRANT ALL ON public.usage_counters TO service_role;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their usage" ON public.usage_counters
  FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER usage_counters_updated_at BEFORE UPDATE ON public.usage_counters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TXC DEPOSIT ADDRESSES
-- ============================================================
CREATE TABLE public.txc_deposit_addresses (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  address text NOT NULL UNIQUE,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.txc_deposit_addresses TO authenticated;
GRANT ALL ON public.txc_deposit_addresses TO service_role;
ALTER TABLE public.txc_deposit_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their deposit address" ON public.txc_deposit_addresses
  FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.txc_balance(_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount_txc), 0)::numeric
  FROM public.txc_credit_ledger
  WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_subscription_active(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub public.subscriptions%ROWTYPE;
  plan public.plans%ROWTYPE;
  usage public.usage_counters%ROWTYPE;
  days_elapsed int;
BEGIN
  SELECT * INTO sub FROM public.subscriptions WHERE user_id = _user_id;
  IF NOT FOUND THEN RETURN false; END IF;

  IF sub.status IN ('past_due','canceled','blocked') THEN
    -- still active during grace period
    IF sub.grace_period_ends_at IS NOT NULL AND sub.grace_period_ends_at > now() THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;

  IF sub.plan_id <> 'free' AND sub.status = 'active' THEN
    RETURN true;
  END IF;

  -- Free tier: check chosen metric
  SELECT * INTO plan FROM public.plans WHERE id = 'free';
  SELECT * INTO usage FROM public.usage_counters
    WHERE user_id = _user_id AND period_start = date_trunc('month', now())
    ORDER BY period_start DESC LIMIT 1;

  IF sub.free_tier_metric = 'days' THEN
    days_elapsed := EXTRACT(DAY FROM (now() - sub.free_tier_started_at));
    RETURN days_elapsed < 30;
  ELSIF sub.free_tier_metric = 'invoices' THEN
    RETURN COALESCE(usage.invoice_count, 0) < plan.invoice_limit;
  ELSIF sub.free_tier_metric = 'volume' THEN
    RETURN COALESCE(usage.volume_usd, 0) < plan.volume_limit_usd;
  END IF;

  -- No metric chosen yet -> still in trial
  RETURN true;
END;
$$;

-- ============================================================
-- AUTO-CREATE SUBSCRIPTION ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
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

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'merchant')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.subscriptions (user_id, plan_id, status)
  VALUES (NEW.id, 'free', 'trialing')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Make sure the auth trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: every existing user gets a free subscription
INSERT INTO public.subscriptions (user_id, plan_id, status)
SELECT id, 'free', 'trialing' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;