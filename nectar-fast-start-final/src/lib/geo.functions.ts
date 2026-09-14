import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  autocompleteAddresses,
  composeAddress,
  geocodeAddress,
  placeAddress,
  searchNearbyBusinesses,
} from "@/lib/geo.server";
import {
  addressSuggestSchema,
  geocodeLeadSchema,
  homeBaseSchema,
  importBusinessSchema,
  nearbyLeadsSchema,
  nearbySearchSchema,
  placeAddressSchema,
  publishLocationSchema,
} from "@/lib/geo-schemas";

/** Google address suggestions for a partially typed address. */
export const suggestAddresses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => addressSuggestSchema.parse(d))
  .handler(async ({ data }) => ({ suggestions: await autocompleteAddresses(data.query) }));

/** Street/city/state/zip for an address the user picked from the suggestions. */
export const resolveAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => placeAddressSchema.parse(d))
  .handler(async ({ data }) => await placeAddress(data.placeId));

/** Businesses around a point, with the ones already in the pipeline flagged. */
export const searchNearby = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => nearbySearchSchema.parse(d))
  .handler(async ({ data, context }) => {
    const businesses = await searchNearbyBusinesses({
      lat: data.lat,
      lng: data.lng,
      radiusMeters: data.radiusMeters,
      keyword: data.keyword || undefined,
    });
    if (!businesses.length) return { businesses: [] };

    const { data: known } = await context.supabase
      .from("leads")
      .select("google_place_id")
      .in(
        "google_place_id",
        businesses.map((b) => b.placeId),
      );
    const existing = new Set((known ?? []).map((r) => r.google_place_id));

    return {
      businesses: businesses.map((b) => ({ ...b, inPipeline: existing.has(b.placeId) })),
    };
  });

/** Turns a Google business into a prospect owned by the caller. */
export const importBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => importBusinessSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: dupe } = await supabase
      .from("leads")
      .select("id")
      .eq("google_place_id", data.placeId)
      .maybeSingle();
    if (dupe) return { id: dupe.id, alreadyExisted: true };

    const { data: row, error } = await supabase
      .from("leads")
      .insert({
        business_name: data.name,
        business_type: data.businessType || null,
        contact_phone_e164: data.phone || null,
        address_line1: data.addressLine1 || null,
        city: data.city || null,
        state: data.state || null,
        postal_code: data.postalCode || null,
        lat: data.lat,
        lng: data.lng,
        google_place_id: data.placeId,
        status: "new" as const,
        source: "cold_walk_in" as const,
        owner_rep_id: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, alreadyExisted: false };
  });

/** Geocodes a prospect's stored address and saves the coordinates. */
export const geocodeLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => geocodeLeadSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: lead, error } = await supabase
      .from("leads")
      .select("id, address_line1, city, state, postal_code")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!lead) return { ok: false as const, reason: "not_found" as const };

    const address = composeAddress(lead);
    if (!address) return { ok: false as const, reason: "no_address" as const };

    const hit = await geocodeAddress(address);
    if (!hit) return { ok: false as const, reason: "not_found" as const };

    const { error: upErr } = await supabase
      .from("leads")
      .update({ lat: hit.lat, lng: hit.lng })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true as const, lat: hit.lat, lng: hit.lng };
  });

/** Fills in coordinates for prospects that have an address but no pin yet. */
export const backfillLeadCoordinates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("leads")
      .select("id, address_line1, city, state, postal_code")
      .is("lat", null)
      .not("address_line1", "is", null)
      .limit(50);
    if (error) throw new Error(error.message);

    let updated = 0;
    for (const lead of rows ?? []) {
      const address = composeAddress(lead);
      if (!address) continue;
      const hit = await geocodeAddress(address).catch(() => null);
      if (!hit) continue;
      const { error: upErr } = await supabase
        .from("leads")
        .update({ lat: hit.lat, lng: hit.lng })
        .eq("id", lead.id);
      if (!upErr) updated += 1;
    }
    return { scanned: rows?.length ?? 0, updated };
  });

/** Prospects with coordinates + teammate pins the caller is allowed to see. */
export const getMapData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [leads, locations, profiles] = await Promise.all([
      supabase
        .from("leads")
        .select("id, business_name, status, address_line1, city, state, lat, lng, owner_rep_id")
        .not("lat", "is", null)
        .not("lng", "is", null)
        .limit(2000),
      supabase.from("rep_locations").select("user_id, lat, lng, accuracy_meters, updated_at"),
      supabase
        .from("profiles")
        .select("user_id, full_name, email, home_address, home_lat, home_lng"),
    ]);

    const nameOf = new Map(
      (profiles.data ?? []).map((p) => [p.user_id, p.full_name || p.email || "Rep"]),
    );

    return {
      me: userId,
      leads: leads.data ?? [],
      reps: (locations.data ?? []).map((l) => ({
        userId: l.user_id,
        name: nameOf.get(l.user_id) ?? "Rep",
        lat: Number(l.lat),
        lng: Number(l.lng),
        accuracyMeters: l.accuracy_meters === null ? null : Number(l.accuracy_meters),
        updatedAt: l.updated_at,
      })),
      homeBases: (profiles.data ?? [])
        .filter((p) => p.home_lat !== null && p.home_lng !== null)
        .map((p) => ({
          userId: p.user_id,
          name: p.full_name || p.email || "Rep",
          address: p.home_address,
          lat: Number(p.home_lat),
          lng: Number(p.home_lng),
        })),
    };
  });

/** Other prospects near a given prospect, for planning a walk-around. */
export const getNearbyLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => nearbyLeadsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: lead, error } = await supabase
      .from("leads")
      .select("id, business_name, status, lat, lng, address_line1, city, state, postal_code")
      .eq("id", data.leadId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!lead) return { center: null, neighbors: [], hasAddress: false };

    const hasAddress = Boolean(composeAddress(lead));
    if (lead.lat === null || lead.lng === null) {
      return { center: null, neighbors: [], hasAddress };
    }

    const centerLat = Number(lead.lat);
    const centerLng = Number(lead.lng);
    const dLat = data.radiusMiles / 69;
    const dLng = data.radiusMiles / (69 * Math.max(Math.cos((centerLat * Math.PI) / 180), 0.01));

    const { data: rows } = await supabase
      .from("leads")
      .select("id, business_name, status, lat, lng, address_line1, city, state")
      .not("lat", "is", null)
      .not("lng", "is", null)
      .gte("lat", centerLat - dLat)
      .lte("lat", centerLat + dLat)
      .gte("lng", centerLng - dLng)
      .lte("lng", centerLng + dLng)
      .neq("id", lead.id)
      .limit(300);

    return {
      hasAddress,
      center: {
        id: lead.id,
        name: lead.business_name,
        status: lead.status,
        lat: centerLat,
        lng: centerLng,
      },
      neighbors: (rows ?? []).map((r) => ({
        id: r.id,
        name: r.business_name,
        status: r.status,
        lat: Number(r.lat),
        lng: Number(r.lng),
        address: [r.address_line1, r.city, r.state].filter(Boolean).join(", "),
      })),
    };
  });

/** Publishes the caller's current position (opt-in, latest position only). */
export const publishMyLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => publishLocationSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("rep_locations").upsert(
      {
        user_id: userId,
        lat: data.lat,
        lng: data.lng,
        accuracy_meters: data.accuracyMeters ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Turns live sharing on or off; turning it off deletes the stored position. */
export const setLocationSharing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ({ enabled: Boolean((d as { enabled?: unknown }).enabled) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ location_sharing_enabled: data.enabled })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    if (!data.enabled) {
      await supabase.from("rep_locations").delete().eq("user_id", userId);
    }
    return { enabled: data.enabled };
  });

/** The caller's own location settings. */
export const getMyLocationSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("profiles")
      .select("home_address, home_lat, home_lng, location_sharing_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    return {
      homeAddress: data?.home_address ?? "",
      homeLat: data?.home_lat === null || data?.home_lat === undefined ? null : Number(data.home_lat),
      homeLng: data?.home_lng === null || data?.home_lng === undefined ? null : Number(data.home_lng),
      sharingEnabled: Boolean(data?.location_sharing_enabled),
    };
  });

/** Saves a home base address, geocoding it. Admins may set it for another user. */
export const setHomeBase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => homeBaseSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const target = data.userId ?? userId;

    if (target !== userId) {
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (!isAdmin) throw new Response("Forbidden", { status: 403 });
    }

    if (!data.address) {
      const { error } = await supabase
        .from("profiles")
        .update({ home_address: null, home_lat: null, home_lng: null })
        .eq("user_id", target);
      if (error) throw new Error(error.message);
      return { ok: true as const, cleared: true as const };
    }

    const hit = await geocodeAddress(data.address);
    if (!hit) return { ok: false as const, reason: "not_found" as const };

    const { error } = await supabase
      .from("profiles")
      .update({ home_address: hit.formattedAddress, home_lat: hit.lat, home_lng: hit.lng })
      .eq("user_id", target);
    if (error) throw new Error(error.message);
    return { ok: true as const, address: hit.formattedAddress, lat: hit.lat, lng: hit.lng };
  });
