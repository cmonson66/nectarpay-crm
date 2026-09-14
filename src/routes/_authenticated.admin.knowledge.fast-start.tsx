import { createFileRoute } from "@tanstack/react-router";
import { FastStartDrills } from "@/components/fast-start/fast-start-drills";

export const Route = createFileRoute("/_authenticated/admin/knowledge/fast-start")({
  component: FastStartDrills,
  head: () => ({
    meta: [
      { title: "Fast Start | NectarPay CRM" },
      { name: "description", content: "20 merchant onboarding drills for new reps" }
    ]
  })
});
