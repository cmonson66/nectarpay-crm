
-- Stores: merchant listing fields for /where heatmap
ALTER TABLE public.stores
  ADD COLUMN listing_visibility text NOT NULL DEFAULT 'city_only'
    CHECK (listing_visibility IN ('hidden','city_only','full')),
  ADD COLUMN business_address text,
  ADD COLUMN business_city text,
  ADD COLUMN business_region text,
  ADD COLUMN business_country text,
  ADD COLUMN business_lat numeric(9,6),
  ADD COLUMN business_lng numeric(9,6),
  ADD COLUMN business_category text,
  ADD COLUMN business_description text,
  ADD COLUMN business_logo_url text;

-- Terminals: GeoIP enrichment from heartbeats
ALTER TABLE public.terminals
  ADD COLUMN last_seen_ip inet,
  ADD COLUMN last_seen_lat numeric(9,6),
  ADD COLUMN last_seen_lng numeric(9,6),
  ADD COLUMN last_seen_city text,
  ADD COLUMN last_seen_country text,
  ADD COLUMN geoip_updated_at timestamptz;

-- Profiles: onboarding wizard progress + BCM handoff tracking
ALTER TABLE public.profiles
  ADD COLUMN onboarding_step text,
  ADD COLUMN onboarding_completed_at timestamptz,
  ADD COLUMN terminal_order_clicked_at timestamptz;

-- Public view of merchant pins for /where
-- city_only pins are anonymized (rounded coords, no name/website)
-- full pins expose merchant details
-- only stores with a terminal seen in last 30 days appear
CREATE OR REPLACE VIEW public.merchant_map_pins
WITH (security_invoker = true)
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
