
-- affiliate_codes: one code per user
CREATE TABLE public.affiliate_codes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  clicks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.affiliate_codes TO authenticated;
GRANT ALL ON public.affiliate_codes TO service_role;
ALTER TABLE public.affiliate_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own affiliate code select" ON public.affiliate_codes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own affiliate code insert" ON public.affiliate_codes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own affiliate code update" ON public.affiliate_codes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER affiliate_codes_set_updated_at
  BEFORE UPDATE ON public.affiliate_codes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- affiliate_rewards: one row per qualifying referral (kit purchase)
CREATE TABLE public.affiliate_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kit_order_id uuid REFERENCES public.kit_orders(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending_choice'
    CHECK (status IN ('pending_choice','granted_free_year','granted_cash')),
  choice text CHECK (choice IN ('free_year','cash_50')),
  chosen_at timestamptz,
  granted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referred_user_id)
);
GRANT SELECT, UPDATE ON public.affiliate_rewards TO authenticated;
GRANT ALL ON public.affiliate_rewards TO service_role;
ALTER TABLE public.affiliate_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own affiliate rewards select" ON public.affiliate_rewards
  FOR SELECT TO authenticated USING (auth.uid() = affiliate_user_id);
CREATE POLICY "own affiliate rewards update" ON public.affiliate_rewards
  FOR UPDATE TO authenticated USING (auth.uid() = affiliate_user_id) WITH CHECK (auth.uid() = affiliate_user_id);

CREATE INDEX affiliate_rewards_affiliate_idx ON public.affiliate_rewards(affiliate_user_id);
CREATE INDEX affiliate_rewards_referred_idx ON public.affiliate_rewards(referred_user_id);

CREATE TRIGGER affiliate_rewards_set_updated_at
  BEFORE UPDATE ON public.affiliate_rewards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Public click-counter function (anonymous visitors bump the counter on ?r= land)
CREATE OR REPLACE FUNCTION public.increment_affiliate_click(_code text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.affiliate_codes SET clicks = clicks + 1 WHERE code = _code;
$$;
GRANT EXECUTE ON FUNCTION public.increment_affiliate_click(text) TO anon, authenticated;
