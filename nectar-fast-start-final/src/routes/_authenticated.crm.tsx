import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CrmShell } from "@/components/crm/shell";
import { useCrmNavGroups } from "@/lib/nav-groups";

export const Route = createFileRoute("/_authenticated/crm")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.user.id);
    const roles = (data ?? []).map((r) => r.role as string);
    const isAdmin = roles.includes("admin");
    const isManager = roles.includes("manager");
    const isRep = roles.includes("rep");
    if (!isAdmin && !isManager && !isRep) {
      throw redirect({ to: "/auth", search: { redirect: "/crm" } });
    }
    return { roles, isAdmin, isManager, canSeeTeam: isAdmin || isManager };
  },
  component: CrmLayout,
});

function CrmLayout() {
  const { isAdmin, isManager, canSeeTeam } = Route.useRouteContext();
  const roleLabel = isAdmin ? "Super admin" : canSeeTeam ? "Manager" : "Rep";
  const groups = useCrmNavGroups({ isAdmin, isManager, canSeeTeam });

  return (
    <CrmShell groups={groups} role={roleLabel}>
      <Outlet />
    </CrmShell>
  );
}
