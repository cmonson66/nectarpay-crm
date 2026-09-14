-- Fast Start drill progress tracking
-- Reps drill 20 full merchant onboards: create demo -> onboard -> test $1 USDC -> delete -> repeat

CREATE TABLE public.fast_start_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  drill_number integer NOT NULL, -- 1-20
  demo_merchant_id uuid, -- reference to the merchant created in this drill
  demo_merchant_name text, -- must contain "Demo"
  
  -- Drill phases
  merchant_created_at timestamptz,
  merchant_onboarded_at timestamptz,
  coin_setup_completed_at timestamptz,
  beekeeper_configured_at timestamptz,
  nectarpay_app_installed_at timestamptz,
  terminal_paired_at timestamptz,
  test_transaction_sent_at timestamptz, -- $1 USDC on Base
  test_transaction_confirmed_at timestamptz,
  merchant_deleted_at timestamptz,
  
  -- Timing metrics
  pairing_duration_seconds integer, -- track fastest 3 of 20
  full_onboard_duration_seconds integer, -- coin to test tx
  
  -- Checkpoint attestation
  rep_attested_completion boolean DEFAULT false,
  rep_attested_at timestamptz,
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE INDEX fast_start_steps_rep_idx ON public.fast_start_steps (rep_id, drill_number);
CREATE INDEX fast_start_steps_created_idx ON public.fast_start_steps (rep_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.fast_start_steps TO authenticated;
GRANT ALL ON public.fast_start_steps TO service_role;

ALTER TABLE public.fast_start_steps ENABLE ROW LEVEL SECURITY;

-- Rep can see/edit only their own drills
CREATE POLICY "fast_start_steps_rep_scope"
  ON public.fast_start_steps
  FOR ALL TO authenticated
  USING (rep_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (rep_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Network harvesting form data
CREATE TABLE public.rep_networks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  
  -- Rep's personal merchant relationships
  coffee_shops text, -- "Bluebird Cafe, Corvus Coffee, ..."
  tattoo_shops text,
  restaurants text,
  gyms text,
  auto_shops text,
  barbers text,
  nail_salons text,
  other_merchants text,
  
  -- Merchant lookup results
  matched_merchant_ids uuid[], -- UUIDs of nearby merchants matching rep's network
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX rep_networks_rep_unique ON public.rep_networks (rep_id);

GRANT SELECT, INSERT, UPDATE ON public.rep_networks TO authenticated;
GRANT ALL ON public.rep_networks TO service_role;

ALTER TABLE public.rep_networks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rep_networks_rep_scope"
  ON public.rep_networks
  FOR ALL TO authenticated
  USING (rep_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (rep_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
