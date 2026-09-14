import { createFileRoute, Outlet, Link, redirect, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CrmShell } from "@/components/crm/shell";
import { useCrmNavGroups } from "@/lib/nav-groups";
import { btn } from "@/components/crm/kit";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context, location }) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.user.id);
    const roles = (data ?? []).map((r) => r.role as string);
    const isAdmin = roles.includes("admin");
    const isManager = roles.includes("manager");
    const isStaff = ["admin", "manager", "rep"].some((r) => roles.includes(r));

    // Knowledge base is open to every CRM seat.
    if (location.pathname.startsWith("/admin/knowledge")) {
      return { hasAdminAccess: isAdmin && !error, isAdmin, isManager, hasCrmAccess: isStaff };
    }

    // Managers run their own roster and inventory; everything else is super-admin only.
    const managerAllowed =
      location.pathname.startsWith("/admin/users") ||
      location.pathname.startsWith("/admin/devices");

    if (error || (!isAdmin && !(isManager && managerAllowed))) {
      throw redirect({ to: "/crm" });
    }
    return { hasAdminAccess: true, isAdmin, isManager, hasCrmAccess: isStaff };
  },

  component: AdminLayout,
});

function AdminLayout() {
  const { user, signOut } = useAuth();
  const { hasAdminAccess, isAdmin, isManager } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onKnowledge = pathname.startsWith("/admin/knowledge");

  // Reps and managers get the knowledge base with minimal chrome, no admin nav.
  if (!hasAdminAccess && onKnowledge) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-30 flex min-h-[60px] items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
          <Link to="/crm" className={btn.secondary}>
            <ArrowLeft className="h-4 w-4" /> Back to CRM
          </Link>
          <h1 className="truncate text-[19px] font-bold tracking-[-0.01em]">Knowledge</h1>
        </div>
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
          <Outlet />
        </div>
      </div>
    );
  }

  if (!hasAdminAccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <h1 className="text-lg font-semibold">No access</h1>
        <p className="max-w-sm text-[13px] text-muted-foreground">
          This console is for NectarPay sales staff. Your account ({user?.email}) doesn&apos;t have
          admin access yet — ask an admin to enable it.
        </p>
        <button
          type="button"
          className={btn.secondary}
          onClick={async () => {
            await signOut();
            window.location.href = "/auth";
          }}
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    );
  }

  const groups = useCrmNavGroups({ isAdmin, isManager, canSeeTeam: true });

  return (
    <CrmShell groups={groups} homeTo="/admin" kicker="Admin" role={isAdmin ? "Super admin" : "Manager"}>
      <Outlet />
    </CrmShell>
  );
}
