
DROP VIEW IF EXISTS public.merchant_map_pins;

CREATE OR REPLACE FUNCTION public.get_merchant_map_pins()
RETURNS TABLE (
  store_id uuid,
  listing_visibility text,
  name text,
  website text,
  description text,
  address text,
  logo_url text,
  category text,
  city text,
  country text,
  lat numeric,
  lng numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.listing_visibility,
    CASE WHEN s.listing_visibility = 'full' THEN s.name END,
    CASE WHEN s.listing_visibility = 'full' THEN s.website END,
    CASE WHEN s.listing_visibility = 'full' THEN s.business_description END,
    CASE WHEN s.listing_visibility = 'full' THEN s.business_address END,
    CASE WHEN s.listing_visibility = 'full' THEN s.business_logo_url END,
    s.business_category,
    COALESCE(s.business_city, t.last_seen_city),
    COALESCE(s.business_country, t.last_seen_country),
    CASE
      WHEN s.listing_visibility = 'full'
        THEN COALESCE(s.business_lat, t.last_seen_lat)
      ELSE ROUND(COALESCE(s.business_lat, t.last_seen_lat)::numeric, 1)
    END,
    CASE
      WHEN s.listing_visibility = 'full'
        THEN COALESCE(s.business_lng, t.last_seen_lng)
      ELSE ROUND(COALESCE(s.business_lng, t.last_seen_lng)::numeric, 1)
    END
  FROM public.stores s
  LEFT JOIN LATERAL (
    SELECT last_seen_lat, last_seen_lng, last_seen_city, last_seen_country
    FROM public.terminals
    WHERE store_id = s.id
      AND revoked_at IS NULL
      AND last_seen_at > now() - interval '30 days'
    ORDER BY last_seen_at DESC NULLS LAST
    LIMIT 1
  ) t ON true
  WHERE s.listing_visibility <> 'hidden'
    AND (
      (s.business_lat IS NOT NULL AND s.business_lng IS NOT NULL)
      OR (t.last_seen_lat IS NOT NULL AND t.last_seen_lng IS NOT NULL)
    );
$$;

REVOKE ALL ON FUNCTION public.get_merchant_map_pins() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_merchant_map_pins() TO anon, authenticated;
