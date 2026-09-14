import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { addDays, weekRangeUtc } from "@/lib/weeks";

type Rule = {
  id: string;
  role_in_deal: "rep" | "manager_override" | "gm_override";
  rate_type: "flat" | "percent";
  rate_value: number;
  applies_to: "hardware" | "subscription" | "total";
  effective_from: string;
  effective_to: string | null;
};

type Deal = {
  id: string;
  rep_id: string;
  hardware_amount: number | null;
  subscription_monthly: number | null;
  subscription_months: number | null;
  total_amount: number | null;
  closed_at: string | null;
};

function baseFor(deal: Deal, appliesTo: Rule["applies_to"]) {
  const hardware = Number(deal.hardware_amount ?? 0);
  const subscription = Number(deal.subscription_monthly ?? 0) * Number(deal.subscription_months ?? 0);
  if (appliesTo === "hardware") return hardware;
  if (appliesTo === "subscription") return subscription;
  return Number(deal.total_amount ?? hardware + subscription);
}

function amountFor(deal: Deal, rule: Rule) {
  const base = baseFor(deal, rule.applies_to);
  const value = Number(rule.rate_value ?? 0);
  return rule.rate_type === "flat" ? value : Math.round(base * value) / 100;
}

/**
 * Recomputes commission lines for every won deal closed inside the given
 * Sunday→Saturday week (America/New_York). Demo sales are excluded — they
 * earn no commission. Existing lines are refreshed unless they've already
 * been paid or clawed back.
 */
export async function calculateCommissionsForWeek(weekStart: string) {
  const { from, to } = weekRangeUtc(weekStart);
  const weekEnd = addDays(weekStart, 6);

  const [{ data: deals }, { data: rules }, { data: teams }, { data: members }, { data: existing }] =
    await Promise.all([
      supabaseAdmin
        .from("deals")
        .select("id, rep_id, hardware_amount, subscription_monthly, subscription_months, total_amount, closed_at")
        .eq("status", "won")
        .eq("is_demo", false)
        .gte("closed_at", from)
        .lt("closed_at", to)
        .limit(5000),
      supabaseAdmin.from("commission_rules").select("*").order("effective_from", { ascending: false }),
      supabaseAdmin.from("teams").select("id, manager_id").eq("is_active", true),
      supabaseAdmin.from("team_members").select("team_id, user_id").is("left_at", null),
      supabaseAdmin
        .from("commissions")
        .select("id, deal_id, user_id, role_in_deal, status")
        .eq("week_start", weekStart),
    ]);

  const managerFor = new Map<string, string>();
  const managerOfTeam = new Map((teams ?? []).map((t) => [t.id, t.manager_id]));
  for (const m of members ?? []) {
    const mgr = managerOfTeam.get(m.team_id);
    if (mgr && mgr !== m.user_id) managerFor.set(m.user_id, mgr);
  }

  const activeRule = (role: Rule["role_in_deal"]) =>
    (rules as Rule[] | null)?.find(
      (r) =>
        r.role_in_deal === role &&
        r.effective_from <= weekEnd &&
        (!r.effective_to || r.effective_to >= weekStart),
    ) ?? null;

  const repRule = activeRule("rep");
  const mgrRule = activeRule("manager_override");

  const locked = new Set(
    (existing ?? [])
      .filter((c) => c.status === "paid" || c.status === "clawed_back")
      .map((c) => `${c.deal_id}:${c.user_id}:${c.role_in_deal}`),
  );

  const lines: Record<string, unknown>[] = [];
  for (const deal of (deals ?? []) as Deal[]) {
    if (repRule && !locked.has(`${deal.id}:${deal.rep_id}:rep`)) {
      lines.push({
        deal_id: deal.id,
        user_id: deal.rep_id,
        role_in_deal: "rep",
        rule_id: repRule.id,
        amount: amountFor(deal, repRule),
        week_start: weekStart,
      });
    }
    const manager = managerFor.get(deal.rep_id);
    if (mgrRule && manager && !locked.has(`${deal.id}:${manager}:manager_override`)) {
      lines.push({
        deal_id: deal.id,
        user_id: manager,
        role_in_deal: "manager_override",
        rule_id: mgrRule.id,
        amount: amountFor(deal, mgrRule),
        week_start: weekStart,
      });
    }
  }

  if (lines.length) {
    const { error } = await supabaseAdmin
      .from("commissions")
      .upsert(lines as never, { onConflict: "deal_id,user_id,role_in_deal" });
    if (error) throw new Error(error.message);
  }

  return { deals: deals?.length ?? 0, lines: lines.length };
}
