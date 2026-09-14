
-- Re-create as a security definer view (the default for PG views).
-- The view itself is a safe projection: hidden stores excluded, city_only
-- listings have name/website/address/logo stripped and coords rounded.
CREATE OR REPLACE VIEW public.merchant_map_pins
WITH (security_invoker = false)
AS
SELECT
  s.id AS store_id,
  s.listing_visibility,
  CASE WHEN s.listing_visibility = 'full' THEN s.name END AS name,
  CASE WHEN s.listing_visibility = 'full' THEN s.website END AS website,
  CASE WHEN s.listing_visibility = 'full' THEN s.business_description END AS description,
  CASE WHEN s.listing_visibility = 'full' THEN s.business_address END AS address,
  CASE WHEN s.listing_visibility = 'full' THEN s.business_logo_url END AS logo_url,
  s.business_category AS category,
  COALESCE(s.business_city, t.last_seen_city) AS city,
  COALESCE(s.business_country, t.last_seen_country) AS country,
  CASE
    WHEN s.listing_visibility = 'full'
      THEN COALESCE(s.business_lat, t.last_seen_lat)
    ELSE ROUND(COALESCE(s.business_lat, t.last_seen_lat)::numeric, 1)
  END AS lat,
  CASE
    WHEN s.listing_visibility = 'full'
      THEN COALESCE(s.business_lng, t.last_seen_lng)
    ELSE ROUND(COALESCE(s.business_lng, t.last_seen_lng)::numeric, 1)
  END AS lng
FROM public.stores s
LEFT JOIN LATERAL (
  SELECT last_seen_lat, last_seen_lng, last_seen_city, last_seen_country, last_seen_at
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

GRANT SELECT ON public.merchant_map_pins TO anon, authenticated;
