
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS chosen_plan_id text REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS chosen_plan_at timestamptz,
  ADD COLUMN IF NOT EXISTS chosen_plan_source text,
  ADD COLUMN IF NOT EXISTS terminal_kit_ordered_at timestamptz;
