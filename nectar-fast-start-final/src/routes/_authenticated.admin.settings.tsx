import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy path — Settings became "Users & Teams". */
export const Route = createFileRoute("/_authenticated/admin/settings")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/users", replace: true });
  },
  component: () => null,
});
