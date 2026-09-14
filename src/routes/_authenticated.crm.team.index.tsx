import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, AlertTriangle } from "lucide-react";
import { getTeamBoard, type TeamRow } from "@/lib/dashboard.functions";
import { PageSkeleton } from "@/components/crm/loading-state";

export const Route = createFileRoute("/_authenticated/crm/team/")({
  beforeLoad: ({ context }) => {
    // UX guard only — getTeamBoard is scoped server-side regardless.
    if (!context.canSeeTeam) throw redirect({ to: "/crm" });
  },
  component: TeamBoard,
  head: () => ({
    meta: [
      { title: "Team board · Nectar.Pay CRM" },
      {
        name: "description",
        content:
          "Per-rep activity board: touches, calls and emails today, open leads, contingents and sales against the weekly minimum.",
      },
      { property: "og:title", content: "Team board · Nectar.Pay CRM" },
      { property: "og:description", content: "Per-rep activity and quota attainment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type SortKey =
  | "name"
  | "touches"
  | "calls_today"
  | "emails_today"
  | "open_leads"
  | "active_contingents"
  | "sales"
  | "last_activity_at";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Rep" },
  { key: "touches", label: "Touches (period)" },
  { key: "calls_today", label: "Calls today" },
  { key: "emails_today", label: "Emails today" },
  { key: "open_leads", label: "Open leads" },
  { key: "active_contingents", label: "Contingents" },
  { key: "sales", label: "Sales / min" },
  { key: "last_activity_at", label: "Last activity" },
];

function fmtWhen(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function TeamBoard() {
  const fn = useServerFn(getTeamBoard);
  const { data, isLoading, error } = useQuery({ queryKey: ["crm-team-board"], queryFn: () => fn() });
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "touches",
    dir: "desc",
  });

  const rows = useMemo(() => {
    const list = [...(data?.rows ?? [])];
    const { key, dir } = sort;
    list.sort((a, b) => {
      const av = a[key as keyof TeamRow];
      const bv = b[key as keyof TeamRow];
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      return dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [data?.rows, sort]);

  if (isLoading) return <PageSkeleton />;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const paceFraction = Math.min(1, data.elapsedDays / 7);

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold uppercase tracking-tight">Team board</h1>
        <p className="text-sm text-muted-foreground">
          Period {new Date(`${data.period.period_start}T00:00:00`).toLocaleDateString()} –{" "}
          {new Date(`${data.period.period_end}T00:00:00`).toLocaleDateString()} · day{" "}
          {Math.ceil(data.elapsedDays) || 1} of 7
        </p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => toggle(c.key)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {c.label}
                    {sort.key === c.key &&
                      (sort.dir === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      ))}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const idle = r.activity_today === 0;
              const behindPace =
                data.midWeek && r.touches < Math.round(r.touches_target * paceFraction);
              return (
                <tr
                  key={r.rep_id}
                  className={`border-t border-border/40 ${idle ? "bg-destructive/5" : ""}`}
                >
                  <td className="px-4 py-2">
                    <Link
                      to="/crm/team/$repId"
                      params={{ repId: r.rep_id }}
                      className="font-medium hover:underline"
                    >
                      {r.name}
                    </Link>
                    {r.team_name && (
                      <span className="ml-2 text-xs text-muted-foreground">{r.team_name}</span>
                    )}
                    {idle && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[0.6rem] uppercase tracking-widest text-destructive">
                        <AlertTriangle className="h-3 w-3" /> no activity today
                      </span>
                    )}
                    {behindPace && (
                      <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.6rem] uppercase tracking-widest text-amber-500">
                        behind pace
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {r.touches}
                    <span className="text-muted-foreground"> / {r.touches_target}</span>
                  </td>
                  <td className="px-4 py-2">{r.calls_today}</td>
                  <td className="px-4 py-2">{r.emails_today}</td>
                  <td className="px-4 py-2">{r.open_leads}</td>
                  <td className="px-4 py-2">
                    {r.active_contingents}
                    <span className="text-muted-foreground"> / {r.contingents_target}</span>
                  </td>
                  <td
                    className={`px-4 py-2 ${r.sales < r.sales_minimum ? "text-destructive" : ""}`}
                  >
                    {r.sales} / {r.sales_minimum}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{fmtWhen(r.last_activity_at)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-6 text-center text-muted-foreground">
                  No reps in your scope.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
