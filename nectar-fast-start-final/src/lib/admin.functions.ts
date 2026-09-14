import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Throws 403 if caller is not an admin. */
async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [users, leads, deals, placements, recent] = await Promise.all([
      supabaseAdmin.from("profiles").select("user_id", { count: "exact", head: true }),
      supabaseAdmin.from("leads").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("deals").select("id", { count: "exact", head: true }).eq("status", "won"),
      supabaseAdmin
        .from("contingent_placements")
        .select("id", { count: "exact", head: true })
        .in("status", ["active", "extended", "overdue"]),
      supabaseAdmin
        .from("activities")
        .select("id, type, outcome, notes, occurred_at, lead_id, leads(business_name)")
        .order("occurred_at", { ascending: false })
        .limit(10),
    ]);

    return {
      user_count: users.count ?? 0,
      lead_count: leads.count ?? 0,
      won_deal_count: deals.count ?? 0,
      active_placement_count: placements.count ?? 0,
      recent_activities: (recent.data ?? []).map((a: any) => ({
        id: a.id,
        type: a.type,
        outcome: a.outcome,
        notes: a.notes,
        occurred_at: a.occurred_at,
        lead_id: a.lead_id,
        business_name: a.leads?.business_name ?? null,
      })),
    };
  });

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email, full_name, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const ids = (profiles ?? []).map((p) => p.user_id);
    const roles = await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids);

    const roleMap = new Map<string, string[]>();
    for (const r of roles.data ?? []) {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    }

    return (profiles ?? []).map((p) => ({
      user_id: p.user_id,
      display_name: p.full_name ?? "—",
      email: p.email,
      created_at: p.created_at,
      roles: roleMap.get(p.user_id) ?? [],
    }));
  });
