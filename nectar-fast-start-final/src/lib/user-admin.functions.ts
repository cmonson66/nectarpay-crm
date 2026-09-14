import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { geocodeAddress } from "@/lib/geo.server";

export const APP_ROLES = ["admin", "manager", "rep"] as const;
export type AppRole = (typeof APP_ROLES)[number];

/** Admin is the super-admin tier: full control of roles, teams, markets,
 *  commission rules and campaigns. */
async function admin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Response("Forbidden", { status: 403 });
  return supabaseAdmin;
}

/** Admins get the whole org; managers get only the teams they run. */
async function staff(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const list = (roles ?? []).map((r) => r.role as string);
  const isAdmin = list.includes("admin");
  const isManager = list.includes("manager");
  if (!isAdmin && !isManager) throw new Response("Forbidden", { status: 403 });

  let teamIds: string[] = [];
  if (!isAdmin) {
    const [{ data: owned }, { data: memberOf }] = await Promise.all([
      supabaseAdmin.from("teams").select("id").eq("manager_id", userId),
      supabaseAdmin
        .from("team_members")
        .select("team_id")
        .eq("user_id", userId)
        .eq("role", "manager")
        .is("left_at", null),
    ]);
    teamIds = Array.from(
      new Set([
        ...(owned ?? []).map((t) => t.id as string),
        ...(memberOf ?? []).map((m) => m.team_id as string),
      ]),
    );
  }
  return { db: supabaseAdmin, isAdmin, isManager, teamIds };
}

/** Full user directory. Admins see everyone; managers see only their teams. */
export const listUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, isAdmin, teamIds } = await staff(context.userId);

    const [profilesRes, rolesRes, teamsRes, membersRes] = await Promise.all([
      db
        .from("profiles")
        .select("user_id, email, full_name, phone_e164, is_active, hire_date, created_at, home_address")
        .order("created_at", { ascending: false })
        .limit(500),
      db.from("user_roles").select("user_id, role"),
      db.from("teams").select("id, name, manager_id, region, is_active").order("name"),
      db.from("team_members").select("team_id, user_id, role, left_at").is("left_at", null),
    ]);
    if (profilesRes.error) throw new Error(profilesRes.error.message);

    const roleMap = new Map<string, string[]>();
    for (const r of rolesRes.data ?? []) {
      roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role as string]);
    }
    const teamMap = new Map<string, { team_id: string; role: string }>();
    for (const m of membersRes.data ?? []) {
      teamMap.set(m.user_id, { team_id: m.team_id, role: (m as { role?: string }).role ?? "rep" });
    }

    const teams = (teamsRes.data ?? []).filter((t) => isAdmin || teamIds.includes(t.id as string));
    const users = (profilesRes.data ?? [])
      .map((p) => ({
        user_id: p.user_id,
        email: p.email,
        full_name: p.full_name,
        phone_e164: p.phone_e164,
        is_active: p.is_active,
        hire_date: p.hire_date,
        created_at: p.created_at,
        home_address: (p as { home_address?: string | null }).home_address ?? null,
        roles: roleMap.get(p.user_id) ?? [],
        team_id: teamMap.get(p.user_id)?.team_id ?? null,
      }))
      .filter(
        (u) =>
          isAdmin ||
          u.user_id === context.userId ||
          (u.team_id !== null && teamIds.includes(u.team_id)),
      );

    return { currentUserId: context.userId, isAdmin, teams, users };
  });



/** Replaces a user's role set. Admins cannot strip their own admin role. */
export const setUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ user_id: z.string().uuid(), roles: z.array(z.enum(APP_ROLES)) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin(context.userId);
    const roles = Array.from(new Set(data.roles));
    if (data.user_id === context.userId && !roles.includes("admin")) {
      throw new Error("You can't remove your own admin role.");
    }

    const { error: delErr } = await db.from("user_roles").delete().eq("user_id", data.user_id);
    if (delErr) throw new Error(delErr.message);
    if (roles.length) {
      const { error } = await db
        .from("user_roles")
        .insert(roles.map((role) => ({ user_id: data.user_id, role })));
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Deactivating keeps history but takes the rep out of active rotations. */
export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid(), is_active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, isAdmin, teamIds } = await staff(context.userId);
    if (!isAdmin) {
      const { data: member } = await db
        .from("team_members")
        .select("team_id")
        .eq("user_id", data.user_id)
        .is("left_at", null)
        .maybeSingle();
      if (!member || !teamIds.includes(member.team_id as string)) {
        throw new Error("That person isn't on your team.");
      }
    }

    if (data.user_id === context.userId && !data.is_active) {
      throw new Error("You can't deactivate your own account.");
    }
    const { error } = await db
      .from("profiles")
      .update({ is_active: data.is_active, updated_at: new Date().toISOString() })
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        user_id: z.string().uuid(),
        full_name: z.string().trim().max(200).optional(),
        phone_e164: z.string().trim().max(30).optional().or(z.literal("")),
        hire_date: z.string().optional().or(z.literal("")),
        home_address: z.string().trim().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin(context.userId);
    const { user_id, home_address, ...rest } = data;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) patch[k] = v === "" ? null : v;

    // Home base is optional; an empty string clears it, anything else is geocoded.
    let homeBaseFailed = false;
    if (home_address !== undefined) {
      if (home_address === "") {
        patch["home_address"] = null;
        patch["home_lat"] = null;
        patch["home_lng"] = null;
      } else {
        const hit = await geocodeAddress(home_address).catch(() => null);
        if (hit) {
          patch["home_address"] = hit.formattedAddress;
          patch["home_lat"] = hit.lat;
          patch["home_lng"] = hit.lng;
        } else {
          homeBaseFailed = true;
        }
      }
    }

    const { error } = await db.from("profiles").update(patch as never).eq("user_id", user_id);
    if (error) throw new Error(error.message);
    return { ok: true, homeBaseFailed };
  });

/** Super-admin only: change a user's login email.
 *  `send_confirmation` emails the new address a confirm link (email switches
 *  only after they click); otherwise the change is applied immediately. */
export const changeUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        user_id: z.string().uuid(),
        email: z.string().trim().toLowerCase().email(),
        send_confirmation: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin(context.userId);

    const { data: clash } = await db
      .from("profiles")
      .select("user_id")
      .eq("email", data.email)
      .maybeSingle();
    if (clash && clash.user_id !== data.user_id) {
      throw new Error("Another account already uses that email.");
    }

    const { error: authErr } = await db.auth.admin.updateUserById(data.user_id, {
      email: data.email,
      ...(data.send_confirmation ? {} : { email_confirm: true }),
    });
    if (authErr) throw new Error(authErr.message);

    if (!data.send_confirmation) {
      const { error } = await db
        .from("profiles")
        .update({ email: data.email, updated_at: new Date().toISOString() } as never)
        .eq("user_id", data.user_id);
      if (error) throw new Error(error.message);
    }
    return { ok: true, pending: data.send_confirmation };
  });

/** Moves a person between teams; passing null removes them from all teams.
 *  `role` decides whether they run the team (manager) or roll up into it (rep).
 *  A team can have any number of managers. */
export const setUserTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        user_id: z.string().uuid(),
        team_id: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin(context.userId);
    const now = new Date().toISOString();

    // Team role is derived from the app role — managers manage, everyone else is a member.
    const { data: roleRows } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id);
    const derivedRole = (roleRows ?? []).some((r) => r.role === "manager") ? "manager" : "rep";

    const { error: closeErr } = await db
      .from("team_members")
      .update({ left_at: now })
      .eq("user_id", data.user_id)
      .is("left_at", null);
    if (closeErr) throw new Error(closeErr.message);

    if (data.team_id) {
      const { error } = await db
        .from("team_members")
        .insert({ user_id: data.user_id, team_id: data.team_id, role: derivedRole } as never);
      if (error) throw new Error(error.message);
    }

    if (derivedRole === "manager") {

      // A manager runs exactly one team: own this one, drop any other.
      await db
        .from("teams")
        .update({ manager_id: null, updated_at: now })
        .eq("manager_id", data.user_id)
        .neq("id", data.team_id ?? "00000000-0000-0000-0000-000000000000");
      if (data.team_id) {
        await db
          .from("teams")
          .update({ manager_id: data.user_id, updated_at: now })
          .eq("id", data.team_id);
      }
    }
    return { ok: true };
  });


export const saveTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(120),
        manager_id: z.string().uuid().nullable().optional(),
        region: z.string().trim().max(120).optional().or(z.literal("")),
        is_active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin(context.userId);
    const now = new Date().toISOString();
    const row = {
      name: data.name,
      manager_id: data.manager_id ?? null,
      region: data.region || null,
      is_active: data.is_active,
      updated_at: now,
    };
    let teamId = data.id;
    if (teamId) {
      const { error } = await db.from("teams").update(row).eq("id", teamId);
      if (error) throw new Error(error.message);
    } else {
      const { data: created, error } = await db.from("teams").insert(row).select("id").single();
      if (error) throw new Error(error.message);
      teamId = created.id as string;
    }

    if (data.manager_id) {
      // The manager belongs to this team only: clear other teams they ran and
      // close any membership they still hold elsewhere.
      await db
        .from("teams")
        .update({ manager_id: null, updated_at: now })
        .eq("manager_id", data.manager_id)
        .neq("id", teamId);
      await db
        .from("team_members")
        .update({ left_at: now })
        .eq("user_id", data.manager_id)
        .is("left_at", null)
        .neq("team_id", teamId);
      const { data: existing } = await db
        .from("team_members")
        .select("id, role")
        .eq("user_id", data.manager_id)
        .eq("team_id", teamId)
        .is("left_at", null)
        .maybeSingle();
      if (!existing) {
        await db
          .from("team_members")
          .insert({ user_id: data.manager_id, team_id: teamId, role: "manager" } as never);
      } else if (existing.role !== "manager") {
        await db.from("team_members").update({ role: "manager" }).eq("id", existing.id);
      }
    }
    return { id: teamId };
  });


/** Generates a readable, high-entropy temporary password. */
function tempPassword(): string {
  const words = ["Nectar", "Honey", "Hive", "Comb", "Swarm", "Bloom", "Pollen", "Amber"];
  const bytes = new Uint32Array(3);
  crypto.getRandomValues(bytes);
  const word = words[bytes[0] % words.length];
  const num = 1000 + (bytes[1] % 9000);
  const sym = "!@#$%&*"[bytes[2] % 7];
  return `${word}-${num}${sym}`;
}

/** Admin-only invite: creates the auth user (with a temporary password the
 *  admin hands over), profile, role and team membership. The user is forced to
 *  choose a new password on first sign-in. Public sign-up is disabled. */
export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email(),
        full_name: z.string().trim().max(200).optional().or(z.literal("")),
        role: z.enum(APP_ROLES),
        team_id: z.string().uuid().nullable().optional(),
        home_address: z.string().trim().max(300).optional().or(z.literal("")),
        redirect_to: z.string().url().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, isAdmin, teamIds } = await staff(context.userId);
    // Managers can only add reps, and only to a team they run.
    if (!isAdmin) {
      if (data.role !== "rep") {
        throw new Error("Only a super admin can grant the manager or admin role.");
      }
      if (!data.team_id || !teamIds.includes(data.team_id)) {
        throw new Error("You can only invite people into your own team.");
      }
    }

    const { data: existing } = await db
      .from("profiles")
      .select("user_id")
      .eq("email", data.email)
      .maybeSingle();
    if (existing) throw new Error("That email already has an account.");

    const password = tempPassword();
    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email: data.email,
      password,
      email_confirm: true,
      user_metadata: {
        must_change_password: true,
        ...(data.full_name ? { full_name: data.full_name } : {}),
      },
    });
    if (createErr || !created?.user) {
      throw new Error(createErr?.message ?? "Could not create the account.");
    }
    const userId = created.user.id;

    const home = data.home_address ? await geocodeAddress(data.home_address).catch(() => null) : null;

    const { error: profErr } = await db.from("profiles").upsert(
      {
        user_id: userId,
        email: data.email,
        full_name: data.full_name || data.email.split("@")[0],
        ...(home
          ? { home_address: home.formattedAddress, home_lat: home.lat, home_lng: home.lng }
          : {}),
        is_active: true,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id" },
    );
    if (profErr) throw new Error(profErr.message);

    await db.from("user_roles").delete().eq("user_id", userId);
    const { error: roleErr } = await db
      .from("user_roles")
      .insert({ user_id: userId, role: data.role } as never);
    if (roleErr) throw new Error(roleErr.message);

    if (data.team_id) {
      const now = new Date().toISOString();
      const teamRole = data.role === "manager" ? "manager" : "rep";
      await db.from("team_members").update({ left_at: now })
        .eq("user_id", userId).is("left_at", null);
      const { error: tmErr } = await db
        .from("team_members")
        .insert({ user_id: userId, team_id: data.team_id, role: teamRole } as never);
      if (tmErr) throw new Error(tmErr.message);
      if (teamRole === "manager") {
        await db
          .from("teams")
          .update({ manager_id: null, updated_at: now })
          .eq("manager_id", userId)
          .neq("id", data.team_id);
        await db
          .from("teams")
          .update({ manager_id: userId, updated_at: now })
          .eq("id", data.team_id);
      }
    }

    return {
      user_id: userId,
      email: data.email,
      temp_password: password,
      emailed: false,
      email_error: null,
    };
  });

/** Admin/manager: issue a fresh temporary password for someone in scope. */
export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, isAdmin, teamIds } = await staff(context.userId);
    if (!isAdmin) {
      const { data: member } = await db
        .from("team_members")
        .select("team_id")
        .eq("user_id", data.user_id)
        .is("left_at", null)
        .maybeSingle();
      if (!member || !teamIds.includes(member.team_id as string)) {
        throw new Error("That person isn't on your team.");
      }
    }

    const password = tempPassword();
    const { data: updated, error } = await db.auth.admin.updateUserById(data.user_id, {
      password,
      user_metadata: { must_change_password: true },
    });
    if (error) throw new Error(error.message);
    const email = updated?.user?.email ?? "";
    return {
      email,
      temp_password: password,
      emailed: false,
      email_error: null,
    };
  });


