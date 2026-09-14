import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  KeyRound,
  Plus,
  Search,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users2,
} from "lucide-react";
import {
  APP_ROLES,
  changeUserEmail,
  inviteUser,
  listUserAdmin,
  resetUserPassword,
  saveTeam,
  setUserActive,
  setUserRoles,
  setUserTeam,
  updateUserProfile,
} from "@/lib/user-admin.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AddressAutocomplete } from "@/components/crm/address-autocomplete";
import { fieldCls } from "@/components/crm/kit";
import { PageSkeleton } from "@/components/crm/loading-state";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersTeamsPage,
  // Warm the cache while the route chunk loads instead of after it mounts.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery({ queryKey: ["admin-users"], queryFn: () => listUserAdmin() });
  },
  head: () => ({
    meta: [
      { title: "Users & Teams · Nectar.Pay CRM" },
      {
        name: "description",
        content:
          "Manage who can access the sales console: assign admin, manager and rep roles, set team membership and deactivate accounts.",
      },
    ],
  }),
});

const ROLE_HINT: Record<string, string> = {
  admin: "Everything: every team, device, market, commission rule and user.",
  manager: "Their teams' reps — leads, deals, contingents, inventory, commissions.",
  rep: "Only their own book of business.",
};

type SortKey = "name" | "roles" | "team" | "status" | "created";

function initials(name: string, email: string) {
  const base = (name || email || "?").trim();
  const parts = base.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase();
}

function UsersTeamsPage() {
  const load = useServerFn(listUserAdmin);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => load(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-users"] });
  const onError = (e: unknown) => toast.error((e as Error).message);

  const rolesFn = useServerFn(setUserRoles);
  const activeFn = useServerFn(setUserActive);
  const teamFn = useServerFn(setUserTeam);
  const profileFn = useServerFn(updateUserProfile);
  const emailFn = useServerFn(changeUserEmail);
  const teamSaveFn = useServerFn(saveTeam);
  const inviteFn = useServerFn(inviteUser);
  const resetPwFn = useServerFn(resetUserPassword);
  const [credential, setCredential] = useState<{
    email: string;
    password: string;
    emailed: boolean;
  } | null>(null);

  const mInvite = useMutation({
    mutationFn: (v: {
      email: string;
      full_name: string;
      role: string;
      team_id: string | null;
      home_address?: string;
    }) =>
      inviteFn({
        data: {
          ...v,
          redirect_to:
            typeof window === "undefined" ? undefined : `${window.location.origin}/crm`,
        } as never,
      }),
    onSuccess: (r: {
      email: string;
      temp_password: string;
      emailed?: boolean;
      email_error?: string | null;
    }) => {
      setInviteOpen(false);
      setCredential({ email: r.email, password: r.temp_password, emailed: !!r.emailed });
      if (!r.emailed && r.email_error) toast.error(`Email not sent: ${r.email_error}`);
      invalidate();
    },
    onError,
  });

  const mResetPw = useMutation({
    mutationFn: (v: { user_id: string }) => resetPwFn({ data: v }),
    onSuccess: (r: {
      email: string;
      temp_password: string;
      emailed?: boolean;
      email_error?: string | null;
    }) => {
      setCredential({ email: r.email, password: r.temp_password, emailed: !!r.emailed });
      if (!r.emailed && r.email_error) toast.error(`Email not sent: ${r.email_error}`);
    },
    onError,
  });



  const mRoles = useMutation({
    mutationFn: (v: { user_id: string; roles: string[] }) => rolesFn({ data: v as never }),
    onSuccess: () => {
      toast.success("Roles updated");
      invalidate();
    },
    onError,
  });
  const mActive = useMutation({
    mutationFn: (v: { user_id: string; is_active: boolean }) => activeFn({ data: v }),
    onSuccess: invalidate,
    onError,
  });
  const mTeam = useMutation({
    mutationFn: (v: { user_id: string; team_id: string | null; role?: "manager" | "rep" }) =>
      teamFn({ data: { role: "rep", ...v } }),
    onSuccess: () => {
      toast.success("Team updated");
      invalidate();
    },
    onError,
  });
  const mProfile = useMutation({
    mutationFn: (v: {
      user_id: string;
      full_name?: string;
      phone_e164?: string;
      home_address?: string;
    }) => profileFn({ data: v }),
    onSuccess: (r: { homeBaseFailed?: boolean }) => {
      if (r?.homeBaseFailed) toast.error("Couldn't locate that home address — other changes saved.");
      else toast.success("Saved");
      invalidate();
    },
    onError,
  });
  const mEmail = useMutation({
    mutationFn: (v: { user_id: string; email: string; send_confirmation: boolean }) =>
      emailFn({ data: v }),
    onSuccess: (r: { pending: boolean }) => {
      toast.success(r.pending ? "Confirmation link sent" : "Email updated");
      invalidate();
    },
    onError,
  });
  const mTeamSave = useMutation({
    mutationFn: (v: { id?: string; name: string; manager_id: string | null; region?: string }) =>
      teamSaveFn({ data: { ...v, is_active: true } }),
    onSuccess: () => {
      toast.success("Team saved");
      invalidate();
    },
    onError,
  });

  const [newTeam, setNewTeam] = useState("");
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "name",
    dir: "asc",
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);


  const teamName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of data?.teams ?? []) m[t.id] = t.name;
    return m;
  }, [data?.teams]);

  const users = useMemo(() => {
    const list = data?.users ?? [];
    const term = q.trim().toLowerCase();
    const filtered = list.filter((u) => {
      if (roleFilter !== "all" && !u.roles.includes(roleFilter)) return false;
      if (teamFilter === "none" ? u.team_id : teamFilter !== "all" && u.team_id !== teamFilter)
        return false;
      if (statusFilter === "active" && !u.is_active) return false;
      if (statusFilter === "inactive" && u.is_active) return false;
      if (!term) return true;
      return `${u.full_name ?? ""} ${u.email ?? ""} ${u.phone_e164 ?? ""}`
        .toLowerCase()
        .includes(term);
    });

    const val = (u: (typeof list)[number]) => {
      switch (sort.key) {
        case "roles":
          return u.roles.slice().sort().join(",");
        case "team":
          return u.team_id ? (teamName[u.team_id] ?? "") : "";
        case "status":
          return u.is_active ? "1" : "0";
        case "created":
          return u.created_at ?? "";
        default:
          return (u.full_name || u.email || "").toLowerCase();
      }
    };
    return filtered.sort((a, b) => {
      const r = val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0;
      return sort.dir === "asc" ? r : -r;
    });
  }, [data?.users, q, roleFilter, teamFilter, statusFilter, sort, teamName]);

  // Keep the DOM small: render one page of rows at a time.
  const pageCount = Math.max(1, Math.ceil(users.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageUsers = useMemo(
    () => users.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [users, safePage, pageSize],
  );
  useEffect(() => {
    setPage(0);
  }, [q, roleFilter, teamFilter, statusFilter, pageSize]);



  if (isLoading) return <PageSkeleton />;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const counts = APP_ROLES.reduce<Record<string, number>>((acc, r) => {
    acc[r] = data.users.filter((u) => u.roles.includes(r)).length;
    return acc;
  }, {});
  const managers = data.users.filter(
    (u) => u.roles.includes("manager") || u.roles.includes("admin"),
  );

  const toggleSort = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));

  const SortHead = ({ label, k, className }: { label: string; k: SortKey; className?: string }) => (
    <th className={`px-3 py-2 ${className ?? ""}`}>
      <button
        onClick={() => toggleSort(k)}
        className="flex items-center gap-1 uppercase tracking-[0.2em] hover:text-foreground"
      >
        {label}
        {sort.key !== k ? (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        ) : sort.dir === "asc" ? (
          <ArrowUp className="h-3 w-3 text-primary" />
        ) : (
          <ArrowDown className="h-3 w-3 text-primary" />
        )}
      </button>
    </th>
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold uppercase tracking-tight">Users &amp; Teams</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who can sign in, what they can see, and which team they roll up to. Role changes take
          effect on the user&apos;s next page load. Public sign-up is off — people can only get in
          by invite.
        </p>
      </header>

      {credential && (
        <CredentialDialog
          email={credential.email}
          password={credential.password}
          emailed={credential.emailed}
          onClose={() => setCredential(null)}
        />

      )}

      {inviteOpen && (
        <InviteDialog
          teams={data.teams}
          isAdmin={data.isAdmin}

          pending={mInvite.isPending}
          onClose={() => setInviteOpen(false)}
          onSubmit={(v) => mInvite.mutate(v)}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {APP_ROLES.map((r) => (
          <div key={r} className="rounded-xl border border-border bg-card/50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{r}</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                {counts[r] ?? 0}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{ROLE_HINT[r]}</p>
          </div>
        ))}
      </div>

      {/* Users */}
      <section className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> Users ({users.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-1 h-4 w-4" /> Invite user
            </Button>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, email, phone"
                className="pl-8 sm:w-56"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-2 text-sm"
            >
              <option value="all">All roles</option>
              {APP_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-2 text-sm"
            >
              <option value="all">All teams</option>
              <option value="none">No team</option>
              {data.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
              className="rounded-md border border-border bg-background px-2 py-2 text-sm"
            >
              <option value="all">Any status</option>
              <option value="active">Active</option>
              <option value="inactive">Deactivated</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <SortHead label="User" k="name" />
                <SortHead label="Roles" k="roles" />
                <SortHead label="Team" k="team" />
                <SortHead label="Active" k="status" />
                <SortHead label="Added" k="created" />
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    No users match those filters.
                  </td>
                </tr>
              )}
              {pageUsers.map((u) => {
                const isSelf = u.user_id === data.currentUserId;
                const isEditing = editing === u.user_id;
                return (
                  <tr
                    key={u.user_id}
                    className={`border-t border-border/50 align-middle ${
                      u.is_active ? "" : "opacity-60"
                    }`}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-[0.65rem] font-bold text-primary">
                          {initials(u.full_name ?? "", u.email ?? "")}
                        </div>
                        {isEditing ? (
                          <IdentityEditor
                            name={u.full_name ?? ""}
                            phone={u.phone_e164 ?? ""}
                            homeAddress={
                              (u as { home_address?: string | null }).home_address ?? ""
                            }
                            email={u.email ?? ""}
                            canEditEmail={data.isAdmin}
                            onCancel={() => setEditing(null)}
                            onSaveEmail={(email, send_confirmation) =>
                              mEmail.mutate({ user_id: u.user_id, email, send_confirmation })
                            }
                            onSave={(full_name, phone_e164, home_address) => {
                              mProfile.mutate({
                                user_id: u.user_id,
                                full_name,
                                phone_e164,
                                home_address,
                              });
                              setEditing(null);
                            }}
                          />
                        ) : (
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setEditing(u.user_id)}
                                className="truncate text-left font-medium hover:underline"
                              >
                                {u.full_name || u.email || "—"}
                              </button>
                              {isSelf && (
                                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-primary">
                                  you
                                </span>
                              )}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                            {u.phone_e164 && (
                              <p className="text-xs text-muted-foreground">{u.phone_e164}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {APP_ROLES.map((role) => {
                          const on = u.roles.includes(role);
                          const locked = (isSelf && role === "admin") || !data.isAdmin;
                          return (
                            <button
                              key={role}
                              disabled={locked || mRoles.isPending}
                              title={
                                !data.isAdmin
                                  ? "Only a super admin can change roles"
                                  : locked
                                    ? "You can't remove your own admin role"
                                    : ROLE_HINT[role]
                              }

                              onClick={() =>
                                mRoles.mutate({
                                  user_id: u.user_id,
                                  roles: on
                                    ? u.roles.filter((r) => r !== role)
                                    : [...u.roles, role],
                                })
                              }
                              className={`rounded-full border px-2 py-0.5 text-[0.65rem] uppercase tracking-wider transition-colors disabled:opacity-50 ${
                                on
                                  ? "border-primary bg-primary/15 text-primary"
                                  : "border-border text-muted-foreground hover:bg-sidebar-accent"
                              }`}
                            >
                              {role}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        disabled={!data.isAdmin}

                        value={u.team_id ?? ""}
                        onChange={(e) =>
                          mTeam.mutate({
                            user_id: u.user_id,
                            team_id: e.target.value || null,
                          })
                        }
                        className="w-full min-w-[9rem] rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                      >
                        <option value="">No team</option>
                        {data.teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <Switch
                        checked={u.is_active}
                        disabled={isSelf}
                        onCheckedChange={(v) => mActive.mutate({ user_id: u.user_id, is_active: v })}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={mResetPw.isPending}
                          title="Issue a new temporary password"
                          onClick={() => mResetPw.mutate({ user_id: u.user_id })}
                        >
                          <KeyRound className="mr-1 h-3.5 w-3.5" /> Temp password
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {users.length === 0
              ? "No users"
              : `Showing ${safePage * pageSize + 1}–${Math.min((safePage + 1) * pageSize, users.length)} of ${users.length}`}
          </span>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-md border border-border bg-background px-2 py-1"
            >
              {[25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Prev
            </Button>
            <span className="tabular-nums">
              {safePage + 1} / {pageCount}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Team membership follows the app role — anyone with the Manager role runs the team they
          are assigned to and sees every member of it.
        </p>
      </section>

      {/* Teams */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          <Users2 className="h-4 w-4" /> Teams ({data.teams.length})
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.teams.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
              No teams yet — create one below.
            </p>
          )}
          {data.teams.map((t) => {
            const members = data.users.filter((u) => u.team_id === t.id);
            const teamManagers = members.filter((m) => m.roles.includes("manager"));
            return (
              <div key={t.id} className="rounded-xl border border-border bg-card/50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{t.name}</p>
                    {t.region && <p className="text-xs text-muted-foreground">{t.region}</p>}
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    <UserRound className="h-3 w-3" />
                    {members.length}
                  </span>
                </div>
                <p className="mb-1.5 mt-4 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                  Primary manager
                </p>
                <select
                  disabled={!data.isAdmin}
                  value={t.manager_id ?? ""}

                  onChange={(e) =>
                    mTeamSave.mutate({
                      id: t.id,
                      name: t.name,
                      manager_id: e.target.value || null,
                      region: t.region ?? "",
                    })
                  }
                  className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                >
                  <option value="">Unassigned</option>
                  {managers.map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.full_name ?? u.email}
                    </option>
                  ))}
                </select>
                {teamManagers.length > 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    <span className="uppercase tracking-wider">Managers:</span>{" "}
                    {teamManagers.map((m) => m.full_name ?? m.email).join(", ")}
                  </p>
                )}
                {members.length > 0 && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {members.map((m) => m.full_name ?? m.email).join(", ")}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {data.isAdmin && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={newTeam}
              onChange={(e) => setNewTeam(e.target.value)}
              placeholder="New team name"
              className="w-full sm:max-w-xs"
            />
            <Button
              size="sm"
              disabled={!newTeam.trim() || mTeamSave.isPending}
              onClick={() =>
                mTeamSave.mutate(
                  { name: newTeam.trim(), manager_id: null },
                  { onSuccess: () => setNewTeam("") },
                )
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Add team
            </Button>
          </div>
        )}
      </section>

    </div>
  );
}

function InviteDialog({
  teams,
  pending,
  isAdmin,
  onClose,
  onSubmit,
}: {
  teams: { id: string; name: string }[];
  pending: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onSubmit: (v: {
    email: string;
    full_name: string;
    role: string;
    team_id: string | null;
    home_address?: string;
  }) => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
  const [role, setRole] = useState<string>("rep");
  const [teamId, setTeamId] = useState<string>(isAdmin ? "" : (teams[0]?.id ?? ""));
  const roleOptions = isAdmin ? APP_ROLES : (["rep"] as const);


  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">Invite a user</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          We&apos;ll create the account with a temporary password you hand over. They pick
          their own password on first sign-in.
        </p>

        <div className="mt-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rep@nectar-pay.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Full name
            </label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Rep"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Home base <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <AddressAutocomplete
              className={fieldCls}
              value={homeAddress}
              onChange={setHomeAddress}
              onSelect={(a) => setHomeAddress(a.formattedAddress)}
              placeholder="123 Main St, Dallas, TX"
            />
            <p className="text-[11px] text-muted-foreground">
              Their default map center. Can be added later in settings.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
              >
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Team
              </label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
              >
                {isAdmin && <option value="">No team</option>}
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || pending}
            onClick={() =>
              onSubmit({
                email: email.trim().toLowerCase(),
                full_name: fullName.trim(),
                role,
                team_id: teamId || null,
                home_address: homeAddress.trim() || undefined,
              })
            }
          >
            {pending ? "Creating…" : "Create account"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CredentialDialog({
  email,
  password,
  emailed,
  onClose,
}: {
  email: string;
  password: string;
  emailed?: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = `Email: ${email}\nTemporary password: ${password}`;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">Temporary password</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {emailed
            ? "We emailed these credentials to the user. Keep a copy below just in case — it's shown only once."
            : "We couldn't email this automatically — send it to the user yourself. It's shown only once."}{" "}
          They&apos;ll be asked to choose their own password right after signing in.
        </p>

        <div className="mt-4 space-y-2 rounded-lg border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Email</p>
          <p className="font-mono text-sm">{email}</p>
          <p className="pt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Temporary password
          </p>
          <p className="font-mono text-lg font-semibold">{password}</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(text).then(() => {
                setCopied(true);
                toast.success("Copied");
              });
            }}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}

function IdentityEditor({
  name,
  phone,
  email,
  homeAddress,
  canEditEmail,
  onSave,
  onSaveEmail,
  onCancel,
}: {
  name: string;
  phone: string;
  email: string;
  homeAddress: string;
  canEditEmail: boolean;
  onSave: (name: string, phone: string, homeAddress: string) => void;
  onSaveEmail: (email: string, sendConfirmation: boolean) => void;
  onCancel: () => void;
}) {
  const [n, setN] = useState(name);
  const [p, setP] = useState(phone);
  const [home, setHome] = useState(homeAddress);
  const [e, setE] = useState(email);
  const [confirmFirst, setConfirmFirst] = useState(false);
  const emailChanged = e.trim().toLowerCase() !== email.trim().toLowerCase() && e.trim() !== "";
  return (
    <div className="flex w-full max-w-xs flex-col gap-1.5">
      <Input value={n} onChange={(ev) => setN(ev.target.value)} placeholder="Full name" />
      <Input value={p} onChange={(ev) => setP(ev.target.value)} placeholder="Phone" />
      <AddressAutocomplete
        className={fieldCls}
        value={home}
        onChange={setHome}
        onSelect={(a) => setHome(a.formattedAddress)}
        placeholder="Home base address (optional)"
      />
      {canEditEmail && (
        <>
          <Input
            type="email"
            value={e}
            onChange={(ev) => setE(ev.target.value)}
            placeholder="Login email"
          />
          {emailChanged && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={confirmFirst}
                onChange={(ev) => setConfirmFirst(ev.target.checked)}
              />
              Send a confirmation link instead of switching now
            </label>
          )}
        </>
      )}
      <div className="flex gap-1">
        <Button
          size="sm"
          onClick={() => {
            if (canEditEmail && emailChanged) onSaveEmail(e.trim(), confirmFirst);
            onSave(n, p, home.trim());
          }}
        >
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
