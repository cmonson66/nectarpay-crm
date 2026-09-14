import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";


export const DEAL_TYPES = ["sale", "contingent"] as const;
export const DEAL_STATUSES = ["open", "won", "lost", "converted", "returned", "pending"] as const;
export const DEVICE_STATUSES = [
  "in_inventory",
  "assigned_to_rep",
  "placed_contingent",
  "pending_sale",
  "sold",
  "returned",
  "lost",
  "damaged",
] as const;
export const PLACEMENT_STATUSES = ["active", "converted", "returned", "overdue", "extended"] as const;
export const TASK_TYPES = ["contingent_followup", "contingent_pickup", "callback", "manual"] as const;
export const PAYMENT_METHODS = ["ACH", "Check", "Zelle", "Plaid"] as const;

export type DealStatus = (typeof DEAL_STATUSES)[number];
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];
export type PlacementStatus = (typeof PLACEMENT_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const DEAL_COLUMNS =
  "id, lead_id, rep_id, type, status, hardware_amount, subscription_monthly, subscription_months, total_amount, notes, is_demo, payment_method, closed_at, converted_from_deal_id, device_id, nectarpay_invoice_id, nectarpay_checkout_url, nectarpay_status, paid_at, contract_signer_name, contract_signature, contract_signed_at, created_at";

/** Flat price for an admin-logged demo sale (no subscription). */
export const DEMO_SALE_PRICE = 250;
const PLACEMENT_COLUMNS =
  "id, deal_id, device_id, lead_id, rep_id, placed_at, expires_at, followup_due_at, followup_completed_at, status, outcome_notes, picked_up_at";

// ─── Deals ─────────────────────────────────────────────────────────────

export const listLeadDeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ lead_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: deals, error }, { data: placements }, { data: devices }] = await Promise.all([
      context.supabase
        .from("deals")
        .select(DEAL_COLUMNS)
        .eq("lead_id", data.lead_id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("contingent_placements")
        .select(PLACEMENT_COLUMNS)
        .eq("lead_id", data.lead_id)
        .order("placed_at", { ascending: false }),
      context.supabase
        .from("devices")
        .select("id, serial_number, model, status, current_lead_id, coin_id")
        .in("status", ["in_inventory", "assigned_to_rep", "returned"])
        .order("serial_number"),
    ]);
    if (error) throw new Error(error.message);
    return { deals: deals ?? [], placements: placements ?? [], availableDevices: devices ?? [] };
  });

const dealSchema = z.object({
  lead_id: z.string().uuid(),
  type: z.enum(DEAL_TYPES),
  hardware_amount: z.number().min(0).max(100000).default(499),
  subscription_monthly: z.number().min(0).max(10000).default(19),
  subscription_months: z.number().int().min(0).max(120).default(12),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  /** How the deal will be paid. Required for sales; optional for contingent trials. */
  payment_method: z.enum(PAYMENT_METHODS).optional().nullable(),
  /** A terminal must be assigned for every deal. */
  device_id: z.string().uuid(),
  /** Trial length for contingent placements only. */
  duration_days: z.number().int().min(14).max(30).optional().default(14),
  /** Admin-only: log at the flat demo price instead of standard terms. */
  is_demo: z.boolean().optional().default(false),
}).superRefine((val, ctx) => {
  if (!val.device_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select a terminal",
      path: ["device_id"],
    });
  }
  if (val.type === "contingent") {
    if (val.is_demo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Demo pricing only applies to sales",
        path: ["is_demo"],
      });
    }
  }
  if (val.type === "sale" && !val.payment_method && !val.is_demo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select a payment method",
      path: ["payment_method"],
    });
  }
});

export const createDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => dealSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: dealId, error } = await context.supabase.rpc("create_deal_with_terminal", {
      p_lead_id: data.lead_id,
      p_deal_type: data.type,
      p_hardware_amount: data.hardware_amount,
      p_subscription_monthly: data.subscription_monthly,
      p_subscription_months: data.subscription_months,
      p_notes: data.notes || "",
      p_payment_method: data.payment_method || "",
      p_device_id: data.device_id,
      p_duration_days: data.duration_days ?? 14,
      p_is_demo: data.is_demo,
    });
    if (error) throw new Error(error.message);

    return { id: dealId };
  });

export const signDealContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        signer_name: z.string().trim().min(1).max(200),
        signature: z
          .string()
          .regex(/^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/, "Invalid signature image")
          .max(1_500_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: deal, error: readError } = await context.supabase
      .from("deals")
      .select("id, status, type")
      .eq("id", data.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!deal) throw new Error("Pending deal not found");
    const allowedStatuses: Array<Database["public"]["Enums"]["deal_status"]> = deal.type === "contingent"
      ? ["pending", "open"]
      : ["pending"];
    if (!allowedStatuses.includes(deal.status)) throw new Error("This deal is no longer awaiting a contract");

    const { error } = await context.supabase
      .from("deals")
      .update({
        contract_signer_name: data.signer_name,
        contract_signature: data.signature,
        contract_signed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .in("status", allowedStatuses);
    if (error) throw new Error(error.message);

    // File the signed agreement against the lead. A generation failure must not
    // undo a signature the merchant already gave, but the rep must be told.
    let documentError: string | null = null;
    try {
      const { generateDealDocument } = await import("@/lib/deal-documents.server");
      await generateDealDocument(context.supabase, {
        dealId: data.id,
        kind: deal.type === "contingent" ? "trial_agreement" : "purchase_agreement",
        createdBy: context.userId,
      });
    } catch (docError) {
      documentError = docError instanceof Error ? docError.message : "Unknown error";
      console.error("[documents] agreement generation failed", docError);
    }
    return { ok: true, documentError };

  });

const invoiceSchema = z.object({ id: z.string().uuid(), chain: z.string().trim().min(1).max(40).default("bitcoin") });

export const createDealInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => invoiceSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: deal, error } = await context.supabase
      .from("deals")
      .select("id, lead_id, status, total_amount, contract_signed_at, nectarpay_invoice_id, nectarpay_expires_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deal || deal.status !== "pending") throw new Error("This deal is no longer pending");
    if (!deal.contract_signed_at) throw new Error("Sign the contract before requesting payment");
    if (deal.nectarpay_invoice_id && deal.nectarpay_expires_at && new Date(deal.nectarpay_expires_at).getTime() > Date.now()) {
      return { id: deal.nectarpay_invoice_id, checkoutUrl: null, status: "pending", expiresAt: deal.nectarpay_expires_at };
    }

    const { createNectarPayInvoice } = await import("@/lib/nectarpay.server");
    const request = getRequest();
    const invoice = await createNectarPayInvoice({
      amount: Number(deal.total_amount ?? 0),
      chain: data.chain,
      orderId: deal.id,
      redirectUrl: new URL(`/crm/leads/${deal.lead_id}`, request.url).toString(),
    });
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error: updateError } = await context.supabase
      .from("deals")
      .update({
        nectarpay_invoice_id: invoice.id,
        nectarpay_checkout_url: invoice.checkoutUrl,
        nectarpay_status: invoice.status,
        nectarpay_expires_at: expiresAt,
      })
      .eq("id", deal.id)
      .eq("status", "pending");
    if (updateError) throw new Error(updateError.message);
    return { id: invoice.id, checkoutUrl: invoice.checkoutUrl, address: invoice.address, status: invoice.status, expiresAt };
  });

export const getDealPaymentStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: deal, error } = await context.supabase
      .from("deals")
      .select("id, status, nectarpay_invoice_id, nectarpay_checkout_url, nectarpay_status, nectarpay_expires_at, paid_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deal) throw new Error("Deal not found");
    return deal;
  });


export const updateDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(DEAL_STATUSES).optional(),
        notes: z.string().max(2000).nullable().optional(),
        hardware_amount: z.number().min(0).max(100000).optional(),
        subscription_monthly: z.number().min(0).max(10000).optional(),
        subscription_months: z.number().int().min(0).max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const patch: Record<string, unknown> = { ...rest };
    if (rest.status && ["won", "lost", "converted", "returned"].includes(rest.status)) {
      patch.closed_at = new Date().toISOString();
    }
    const { error } = await context.supabase.from("deals").update(patch as never).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Contingent placements ─────────────────────────────────────────────

export const listPlacements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contingent_placements")
      .select(
        `${PLACEMENT_COLUMNS}, leads:lead_id (id, business_name, city, state), devices:device_id (id, serial_number)`,
      )
      .order("expires_at", { ascending: true })
      .limit(1000);
    if (error) throw new Error(error.message);
    const { data: reps } = await context.supabase.from("profiles").select("user_id, full_name, email");
    return { placements: data ?? [], reps: reps ?? [] };
  });

export const updatePlacement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(PLACEMENT_STATUSES).optional(),
        outcome_notes: z.string().max(2000).nullable().optional(),
        followup_done: z.boolean().optional(),
        extend_days: z.number().int().min(1).max(60).optional(),
        picked_up: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: current, error: readErr } = await supabase
      .from("contingent_placements")
      .select("id, expires_at, device_id, lead_id, deal_id")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!current) throw new Error("Placement not found");

    const patch: Record<string, unknown> = {};
    if (data.status) patch.status = data.status;
    if (data.outcome_notes !== undefined) patch.outcome_notes = data.outcome_notes;
    if (data.followup_done) patch.followup_completed_at = new Date().toISOString();
    if (data.picked_up) patch.picked_up_at = new Date().toISOString();
    if (data.extend_days) {
      patch.expires_at = new Date(
        new Date(current.expires_at).getTime() + data.extend_days * 86400000,
      ).toISOString();
      patch.status = "extended";
    }

    const { error } = await supabase.from("contingent_placements").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);

    // Device follows the placement outcome.
    if (current.device_id && data.status) {
      if (data.status === "converted") {
        await supabase.from("devices").update({ status: "sold" }).eq("id", current.device_id);
      } else if (data.status === "returned") {
        await supabase
          .from("devices")
          .update({ status: "returned", current_lead_id: null })
          .eq("id", current.device_id);
      }
    }
    if (data.status === "converted") {
      await supabase.from("leads").update({ status: "won" }).eq("id", current.lead_id);
      if (current.deal_id) {
        await supabase
          .from("deals")
          .update({ status: "converted", closed_at: new Date().toISOString() })
          .eq("id", current.deal_id);
      }
    }
    return { ok: true };
  });

// ─── Devices ───────────────────────────────────────────────────────────

export const listDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data, error }, { data: reps }, { data: leads }, { data: teams }, { data: members }] =
      await Promise.all([
        context.supabase
          .from("devices")
          .select("id, serial_number, model, status, assigned_rep_id, current_lead_id, notes, coin_id, updated_at")
          .order("serial_number"),
        context.supabase.from("profiles").select("user_id, full_name, email"),
        context.supabase.from("leads").select("id, business_name"),
        context.supabase.from("teams").select("id, name, manager_id, is_active"),
        context.supabase.from("team_members").select("team_id, user_id, left_at").is("left_at", null),
      ]);
    if (error) throw new Error(error.message);
    return {
      devices: data ?? [],
      reps: reps ?? [],
      leads: leads ?? [],
      teams: teams ?? [],
      teamMembers: members ?? [],
    };
  });

const coinIdSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Coin ID must be exactly 6 digits")
  .nullable()
  .optional()
  .or(z.literal(""));

export const upsertDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        serial_number: z.string().trim().min(1).max(120),
        model: z.string().trim().max(120).optional().or(z.literal("")),
        status: z.enum(DEVICE_STATUSES).default("in_inventory"),
        assigned_rep_id: z.string().uuid().nullable().optional(),
        notes: z.string().trim().max(1000).optional().or(z.literal("")),
        /** Optional 6-digit coin key linked to this terminal. Omitted = leave unchanged. */
        coin_id: coinIdSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const row: Record<string, unknown> = {
      serial_number: data.serial_number,
      model: data.model || "NectarPay POS",
      status: data.status,
      assigned_rep_id: data.assigned_rep_id ?? null,
      notes: data.notes || null,
    };
    // Only touch the coin link when the caller explicitly passes it, so
    // status/reassignment edits don't accidentally wipe an existing coin.
    if (data.coin_id !== undefined) row.coin_id = data.coin_id || null;
    const { error } = data.id
      ? await context.supabase.from("devices").update(row as never).eq("id", data.id)
      : await context.supabase.from("devices").insert(row as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin-only: detach the coin key from a terminal (coin itself is unaffected). */
export const unlinkDeviceCoin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only admins can unlink a coin from a terminal");
    const { error } = await context.supabase
      .from("devices")
      .update({ coin_id: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("devices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Assign many scanned serials to one rep; optionally create the ones missing from inventory. */
export const bulkAssignDevices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        serials: z.array(z.string().trim().min(1).max(120)).min(1).max(500),
        assigned_rep_id: z.string().uuid(),
        create_missing: z.array(z.string().trim().min(1).max(120)).default([]),
        model: z.string().trim().max(120).default("NectarPay POS"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const wanted = Array.from(new Set(data.serials.map((s) => s.trim()).filter(Boolean)));
    const { data: existing, error: readErr } = await context.supabase
      .from("devices")
      .select("id, serial_number")
      .in("serial_number", wanted);
    if (readErr) throw new Error(readErr.message);

    const foundIds = (existing ?? []).map((d) => d.id);
    if (foundIds.length) {
      const { error } = await context.supabase
        .from("devices")
        .update({ status: "assigned_to_rep", assigned_rep_id: data.assigned_rep_id })
        .in("id", foundIds);
      if (error) throw new Error(error.message);
    }

    const foundSerials = new Set((existing ?? []).map((d) => d.serial_number.toLowerCase()));
    const toCreate = Array.from(new Set(data.create_missing.map((s) => s.trim()).filter(Boolean))).filter(
      (s) => !foundSerials.has(s.toLowerCase()),
    );
    if (toCreate.length) {
      const { error } = await context.supabase.from("devices").insert(
        toCreate.map((serial_number) => ({
          serial_number,
          model: data.model || "NectarPay POS",
          status: "assigned_to_rep" as const,
          assigned_rep_id: data.assigned_rep_id,
        })),
      );
      if (error) throw new Error(error.message);
    }

    const skipped = wanted.filter(
      (s) => !foundSerials.has(s.toLowerCase()) && !toCreate.some((c) => c.toLowerCase() === s.toLowerCase()),
    );
    return { assigned: foundIds.length, created: toCreate.length, skipped };
  });


// ─── Tasks ─────────────────────────────────────────────────────────────

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tasks")
      .select(
        "id, lead_id, deal_id, placement_id, assigned_to, type, title, due_at, completed_at, auto_generated, leads:lead_id (id, business_name)",
      )
      .order("completed_at", { ascending: true, nullsFirst: true })
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const { data: reps } = await context.supabase.from("profiles").select("user_id, full_name, email");
    return { tasks: data ?? [], reps: reps ?? [] };
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        title: z.string().trim().min(1).max(200),
        lead_id: z.string().uuid().nullable().optional(),
        assigned_to: z.string().uuid().nullable().optional(),
        type: z.enum(TASK_TYPES).default("manual"),
        due_at: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("tasks").insert({
      title: data.title,
      lead_id: data.lead_id ?? null,
      assigned_to: data.assigned_to ?? userId,
      type: data.type,
      due_at: data.due_at || null,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setTaskDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), done: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tasks")
      .update({ completed_at: data.done ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
