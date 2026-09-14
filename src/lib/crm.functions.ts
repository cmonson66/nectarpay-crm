import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toE164 } from "@/lib/phone";
import { composeAddress, geocodeAddress } from "@/lib/geo.server";

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "thinking",
  "contingent",
  "pending",
  "won",
  "lost",
  "do_not_contact",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = [
  "cold_walk_in",
  "referral",
  "web_intake",
  "campaign",
  "manual",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const ACTIVITY_TYPES = ["call", "email", "sms", "visit", "note", "meeting"] as const;
export const ACTIVITY_DIRECTIONS = ["outbound", "inbound"] as const;
export const ACTIVITY_OUTCOMES = [
  "connected",
  "no_answer",
  "gatekeeper",
  "pitched",
  "objection",
  "not_interested",
] as const;

const LEAD_COLUMNS =
  "id, business_name, business_type, contact_name, contact_email, contact_phone_e164, address_line1, city, state, postal_code, lat, lng, status, source, referred_by_lead_id, owner_rep_id, sms_consent, sms_opted_out_at, email_opted_out_at, first_contacted_at, last_activity_at, market, message, admin_notes, follow_up_at, created_at, updated_at";

// ─── Who am I ──────────────────────────────────────────────────────────

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, email, phone_e164").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const roles = (roleRows ?? []).map((r) => r.role as string);
    return {
      userId,
      fullName: profile?.full_name ?? profile?.email ?? "",
      email: profile?.email ?? "",
      roles,
      isAdmin: roles.includes("admin"),
      isManager: roles.includes("manager"),
    };
  });

/** Every rep the caller is allowed to see — powers owner dropdowns and filters. */
export const listVisibleReps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("list_rep_directory");
    if (error) throw new Error(error.message);
    return (data ?? []) as {
      user_id: string;
      full_name: string | null;
      email: string | null;
      is_active: boolean;
    }[];
  });

// ─── Leads ─────────────────────────────────────────────────────────────

export const listPipeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("leads")
      .select(LEAD_COLUMNS)
      .order("last_activity_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const leadInputSchema = z.object({
  business_name: z.string().trim().min(1).max(200),
  business_type: z.string().trim().max(100).optional().or(z.literal("")),
  contact_name: z.string().trim().max(200).optional().or(z.literal("")),
  contact_email: z.string().trim().email().max(320).optional().or(z.literal("")),
  contact_phone: z.string().trim().max(60).optional().or(z.literal("")),
  address_line1: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(60).optional().or(z.literal("")),
  postal_code: z.string().trim().max(20).optional().or(z.literal("")),
  status: z.enum(LEAD_STATUSES).default("new"),
  source: z.enum(LEAD_SOURCES).default("cold_walk_in"),
  referred_by_lead_id: z.string().uuid().nullable().optional(),
  owner_rep_id: z.string().uuid().nullable().optional(),
  sms_consent: z.boolean().default(false),
  message: z.string().trim().max(5000).optional().or(z.literal("")),
});

export const createLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => leadInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const address = composeAddress({
      address_line1: data.address_line1 || null,
      city: data.city || null,
      state: data.state || null,
      postal_code: data.postal_code || null,
    });
    const hit = address ? await geocodeAddress(address).catch(() => null) : null;
    const { data: row, error } = await supabase
      .from("leads")
      .insert({
        lat: hit?.lat ?? null,
        lng: hit?.lng ?? null,
        business_name: data.business_name,
        business_type: data.business_type || null,
        contact_name: data.contact_name || null,
        contact_email: data.contact_email || null,
        contact_phone_e164: toE164(data.contact_phone) || null,
        address_line1: data.address_line1 || null,
        city: data.city || null,
        state: data.state || null,
        postal_code: data.postal_code || null,
        status: data.status,
        source: data.source,
        referred_by_lead_id: data.referred_by_lead_id ?? null,
        owner_rep_id: data.owner_rep_id ?? userId,
        sms_consent: data.sms_consent,
        message: data.message || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

const leadPatchSchema = z.object({
  id: z.string().uuid(),
  business_name: z.string().trim().min(1).max(200).optional(),
  business_type: z.string().trim().max(100).nullable().optional(),
  contact_name: z.string().trim().max(200).nullable().optional(),
  contact_email: z.string().trim().max(320).nullable().optional(),
  contact_phone: z.string().trim().max(60).nullable().optional(),
  address_line1: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  state: z.string().trim().max(60).nullable().optional(),
  postal_code: z.string().trim().max(20).nullable().optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  owner_rep_id: z.string().uuid().nullable().optional(),
  referred_by_lead_id: z.string().uuid().nullable().optional(),
  sms_consent: z.boolean().optional(),
  sms_opted_out: z.boolean().optional(),
  admin_notes: z.string().max(5000).nullable().optional(),
  follow_up_at: z.string().nullable().optional(),
});

export const updateCrmLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => leadPatchSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id, contact_phone, sms_opted_out, ...rest } = data;
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) patch[key] = value === "" ? null : value;
    }
    if (contact_phone !== undefined) {
      patch.contact_phone_e164 = contact_phone ? toE164(contact_phone) : null;
    }
    if (sms_opted_out !== undefined) {
      patch.sms_opted_out_at = sms_opted_out ? new Date().toISOString() : null;
    }
    patch.updated_at = new Date().toISOString();

    // Only admins and managers may close a prospect as won.
    if (patch.status === "won") {
      const { data: roleRows } = await context.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId);
      const roles = (roleRows ?? []).map((r) => r.role as string);
      if (!roles.includes("admin") && !roles.includes("manager")) {
        throw new Error("Only an admin or manager can mark a prospect as won");
      }
    }

    // Re-pin the prospect whenever any address part changes.
    const touchesAddress =
      rest.address_line1 !== undefined ||
      rest.city !== undefined ||
      rest.state !== undefined ||
      rest.postal_code !== undefined;
    if (touchesAddress) {
      const { data: current } = await context.supabase
        .from("leads")
        .select("address_line1, city, state, postal_code")
        .eq("id", id)
        .maybeSingle();
      const merged = {
        address_line1: (patch.address_line1 ?? current?.address_line1 ?? null) as string | null,
        city: (patch.city ?? current?.city ?? null) as string | null,
        state: (patch.state ?? current?.state ?? null) as string | null,
        postal_code: (patch.postal_code ?? current?.postal_code ?? null) as string | null,
      };
      const address = composeAddress(merged);
      const hit = address ? await geocodeAddress(address).catch(() => null) : null;
      patch.lat = hit?.lat ?? null;
      patch.lng = hit?.lng ?? null;
    }

    const { error } = await context.supabase
      .from("leads")
      .update(patch as never)
      .eq("id", id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // RLS scopes deletes to leads the caller can see (own leads, team leads
    // for managers, everything for admins). Dependent rows cascade.
    const { error } = await context.supabase.from("leads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getLeadDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: lead, error } = await supabase
      .from("leads")
      .select(LEAD_COLUMNS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!lead) throw new Error("Lead not found");

    const [{ data: activities }, { data: referrals }, referrerRes, { data: reps }, { data: tasks }] =
      await Promise.all([
        supabase
          .from("activities")
          .select("id, type, direction, outcome, notes, occurred_at, duration_seconds, rep_id")
          .eq("lead_id", data.id)
          .order("occurred_at", { ascending: false })
          .limit(500),
        supabase
          .from("leads")
          .select("id, business_name, status")
          .eq("referred_by_lead_id", data.id)
          .order("created_at", { ascending: false }),
        lead.referred_by_lead_id
          ? supabase
              .from("leads")
              .select("id, business_name, status")
              .eq("id", lead.referred_by_lead_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("profiles").select("user_id, full_name, email"),
        supabase
          .from("tasks")
          .select("id, title, type, due_at, completed_at, assigned_to, auto_generated")
          .eq("lead_id", data.id)
          .order("completed_at", { ascending: true, nullsFirst: true })
          .order("due_at", { ascending: true, nullsFirst: false })
          .limit(100),
      ]);

    return {
      lead,
      activities: activities ?? [],
      referrals: referrals ?? [],
      referrer: (referrerRes as { data: unknown }).data ?? null,
      reps: reps ?? [],
      tasks: tasks ?? [],
    };
  });

// ─── Activities ────────────────────────────────────────────────────────

const activitySchema = z.object({
  lead_id: z.string().uuid(),
  type: z.enum(ACTIVITY_TYPES),
  direction: z.enum(ACTIVITY_DIRECTIONS).default("outbound"),
  outcome: z.enum(ACTIVITY_OUTCOMES).nullable().optional(),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
  duration_seconds: z.number().int().min(0).max(86400).nullable().optional(),
  occurred_at: z.string().optional(),
});

export const logActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => activitySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("activities").insert({
      lead_id: data.lead_id,
      rep_id: userId,
      type: data.type,
      direction: data.direction,
      outcome: data.outcome ?? null,
      notes: data.notes || null,
      duration_seconds: data.duration_seconds ?? null,
      occurred_at: data.occurred_at ?? new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Activity totals for the current week, per visible rep — feeds the 50-touch quota. */
export const getActivityRollup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const now = new Date();
    const day = (now.getUTCDay() + 6) % 7; // Monday = 0
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - day);
    weekStart.setUTCHours(0, 0, 0, 0);

    const { data, error } = await context.supabase
      .from("activities")
      .select("rep_id, type, occurred_at")
      .gte("occurred_at", weekStart.toISOString())
      .limit(10000);
    if (error) throw new Error(error.message);

    const byRep: Record<string, { touches: number; today: number }> = {};
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    for (const row of data ?? []) {
      const bucket = (byRep[row.rep_id] ??= { touches: 0, today: 0 });
      bucket.touches += 1;
      if (new Date(row.occurred_at) >= todayStart) bucket.today += 1;
    }
    return { weekStart: weekStart.toISOString(), byRep };
  });

// ─── Hardware ──────────────────────────────────────────────────────────

/** Terminals currently sitting with this prospect. */
export const listLeadDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ lead_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("devices")
      .select("id, serial_number, model, status, coin_id, assigned_rep_id, updated_at")
      .eq("current_lead_id", data.lead_id)
      .order("serial_number");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
