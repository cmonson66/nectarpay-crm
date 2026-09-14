import { z } from "zod";

export const nearbySearchSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMeters: z.number().min(100).max(20000).default(2000),
  keyword: z.string().trim().max(120).optional().or(z.literal("")),
});

export const importBusinessSchema = z.object({
  placeId: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  addressLine1: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(60).optional().or(z.literal("")),
  postalCode: z.string().trim().max(20).optional().or(z.literal("")),
  phone: z.string().trim().max(60).optional().or(z.literal("")),
  businessType: z.string().trim().max(100).optional().or(z.literal("")),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const publishLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0).max(100000).nullable().optional(),
});

export const homeBaseSchema = z.object({
  userId: z.string().uuid().optional(),
  address: z.string().trim().max(300),
});

export const addressSuggestSchema = z.object({
  query: z.string().trim().min(3).max(200),
});

export const placeAddressSchema = z.object({
  placeId: z.string().trim().min(1).max(300),
});

export const geocodeLeadSchema = z.object({ id: z.string().uuid() });

export const nearbyLeadsSchema = z.object({
  leadId: z.string().uuid(),
  radiusMiles: z.number().min(0.25).max(50).default(5),
});

/** Positions older than this are treated as stale and hidden from the map. */
export const LIVE_LOCATION_STALE_MS = 15 * 60 * 1000;
/** Minimum gap between position writes from a single browser. */
export const LOCATION_PUBLISH_INTERVAL_MS = 60 * 1000;

export function milesBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
