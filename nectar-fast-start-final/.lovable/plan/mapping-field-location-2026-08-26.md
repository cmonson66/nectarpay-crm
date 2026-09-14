# Mapping & Field Location

Three connected pieces: a prospecting map, a "who's nearby" map on each prospect, and rep home base + live location.

## Map technology

Maps render with Leaflet and OpenStreetMap tiles (already used by the members heatmap). Google's browser map key is locked to `*.lovable.app` and will not work on crm.nectar-pay.com, so all Google calls — business search and address geocoding — run server-side through the connector gateway, which already works on the custom domain. Nothing about this changes on publish.

## 1. Prospect map (`/crm/map`)

A full-screen map with a location button. Tapping it asks for the browser's location, centers there, and shows:

- **Nearby businesses** — pulled live from Google, only when the rep taps "Search this area" (never automatically on pan, to keep Maps costs controlled). Each pin opens a card with name, address, phone, and an **Add to pipeline** button that creates the prospect pre-filled with everything Google returned, then opens the prospect detail page.
- **My prospects / customers** — existing leads with coordinates, colored by pipeline stage. Won deals show as customers.
- **Teammates** — live rep pins, subject to the visibility rules below.

Layer toggles for each of the three. Businesses already in the pipeline are matched by Google place ID so they don't show up as duplicate "new" pins — they render as existing prospects instead.

## 2. Map on the prospect detail page

A compact map panel on `/crm/leads/:id` centered on that business, showing other prospects within a few miles so a rep can plan a walk-around. Each nearby pin links to its detail page. If the prospect has no usable address, the panel shows a "Geocode this address" action instead of a broken map.

Addresses get coordinates automatically: when a prospect is created or its address is edited, the address is geocoded server-side and lat/lng saved. A one-time backfill fills in coordinates for existing prospects that have an address but no coordinates.

## 3. Home base and live location

- **Home base** — each user gets a home address on their profile (settable by the user themselves, and by an admin from Users & Teams). It's geocoded to coordinates and shown as a distinct pin.
- **Live location** — while the CRM is open, a rep's position is published every ~60 seconds and shown on the team map with a "last seen" timestamp. It stops the moment the app closes, and stale positions (older than ~15 min) drop off the map. There's an explicit on/off toggle in the profile menu; nothing is sent until the rep allows it, and no location history is kept — only the latest position per user.
- **Visibility** — same rules as everywhere else in the CRM: a rep sees only themselves, a manager sees their team, an admin sees everyone.

## Technical notes

- Migration: `home_address`, `home_lat`, `home_lng`, `location_sharing_enabled` on `profiles`; new `rep_locations` table (one row per user — lat, lng, accuracy, updated_at) with visibility scoped through the existing `visible_rep_ids()` function; `google_place_id` on `leads` with a unique index for dedupe.
- New `src/lib/geo.server.ts` for gateway calls (Places nearby search, Places text search, geocoding) and `src/lib/geo.functions.ts` as the thin authenticated wrapper. Searches are debounced, bounded in radius and result count, and cached per area to keep Maps spend down.
- Shared `<LeafletMap>` component so the prospect map, detail-page panel, and existing heatmap all use one loader.
- Location publishing uses the browser Geolocation watch API behind the opt-in toggle, throttled to one write per minute.

## Not in this phase

Paid data enrichment (owner names/emails via Apollo or similar) — that stays phase 2, pending Tim's budget approval. No route optimization or territory drawing yet.
