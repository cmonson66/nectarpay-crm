import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const WEEKLY_TOUCH_QUOTA = 50;

export const DEFAULT_TARGETS = {
  touches_target: 50,
  sales_minimum: 5,
  sales_target: 20,
  contingents_target: 5,
};

type Period = {
  id: string | null;
  period_start: string;
  period_end: string;
  from: string;
  to: string;
};

/**
 * Resolve the active quota period. Uses the quota_periods row that actually
 * contains today (is_current can go stale when weeks aren't rotated), otherwise
 * falls back to the current Mon–Sun week.
 */
async function resolvePeriod(supabase: {
  from: (t: "quota_periods") => any;
}): Promise<Period> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("quota_periods")
    .select("id, period_start, period_end, is_current")
    .lte("period_start", today)
    .gte("period_end", today)
    .order("period_start", { ascending: false })
    .limit(1);
  const row = (data ?? [])[0];
  if (row) {
    return {
      id: row.id,
      period_start: row.period_start,
      period_end: row.period_end,
      from: new Date(`${row.period_start}T00:00:00.000Z`).toISOString(),
      to: new Date(`${row.period_end}T23:59:59.999Z`).toISOString(),
    };
  }

  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return {
    id: null,
    period_start: start.toISOString().slice(0, 10),
    period_end: end.toISOString().slice(0, 10),
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

function dayBounds() {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  return { dayStart: dayStart.toISOString(), dayEnd: dayEnd.toISOString() };
}

async function loadRoles(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  return {
    roles,
    isAdmin: roles.includes("admin"),
    isManager: roles.includes("manager"),
    role: roles.includes("admin") ? "admin" : roles.includes("manager") ? "manager" : "rep",
  } as const;
}

export type TeamRow = {
  rep_id: string;
  name: string;
  email: string | null;
  is_active: boolean;
  touches: number;
  calls_today: number;
  emails_today: number;
  activity_today: number;
  open_leads: number;
  active_contingents: number;
  sales: number;
  revenue: number;
  sales_minimum: number;
  touches_target: number;
  sales_target: number;
  contingents_target: number;
  last_activity_at: string | null;
  manager_id: string | null;
  manager_name: string | null;
  team_name: string | null;
};

/**
 * Core scoped aggregate. Every table read here is behind an RLS policy built on
 * visible_rep_ids(auth.uid()), so a rep only ever sees their own rows — the
 * server, not the client, decides the scope.
 */
async function buildTeamRows(supabase: any, period: Period) {
  const { dayStart, dayEnd } = dayBounds();

  const [
    { data: profiles },
    { data: quotas },
    { data: activities },
    { data: deals },
    { data: leads },
    { data: placements },
    { data: teams },
    { data: members },
  ] = await Promise.all([
    supabase.from("profiles").select("user_id, full_name, email, is_active"),
    period.id
      ? supabase.from("quotas").select("*").eq("period_id", period.id)
      : Promise.resolve({ data: [] }),
    supabase
      .from("activities")
      .select("id, rep_id, type, occurred_at")
      .gte("occurred_at", period.from)
      .lte("occurred_at", period.to)
      .limit(20000),
    supabase
      .from("deals")
      .select("id, rep_id, status, total_amount, closed_at")
      .eq("status", "won")
      .gte("closed_at", period.from)
      .lte("closed_at", period.to)
      .limit(5000),
    supabase.from("leads").select("id, owner_rep_id, status, last_activity_at").limit(5000),
    supabase
      .from("contingent_placements")
      .select("id, rep_id, status")
      .in("status", ["active", "extended", "overdue"])
      .limit(2000),
    supabase.from("teams").select("id, name, manager_id"),
    supabase.from("team_members").select("team_id, user_id, left_at").is("left_at", null),
  ]);

  const teamOf = new Map<string, { id: string; name: string; manager_id: string | null }>();
  for (const t of teams ?? []) teamOf.set(t.id, t);
  const memberTeam = new Map<string, { name: string; manager_id: string | null }>();
  for (const m of members ?? []) {
    const t = teamOf.get(m.team_id);
    if (t) memberTeam.set(m.user_id, { name: t.name, manager_id: t.manager_id });
  }

  const nameOf = new Map<string, string>(
    (profiles ?? []).map((p: any) => [p.user_id, p.full_name || p.email || "Unknown"]),
  );
  const quotaOf = new Map((quotas ?? []).map((q: any) => [q.rep_id, q]));

  const rows = new Map<string, TeamRow>();
  const bucket = (id: string): TeamRow => {
    let r = rows.get(id);
    if (!r) {
      const q: any = quotaOf.get(id);
      const team = memberTeam.get(id);
      const profile = (profiles ?? []).find((p: any) => p.user_id === id);
      r = {
        rep_id: id,
        name: nameOf.get(id) ?? "Unknown",
        email: profile?.email ?? null,
        is_active: profile?.is_active ?? true,
        touches: 0,
        calls_today: 0,
        emails_today: 0,
        activity_today: 0,
        open_leads: 0,
        active_contingents: 0,
        sales: 0,
        revenue: 0,
        touches_target: q?.touches_target ?? DEFAULT_TARGETS.touches_target,
        sales_minimum: q?.sales_minimum ?? DEFAULT_TARGETS.sales_minimum,
        sales_target: q?.sales_target ?? DEFAULT_TARGETS.sales_target,
        contingents_target: q?.contingents_target ?? DEFAULT_TARGETS.contingents_target,
        last_activity_at: null,
        manager_id: team?.manager_id ?? null,
        manager_name: team?.manager_id ? (nameOf.get(team.manager_id) ?? null) : null,
        team_name: team?.name ?? null,
      };
      rows.set(id, r);
    }
    return r;
  };

  // Only profiles the caller may see (RLS: visible_rep_ids) become rows.
  for (const p of profiles ?? []) bucket(p.user_id);

  for (const a of activities ?? []) {
    if (!rows.has(a.rep_id)) continue;
    const r = bucket(a.rep_id);
    r.touches += 1;
    if (a.occurred_at >= dayStart && a.occurred_at < dayEnd) {
      r.activity_today += 1;
      if (a.type === "call") r.calls_today += 1;
      if (a.type === "email") r.emails_today += 1;
    }
    if (!r.last_activity_at || a.occurred_at > r.last_activity_at) r.last_activity_at = a.occurred_at;
  }
  for (const d of deals ?? []) {
    if (!rows.has(d.rep_id)) continue;
    const r = bucket(d.rep_id);
    r.sales += 1;
    r.revenue += Number(d.total_amount ?? 0);
  }
  for (const l of leads ?? []) {
    if (!l.owner_rep_id || !rows.has(l.owner_rep_id)) continue;
    if (["won", "lost", "do_not_contact"].includes(l.status)) continue;
    bucket(l.owner_rep_id).open_leads += 1;
  }
  for (const p of placements ?? []) {
    if (!rows.has(p.rep_id)) continue;
    bucket(p.rep_id).active_contingents += 1;
  }

  return [...rows.values()];
}

/** Mid-week pace flag: after Wednesday, below (elapsed/7) of the touch target. */
export function paceInfo(period: Period) {
  const start = new Date(`${period.period_start}T00:00:00.000Z`).getTime();
  const elapsedDays = Math.min(7, Math.max(0, (Date.now() - start) / 86_400_000));
  return { elapsedDays, midWeek: elapsedDays >= 3 };
}

export const getTeamBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const meta = await loadRoles(supabase, userId);
    const period = await resolvePeriod(supabase as never);
    const rows = await buildTeamRows(supabase, period);
    const { elapsedDays, midWeek } = paceInfo(period);
    return {
      role: meta.role,
      isAdmin: meta.isAdmin,
      isManager: meta.isManager,
      period: { ...period },
      elapsedDays,
      midWeek,
      rows,
    };
  });

export const getRepDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ rep_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const meta = await loadRoles(supabase, userId);
    const period = await resolvePeriod(supabase as never);

    // Scope check comes from the database, not the client: profiles SELECT is
    // gated on visible_rep_ids(auth.uid()).
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, phone_e164, is_active, hire_date")
      .eq("user_id", data.rep_id)
      .maybeSingle();
    if (!profile) {
      return { found: false as const, role: meta.role };
    }

    const rows = await buildTeamRows(supabase, period);
    const summary = rows.find((r) => r.rep_id === data.rep_id) ?? null;

    const [{ data: leads }, { data: activities }, { data: deals }, { data: placements }, { data: tasks }] =
      await Promise.all([
        supabase
          .from("leads")
          .select("id, business_name, status, city, state, last_activity_at, follow_up_at")
          .eq("owner_rep_id", data.rep_id)
          .order("last_activity_at", { ascending: false, nullsFirst: false })
          .limit(500),
        supabase
          .from("activities")
          .select("id, lead_id, type, direction, outcome, notes, occurred_at")
          .eq("rep_id", data.rep_id)
          .order("occurred_at", { ascending: false })
          .limit(100),
        supabase
          .from("deals")
          .select("id, lead_id, status, type, total_amount, closed_at, created_at")
          .eq("rep_id", data.rep_id)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("contingent_placements")
          .select("id, lead_id, status, placed_at, expires_at, followup_due_at, followup_completed_at")
          .eq("rep_id", data.rep_id)
          .order("placed_at", { ascending: false })
          .limit(200),
        supabase
          .from("tasks")
          .select("id, lead_id, title, type, due_at, completed_at")
          .eq("assigned_to", data.rep_id)
          .is("completed_at", null)
          .order("due_at", { ascending: true, nullsFirst: false })
          .limit(100),
      ]);

    const leadName = new Map((leads ?? []).map((l: any) => [l.id, l.business_name ?? "Untitled"]));

    return {
      found: true as const,
      role: meta.role,
      period,
      profile,
      summary,
      leads: leads ?? [],
      activities: (activities ?? []).map((a: any) => ({
        ...a,
        lead_name: a.lead_id ? (leadName.get(a.lead_id) ?? null) : null,
      })),
      deals: (deals ?? []).map((d: any) => ({ ...d, lead_name: leadName.get(d.lead_id) ?? null })),
      placements: (placements ?? []).map((p: any) => ({
        ...p,
        lead_name: leadName.get(p.lead_id) ?? null,
      })),
      tasks: (tasks ?? []).map((t: any) => ({
        ...t,
        lead_name: t.lead_id ? (leadName.get(t.lead_id) ?? null) : null,
      })),
    };
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const meta = await loadRoles(supabase, userId);
    const period = await resolvePeriod(supabase as never);
    const { dayEnd } = dayBounds();
    const nowIso = new Date().toISOString();

    const [rows, { data: tasks }, { data: placements }, { data: leads }] = await Promise.all([
      buildTeamRows(supabase, period),
      supabase
        .from("tasks")
        .select("id, lead_id, assigned_to, type, title, due_at, completed_at")
        .eq("assigned_to", userId)
        .is("completed_at", null)
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(200),
      supabase
        .from("contingent_placements")
        .select("id, lead_id, rep_id, status, expires_at, followup_due_at, followup_completed_at")
        .eq("rep_id", userId)
        .in("status", ["active", "extended", "overdue"])
        .limit(500),
      supabase.from("leads").select("id, business_name, status").limit(5000),
    ]);

    const leadName = new Map((leads ?? []).map((l) => [l.id, l.business_name ?? "Untitled"]));

    const me =
      rows.find((r) => r.rep_id === userId) ??
      ({
        rep_id: userId,
        name: "You",
        email: null,
        is_active: true,
        touches: 0,
        calls_today: 0,
        emails_today: 0,
        activity_today: 0,
        open_leads: 0,
        active_contingents: 0,
        sales: 0,
        revenue: 0,
        ...DEFAULT_TARGETS,
        last_activity_at: null,
        manager_id: null,
        manager_name: null,
        team_name: null,
      } satisfies TeamRow);

    const dueTasks = (tasks ?? [])
      .filter((t) => t.due_at && t.due_at < dayEnd)
      .map((t) => ({
        id: t.id,
        title: t.title,
        type: t.type,
        due_at: t.due_at,
        lead_id: t.lead_id,
        lead_name: t.lead_id ? (leadName.get(t.lead_id) ?? null) : null,
        overdue: Boolean(t.due_at && t.due_at < nowIso),
      }));

    const myPlacements = (placements ?? [])
      .filter((p) => p.status === "overdue" || (!p.followup_completed_at && p.followup_due_at < nowIso))
      .map((p) => ({
        id: p.id,
        lead_id: p.lead_id,
        lead_name: leadName.get(p.lead_id) ?? "Untitled",
        status: p.status,
        expires_at: p.expires_at,
      }));

    const pipeline: Record<string, number> = {};
    for (const l of leads ?? []) pipeline[l.status] = (pipeline[l.status] ?? 0) + 1;

    const { elapsedDays, midWeek } = paceInfo(period);

    return {
      role: meta.role,
      isAdmin: meta.isAdmin,
      isManager: meta.isManager,
      period,
      elapsedDays,
      midWeek,
      me,
      tasks: dueTasks,
      openTaskCount: (tasks ?? []).length,
      placements: myPlacements,
      activePlacementCount: (placements ?? []).length,
      pipeline,
      rows,
      teamTotals: {
        reps: rows.length,
        touches: rows.reduce((s, r) => s + r.touches, 0),
        sales: rows.reduce((s, r) => s + r.sales, 0),
        revenue: rows.reduce((s, r) => s + r.revenue, 0),
        zeroToday: rows.filter((r) => r.activity_today === 0).length,
      },
    };
  });
