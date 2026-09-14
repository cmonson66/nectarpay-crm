
-- ============================================================
-- 1. WIPE ALL EXISTING USERS (clean slate for wallet-only auth)
-- ============================================================
-- CASCADE deletes profiles, user_roles, stores, invoices, kyc, etc.
TRUNCATE TABLE auth.users CASCADE;

-- ============================================================
-- 2. WALLET ACCOUNTS — one wallet ↔ one auth.users row
-- ============================================================
CREATE TABLE public.wallet_accounts (
  wallet_address text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain text NOT NULL DEFAULT 'TXC',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wallet_accounts_user_unique UNIQUE (user_id)
);
CREATE INDEX wallet_accounts_user_id_idx ON public.wallet_accounts(user_id);

GRANT SELECT ON public.wallet_accounts TO authenticated;
GRANT ALL ON public.wallet_accounts TO service_role;

ALTER TABLE public.wallet_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wallet account"
  ON public.wallet_accounts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 3. WALLET LOGIN CHALLENGES — short-lived nonces for QR flow
-- ============================================================
CREATE TYPE public.wallet_challenge_status AS ENUM ('pending', 'signed', 'consumed', 'expired');

CREATE TABLE public.wallet_login_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce text NOT NULL UNIQUE,
  wallet_address text,
  signature text,
  status public.wallet_challenge_status NOT NULL DEFAULT 'pending',
  one_time_token text,
  ip_address text,
  user_agent text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  signed_at timestamptz,
  consumed_at timestamptz
);
CREATE INDEX wallet_login_challenges_token_idx ON public.wallet_login_challenges(one_time_token) WHERE one_time_token IS NOT NULL;
CREATE INDEX wallet_login_challenges_expires_idx ON public.wallet_login_challenges(expires_at);

GRANT ALL ON public.wallet_login_challenges TO service_role;
-- No anon/authenticated grants — only server-side code touches this table.

ALTER TABLE public.wallet_login_challenges ENABLE ROW LEVEL SECURITY;
-- No policies = no client access. Server uses service_role.

-- ============================================================
-- 4. UPDATE handle_new_user — no longer requires email
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  wallet_addr text;
  display_name text;
BEGIN
  -- Wallet logins set raw_user_meta_data.wallet_address
  wallet_addr := NEW.raw_user_meta_data->>'wallet_address';

  IF wallet_addr IS NOT NULL THEN
    display_name := substr(wallet_addr, 1, 6) || '…' || substr(wallet_addr, length(wallet_addr) - 3);
  ELSE
    display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  END IF;

  INSERT INTO public.profiles (user_id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    display_name,
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
$function$;

-- Ensure trigger is attached to auth.users (re-create if missing)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 5. Helper: purge expired challenges (called opportunistically)
-- ============================================================
CREATE OR REPLACE FUNCTION public.purge_expired_wallet_challenges()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.wallet_login_challenges
  WHERE expires_at < now() - interval '1 hour';
$$;
