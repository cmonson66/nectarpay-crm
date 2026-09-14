CREATE OR REPLACE FUNCTION public.create_deal_with_terminal(
  p_lead_id uuid,
  p_deal_type public.deal_type,
  p_hardware_amount numeric,
  p_subscription_monthly numeric,
  p_subscription_months integer,
  p_notes text,
  p_payment_method text,
  p_device_id uuid,
  p_duration_days integer,
  p_is_demo boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_deal_id uuid;
  v_is_contingent boolean := p_deal_type = 'contingent'::public.deal_type;
  v_is_admin boolean := false;
  v_hardware_amount numeric := p_hardware_amount;
  v_subscription_monthly numeric := p_subscription_monthly;
  v_subscription_months integer := p_subscription_months;
  v_placed_at timestamptz := now();
  v_updated_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_device_id IS NULL THEN
    RAISE EXCEPTION 'Select a terminal';
  END IF;

  IF p_deal_type = 'contingent'::public.deal_type AND p_duration_days NOT IN (14, 30) THEN
    RAISE EXCEPTION 'Contingent sales must be 2 weeks or 30 days';
  END IF;

  IF p_is_demo THEN
    IF p_deal_type <> 'sale'::public.deal_type THEN
      RAISE EXCEPTION 'Demo pricing only applies to sales';
    END IF;

    SELECT public.has_role(v_user_id, 'admin'::public.app_role) INTO v_is_admin;
    IF NOT COALESCE(v_is_admin, false) THEN
      RAISE EXCEPTION 'Only admins can log demo sales';
    END IF;

    v_hardware_amount := 250;
    v_subscription_monthly := 0;
    v_subscription_months := 0;
  END IF;

  IF p_deal_type = 'sale'::public.deal_type
     AND NOT p_is_demo
     AND NULLIF(trim(COALESCE(p_payment_method, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Select a payment method';
  END IF;

  UPDATE public.devices
     SET status = CASE
       WHEN v_is_contingent THEN 'placed_contingent'::public.device_status
       ELSE 'sold'::public.device_status
     END,
         current_lead_id = p_lead_id,
         assigned_rep_id = v_user_id
   WHERE id = p_device_id
     AND status IN ('in_inventory'::public.device_status, 'assigned_to_rep'::public.device_status, 'returned'::public.device_status)
     AND (
       assigned_rep_id IS NULL
       OR assigned_rep_id = v_user_id
       OR public.has_role(v_user_id, 'admin'::public.app_role)
     );

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count = 0 THEN
    RAISE EXCEPTION 'The selected terminal is no longer available. Please choose another terminal.';
  END IF;

  INSERT INTO public.deals (
    lead_id,
    rep_id,
    type,
    status,
    hardware_amount,
    subscription_monthly,
    subscription_months,
    notes,
    is_demo,
    payment_method,
    device_id,
    closed_at
  ) VALUES (
    p_lead_id,
    v_user_id,
    p_deal_type,
    CASE WHEN v_is_contingent THEN 'open'::public.deal_status ELSE 'won'::public.deal_status END,
    v_hardware_amount,
    v_subscription_monthly,
    v_subscription_months,
    NULLIF(p_notes, ''),
    p_is_demo,
    NULLIF(p_payment_method, ''),
    p_device_id,
    CASE WHEN v_is_contingent THEN NULL ELSE v_placed_at END
  )
  RETURNING id INTO v_deal_id;

  IF v_is_contingent THEN
    INSERT INTO public.contingent_placements (
      deal_id,
      device_id,
      lead_id,
      rep_id,
      placed_at,
      expires_at,
      followup_due_at
    ) VALUES (
      v_deal_id,
      p_device_id,
      p_lead_id,
      v_user_id,
      v_placed_at,
      v_placed_at + (p_duration_days || ' days')::interval,
      v_placed_at + interval '4 days'
    );

    UPDATE public.leads
       SET status = 'contingent'::public.lead_status
     WHERE id = p_lead_id;
  ELSE
    UPDATE public.leads
       SET status = 'won'::public.lead_status
     WHERE id = p_lead_id;
  END IF;

  RETURN v_deal_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_deal_with_terminal(uuid, public.deal_type, numeric, numeric, integer, text, text, uuid, integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_deal_with_terminal(uuid, public.deal_type, numeric, numeric, integer, text, text, uuid, integer, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_deal_with_terminal(uuid, public.deal_type, numeric, numeric, integer, text, text, uuid, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_deal_with_terminal(uuid, public.deal_type, numeric, numeric, integer, text, text, uuid, integer, boolean) TO service_role;