import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { addDays, isSunday, listRecentSundays, sundayOfWeek, todayInNy, weekLabel, weekRangeUtc } from "@/lib/weeks";

export const COMMISSION_ROLES = ["rep", "manager_override", "gm_override"] as const;
export const COMMISSION_RATE_TYPES = ["flat", "percent"] as const;
export const COMMISSION_APPLIES_TO = ["hardware", "subscription", "total"] as const;
export const COMMISSION_STATUSES = ["pending", "approved", "paid", "clawed_back"] as const;

export type CommissionRole = (typeof COMMISSION_ROLES)[number];
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

// ─── Periods (quota config still lives on quota_periods) ───────────────

export const listQuotaPeriods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("quota_periods")
      .select("id, period_start, period_end, is_current")
      .order("period_start", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ─── Weekly report ─────────────────────────────────────────────────────

const weekInput = z.object({
  week_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type WeeklyPnl = {
  full_count: number;
  demo_count: number;
  full_revenue: number;
  demo_revenue: number;
  units: number;
  unit_cost: number;
  cogs: number;
  collections: Record<"check" | "ach" | "zelle" | "plaid" | "other", number>;
  collections_total: number;
  salaries: { user_id: string; name: string; weekly_salary: number }[];
  total_salaries: number;
  commissions_total: number;
  net: number;
};

export const getCommissionReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => weekInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Week selection: Sunday→Saturday in America/New_York.
    const currentSunday = sundayOfWeek(todayInNy());
    const requested =
      data.week_start && isSunday(data.week_start) ? data.week_start : currentSunday;
    const weeks = listRecentSundays(16);
    if (!weeks.includes(requested)) weeks.unshift(requested);
    const { from, to } = weekRangeUtc(requested);

    const [
      { data: roleRows },
      { data: profiles },
      { data: periods },
      { data: commissions },
      { data: activities },
      { data: deals },
      { data: placements },
      { data: rules },
    ] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("user_id, full_name, email, is_active"),
      supabase
        .from("quota_periods")
        .select("id, period_start, period_end, is_current")
        .order("period_start", { ascending: false })
        .limit(60),
      supabase.from("commissions").select("*").eq("week_start", requested).limit(5000),
      supabase.from("activities").select("rep_id").gte("occurred_at", from).lt("occurred_at", to).limit(20000),
      supabase
        .from("deals")
        .select(
          "id, lead_id, rep_id, status, total_amount, hardware_amount, subscription_monthly, subscription_months, closed_at, is_demo, payment_method",
        )
        .eq("status", "won")
        .gte("closed_at", from)
        .lt("closed_at", to)
        .limit(5000),
      supabase
        .from("contingent_placements")
        .select("id, rep_id, placed_at")
        .gte("placed_at", from)
        .lt("placed_at", to)
        .limit(5000),
      supabase.from("commission_rules").select("*").order("effective_from", { ascending: false }),
    ]);

    const roles = (roleRows ?? []).map((r) => r.role as string);
    const isAdmin = roles.includes("admin");
    const isManager = roles.includes("manager");

    // Quota targets come from the period overlapping this week (fallback: current / latest).
    const weekEnd = addDays(requested, 6);
    const period =
      (periods ?? []).find((p) => p.period_start <= requested && p.period_end >= requested) ??
      (periods ?? []).find((p) => p.is_current) ??
      (periods ?? [])[0] ??
      null;

    const { data: quotas } = period
      ? await supabase.from("quotas").select("*").eq("period_id", period.id)
      : { data: [] as never[] };

    const nameOf = new Map(
      (profiles ?? []).map((p) => [p.user_id, p.full_name || p.email || "Unknown"]),
    );

    type Row = {
      rep_id: string;
      name: string;
      touches: number;
      touches_target: number;
      sales: number;
      sales_minimum: number;
      sales_target: number;
      contingents: number;
      contingents_target: number;
      revenue: number;
      earned: number;
      pending: number;
      approved: number;
      paid: number;
    };
    const rows = new Map<string, Row>();
    const quotaOf = new Map((quotas ?? []).map((q) => [q.rep_id, q]));
    const bucket = (id: string): Row => {
      let r = rows.get(id);
      if (!r) {
        const q = quotaOf.get(id);
        r = {
          rep_id: id,
          name: nameOf.get(id) ?? "Unknown",
          touches: 0,
          touches_target: q?.touches_target ?? 50,
          sales: 0,
          sales_minimum: q?.sales_minimum ?? 5,
          sales_target: q?.sales_target ?? 20,
          contingents: 0,
          contingents_target: q?.contingents_target ?? 5,
          revenue: 0,
          earned: 0,
          pending: 0,
          approved: 0,
          paid: 0,
        };
        rows.set(id, r);
      }
      return r;
    };
    bucket(userId);
    for (const q of quotas ?? []) bucket(q.rep_id);
    for (const a of activities ?? []) bucket(a.rep_id).touches += 1;
    for (const d of deals ?? []) {
      const r = bucket(d.rep_id);
      r.sales += 1;
      r.revenue += Number(d.total_amount ?? 0);
    }
    for (const p of placements ?? []) bucket(p.rep_id).contingents += 1;
    for (const c of commissions ?? []) {
      const r = bucket(c.user_id);
      const amt = Number(c.amount ?? 0);
      if (c.status === "clawed_back") continue;
      r.earned += amt;
      if (c.status === "pending") r.pending += amt;
      if (c.status === "approved") r.approved += amt;
      if (c.status === "paid") r.paid += amt;
    }

    const totals = [...rows.values()].reduce(
      (acc, r) => {
        acc.touches += r.touches;
        acc.sales += r.sales;
        acc.revenue += r.revenue;
        acc.earned += r.earned;
        return acc;
      },
      { touches: 0, sales: 0, revenue: 0, earned: 0 },
    );

    // ─── Admin-only P&L rollup ─────────────────────────────────────────
    let pnl: WeeklyPnl | null = null;
    if (isAdmin) {
      const [{ data: salaryRows }, { data: costRow }, { data: allRoles }] = await Promise.all([
        supabase.from("rep_salaries").select("user_id, weekly_salary"),
        supabase.from("pnl_settings").select("value").eq("key", "terminal_unit_cost").maybeSingle(),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      const salaryOf = new Map((salaryRows ?? []).map((s) => [s.user_id, Number(s.weekly_salary)]));
      const activeProfiles = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      const seen = new Set<string>();
      const salaries: { user_id: string; name: string; weekly_salary: number }[] = [];
      for (const r of allRoles ?? []) {
        if (r.role !== "rep" && r.role !== "manager") continue;
        if (seen.has(r.user_id)) continue;
        seen.add(r.user_id);
        const prof = activeProfiles.get(r.user_id);
        if (prof && prof.is_active === false) continue;
        salaries.push({
          user_id: r.user_id,
          name: nameOf.get(r.user_id) ?? "Unknown",
          weekly_salary: salaryOf.get(r.user_id) ?? 0,
        });
      }
      salaries.sort((a, b) => a.name.localeCompare(b.name));
      const totalSalaries = salaries.reduce((s, r) => s + r.weekly_salary, 0);

      const unitCost = Number(costRow?.value ?? 0) || 0;

      let fullCount = 0;
      let demoCount = 0;
      let fullRevenue = 0;
      let demoRevenue = 0;
      const collections: WeeklyPnl["collections"] = { check: 0, ach: 0, zelle: 0, plaid: 0, other: 0 };
      for (const d of deals ?? []) {
        const amt = Number(d.total_amount ?? 0);
        if (d.is_demo) {
          demoCount += 1;
          demoRevenue += amt;
        } else {
          fullCount += 1;
          fullRevenue += amt;
        }
        const method = (d.payment_method ?? "").trim().toLowerCase();
        if (method === "check" || method === "ach" || method === "zelle" || method === "plaid") {
          collections[method] += amt;
        } else {
          collections.other += amt;
        }
      }

      const units = fullCount + demoCount;
      const cogs = units * unitCost;
      const collectionsTotal = fullRevenue + demoRevenue;

      pnl = {
        full_count: fullCount,
        demo_count: demoCount,
        full_revenue: fullRevenue,
        demo_revenue: demoRevenue,
        units,
        unit_cost: unitCost,
        cogs,
        collections,
        collections_total: collectionsTotal,
        salaries,
        total_salaries: totalSalaries,
        commissions_total: totals.earned,
        net: collectionsTotal - cogs - totalSalaries - totals.earned,
      };
    }

    return {
      isAdmin,
      isManager,
      viewerId: userId,
      week: { start: requested, end: weekEnd, label: weekLabel(requested) },
      weeks: weeks.map((w) => ({
        start: w,
        label: weekLabel(w),
        is_current: w === currentSunday,
      })),
      period,
      periods: periods ?? [],
      rows: [...rows.values()].sort((a, b) => b.earned - a.earned || a.name.localeCompare(b.name)),
      lines: (commissions ?? []).map((c) => ({
        id: c.id,
        deal_id: c.deal_id,
        user_id: c.user_id,
        name: nameOf.get(c.user_id) ?? "Unknown",
        role_in_deal: c.role_in_deal as CommissionRole,
        amount: Number(c.amount ?? 0),
        status: c.status as CommissionStatus,
      })),
      rules: rules ?? [],
      totals,
      pnl,
    };
  });

// ─── Recalculate (admin) ───────────────────────────────────────────────

export const recalcCommissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    if (!isSunday(data.week_start)) throw new Error("week_start must be a Sunday");

    const { calculateCommissionsForWeek } = await import("@/lib/commissions.server");
    return calculateCommissionsForWeek(data.week_start);
  });

// ─── Weekly P&L inputs (admin) ─────────────────────────────────────────

export const upsertSalary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        user_id: z.string().uuid(),
        weekly_salary: z.number().min(0).max(1000000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { error } = await supabase
      .from("rep_salaries")
      .upsert(
        { user_id: data.user_id, weekly_salary: data.weekly_salary, updated_by: userId } as never,
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setTerminalUnitCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ unit_cost: z.number().min(0).max(1000000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { error } = await supabase
      .from("pnl_settings")
      .upsert({ key: "terminal_unit_cost", value: String(data.unit_cost) } as never, {
        onConflict: "key",
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Mutations (admin) ─────────────────────────────────────────────────

export const setCommissionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(500),
        status: z.enum(COMMISSION_STATUSES),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "approved") {
      patch.approved_by = context.userId;
      patch.approved_at = now;
    }
    if (data.status === "paid") patch.paid_at = now;

    const { error } = await context.supabase
      .from("commissions")
      .update(patch as never)
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, count: data.ids.length };
  });

export const upsertCommissionRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        role_in_deal: z.enum(COMMISSION_ROLES),
        rate_type: z.enum(COMMISSION_RATE_TYPES),
        rate_value: z.number().min(0).max(1000000),
        applies_to: z.enum(COMMISSION_APPLIES_TO),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = id
      ? await context.supabase.from("commission_rules").update(rest as never).eq("id", id)
      : await context.supabase.from("commission_rules").insert(rest as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        rep_id: z.string().uuid(),
        period_id: z.string().uuid(),
        touches_target: z.number().int().min(0).max(10000),
        sales_minimum: z.number().int().min(0).max(10000),
        sales_target: z.number().int().min(0).max(10000),
        contingents_target: z.number().int().min(0).max(10000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("quotas")
      .upsert(data as never, { onConflict: "rep_id,period_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
