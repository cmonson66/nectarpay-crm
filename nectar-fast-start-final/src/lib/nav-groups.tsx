import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Gauge,
  UsersRound,
  Timer,
  CheckSquare,
  Megaphone,
  DollarSign,
  LineChart,
  BookOpen,
  Shield,
  Smartphone,
  Map as MapIcon,
  Settings as SettingsIcon,
} from "lucide-react";
import type { NavGroupDef } from "@/components/crm/shell";
import { listPipeline } from "@/lib/crm.functions";
import { listPlacements, listTasks } from "@/lib/deals.functions";

/** Live sidebar badges — every count is derived from the same arrays the pages render. */
export function useNavCounts() {
  const pipelineFn = useServerFn(listPipeline);
  const placementsFn = useServerFn(listPlacements);
  const tasksFn = useServerFn(listTasks);

  const pipeline = useQuery({
    queryKey: ["crm-pipeline"],
    queryFn: () => pipelineFn(),
  });
  const placements = useQuery({
    queryKey: ["crm-placements"],
    queryFn: () => placementsFn(),
  });
  const tasks = useQuery({ queryKey: ["crm-tasks"], queryFn: () => tasksFn() });

  const openProspects = (pipeline.data ?? []).filter(
    (l) => !["won", "lost", "do_not_contact"].includes(l.status as string),
  ).length;

  const now = Date.now();
  const expiredTrials = (placements.data?.placements ?? []).filter(
    (p) =>
      ["active", "extended", "overdue"].includes(p.status as string) &&
      new Date(p.expires_at).getTime() < now,
  ).length;

  const openTasks = (tasks.data?.tasks ?? []).filter((t) => !t.completed_at).length;

  return { openProspects, expiredTrials, openTasks };
}

export function useCrmNavGroups({
  isAdmin,
  isManager = false,
  canSeeTeam,
}: {
  isAdmin: boolean;
  isManager?: boolean;
  canSeeTeam: boolean;
}): NavGroupDef[] {
  const counts = useNavCounts();

  const sell: NavGroupDef["items"] = [
    { to: "/crm", label: "Today", exact: true, icon: <Gauge className="h-4 w-4" /> },
    {
      to: "/crm/leads",
      label: "Leads & Customers",
      icon: <UsersRound className="h-4 w-4" />,
      badge: counts.openProspects || undefined,
      badgeTone: "neutral",
    },
    {
      to: "/crm/contingents",
      label: "Contingents",
      icon: <Timer className="h-4 w-4" />,
      badge: counts.expiredTrials || undefined,
      badgeTone: "red",
    },
    {
      to: "/crm/tasks",
      label: "Follow-ups",
      icon: <CheckSquare className="h-4 w-4" />,
      badge: counts.openTasks || undefined,
      badgeTone: "honey",
    },
    { to: "/crm/map", label: "Map", icon: <MapIcon className="h-4 w-4" /> },
    { to: "/admin/knowledge", label: "Knowledge", icon: <BookOpen className="h-4 w-4" /> },
  ];

  const manage: NavGroupDef["items"] = [
    ...(canSeeTeam
      ? [{ to: "/crm/team", label: "Team", icon: <LineChart className="h-4 w-4" /> }]
      : []),
    { to: "/crm/settings", label: "My settings", icon: <SettingsIcon className="h-4 w-4" /> },
    {
      to: "/crm/commissions",
      label: canSeeTeam ? "Commissions" : "My earnings",
      icon: <DollarSign className="h-4 w-4" />,
    },
    ...(canSeeTeam || isAdmin
      ? [{ to: "/admin/devices", label: "Devices", icon: <Smartphone className="h-4 w-4" /> }]
      : []),
    ...(isAdmin
      ? [{ to: "/crm/campaigns", label: "Campaigns", icon: <Megaphone className="h-4 w-4" /> }]
      : []),
    ...(!isAdmin && isManager
      ? [
          {
            to: "/admin/users",
            label: "My team roster",
            icon: <Shield className="h-4 w-4" />,
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            to: "/admin",
            label: "Admin",
            icon: <Shield className="h-4 w-4" />,
            children: [
              { to: "/admin", label: "Overview", exact: true, icon: null },
              { to: "/admin/users", label: "Users & Teams", icon: null },
              { to: "/admin/markets", label: "Markets", icon: null },
              { to: "/admin/commissions", label: "Commission rules", icon: null },
              { to: "/admin/messaging", label: "Messaging", icon: null },
            ],
          },
        ]
      : []),
  ];


  return [{ label: "Sell", items: sell }, { label: "Manage", items: manage }];
}
