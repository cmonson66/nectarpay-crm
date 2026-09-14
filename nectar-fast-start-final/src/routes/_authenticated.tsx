import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({
        to: "/auth",
        search: { redirect: location.href },
      });
    }
    if (data.user.user_metadata?.must_change_password) {
      throw redirect({ to: "/set-password" });
    }
    return { user: data.user };
  },

  component: AuthenticatedLayout,
});

// Sales-rep CRM only: the admin subtree owns its own chrome, so this layout
// is just the auth gate.
function AuthenticatedLayout() {
  return <Outlet />;
}
