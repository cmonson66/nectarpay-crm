CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;

DROP POLICY IF EXISTS "Plans are public" ON public.plans;
CREATE POLICY "Active plans are public"
ON public.plans
FOR SELECT
TO public
USING (active = true);
CREATE POLICY "Admins can read all plans"
ON public.plans
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users read their subscription" ON public.subscriptions;
CREATE POLICY "Users read their subscription"
ON public.subscriptions
FOR SELECT
TO authenticated
USING ((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users read their ledger" ON public.txc_credit_ledger;
CREATE POLICY "Users read their ledger"
ON public.txc_credit_ledger
FOR SELECT
TO authenticated
USING ((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users read their deposit address" ON public.txc_deposit_addresses;
CREATE POLICY "Users read their deposit address"
ON public.txc_deposit_addresses
FOR SELECT
TO authenticated
USING ((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users read their usage" ON public.usage_counters;
CREATE POLICY "Users read their usage"
ON public.usage_counters
FOR SELECT
TO authenticated
USING ((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));