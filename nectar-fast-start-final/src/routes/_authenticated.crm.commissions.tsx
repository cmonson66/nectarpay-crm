import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/crm/loading-state";
import {
  getCommissionReport,
  recalcCommissions,
  setCommissionStatus,
  setTerminalUnitCost,
  upsertSalary,
  type WeeklyPnl,
} from "@/lib/commissions.functions";

export const Route = createFileRoute("/_authenticated/crm/commissions")({
  component: CommissionsPage,
  head: () => ({
    meta: [
      { title: "Commissions & Quotas · Nectar.Pay CRM" },
      {
        name: "description",
        content:
          "Weekly (Sunday–Saturday) quota attainment, calculated commissions per rep, and the weekly P&L rollup.",
      },
      { property: "og:title", content: "Commissions & Quotas · Nectar.Pay CRM" },
      {
        property: "og:description",
        content: "Weekly quota attainment and calculated commissions per rep.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Bar({ value, target }: { value: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${pct >= 100 ? "bg-primary" : "bg-primary/60"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {value}/{target}
      </span>
    </div>
  );
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildWeeklyCsv(weekLabel: string, pnl: WeeklyPnl): string {
  const lines: (string | number)[][] = [
    ["Week", weekLabel],
    [],
    ["Terminals sold (full price)", pnl.full_count],
    ["Full-price revenue", pnl.full_revenue],
    ["Terminals sold (demo)", pnl.demo_count],
    ["Demo revenue", pnl.demo_revenue],
    [],
    ["Collections by payment method"],
    ["Check", pnl.collections.check],
    ["Zelle", pnl.collections.zelle],
    ["ACH", pnl.collections.ach],
    ["Plaid", pnl.collections.plaid],
    ["Other / unspecified", pnl.collections.other],
    ["Total collections", pnl.collections_total],
    [],
    ["Rep", "Weekly salary"],
    ...pnl.salaries.map((s) => [s.name, s.weekly_salary] as (string | number)[]),
    ["Total salaries", pnl.total_salaries],
    [],
    ["Unit cost per terminal", pnl.unit_cost],
    ["Terminals out the door", pnl.units],
    ["Cost of goods", pnl.cogs],
    ["Commissions earned", pnl.commissions_total],
    [],
    ["Net for the week", pnl.net],
  ];
  return lines.map((row) => row.map(csvCell).join(",")).join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function CommissionsPage() {
  const [weekStart, setWeekStart] = useState<string | undefined>(undefined);
  const qc = useQueryClient();

  const report = useServerFn(getCommissionReport);
  const recalc = useServerFn(recalcCommissions);
  const setStatus = useServerFn(setCommissionStatus);
  const saveSalary = useServerFn(upsertSalary);
  const saveUnitCost = useServerFn(setTerminalUnitCost);

  const { data, isLoading, error } = useQuery({
    queryKey: ["commission-report", weekStart ?? "current"],
    queryFn: () => report({ data: weekStart ? { week_start: weekStart } : {} }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["commission-report"] });

  const recalcMut = useMutation({
    mutationFn: (week: string) => recalc({ data: { week_start: week } }),
    onSuccess: (r) => {
      toast.success(`Recalculated ${r.lines} commission line${r.lines === 1 ? "" : "s"}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (v: { ids: string[]; status: "approved" | "paid" | "pending" }) =>
      setStatus({ data: v }),
    onSuccess: () => {
      toast.success("Commission status updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salaryMut = useMutation({
    mutationFn: (v: { user_id: string; weekly_salary: number }) => saveSalary({ data: v }),
    onSuccess: () => {
      toast.success("Salary saved");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unitCostMut = useMutation({
    mutationFn: (unit_cost: number) => saveUnitCost({ data: { unit_cost } }),
    onSuccess: () => {
      toast.success("Unit cost saved");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <PageSkeleton />;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">No data yet.</p>;

  const pendingIds = data.lines.filter((l) => l.status === "pending").map((l) => l.id);
  const approvedIds = data.lines.filter((l) => l.status === "approved").map((l) => l.id);

  // Reps get a personal earnings tracker, not the org-wide commission report.
  const isRepView = !data.isAdmin && !data.isManager;
  const mine = data.rows.find((r) => r.rep_id === data.viewerId);
  const myLines = data.lines.filter((l) => l.user_id === data.viewerId);
  const pnl = data.pnl;

  const weekPicker = (
    <select
      value={data.week.start}
      onChange={(e) => setWeekStart(e.target.value)}
      className="rounded-md border border-border bg-background px-3 py-2 text-sm"
    >
      {data.weeks.map((w) => (
        <option key={w.start} value={w.start}>
          {w.label}
          {w.is_current ? " (this week)" : ""}
        </option>
      ))}
    </select>
  );

  if (isRepView) {
    return (
      <div className="space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-tight">My earnings</h1>
            <p className="text-sm text-muted-foreground">
              Your quota attainment and commission tracking for the week (Sun–Sat).
            </p>
          </div>
          {weekPicker}
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Touches", value: `${mine?.touches ?? 0}/${mine?.touches_target ?? 0}` },
            { label: "Deals won", value: `${mine?.sales ?? 0}/${mine?.sales_target ?? 0}` },
            { label: "Contingents", value: `${mine?.contingents ?? 0}/${mine?.contingents_target ?? 0}` },
            { label: "Revenue", value: money(mine?.revenue ?? 0) },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card/40 p-5">
              <p className="text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">
                {s.label}
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Pending", value: mine?.pending ?? 0 },
            { label: "Approved", value: mine?.approved ?? 0 },
            { label: "Paid", value: mine?.paid ?? 0 },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card/40 p-5">
              <p className="text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">
                {s.label}
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight">{money(s.value)}</p>
            </div>
          ))}
        </div>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            My commission lines
          </h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {myLines.map((l) => (
                  <tr key={l.id} className="border-t border-border/40">
                    <td className="px-4 py-2 text-muted-foreground">
                      {l.role_in_deal.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-2 font-medium">{money(l.amount)}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                        {l.status.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                ))}
                {myLines.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      Nothing earned this week yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-tight">Commissions</h1>
          <p className="text-sm text-muted-foreground">
            {data.isAdmin
              ? "Every team — week of "
              : "Your team — week of "}
            {data.week.label} (Sun–Sat).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {weekPicker}
          {data.isAdmin && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={recalcMut.isPending}
                onClick={() => recalcMut.mutate(data.week.start)}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${recalcMut.isPending ? "animate-spin" : ""}`} />
                Recalculate
              </Button>
              {pnl && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadCsv(
                      `weekly-pnl-${data.week.start}.csv`,
                      buildWeeklyCsv(data.week.label, pnl),
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              )}
            </>
          )}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Touches", value: data.totals.touches.toLocaleString() },
          { label: "Deals won", value: data.totals.sales.toLocaleString() },
          { label: "Revenue", value: money(data.totals.revenue) },
          { label: "Commission", value: money(data.totals.earned) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card/40 p-5">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">
              {s.label}
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Attainment
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Rep</th>
                <th className="px-4 py-2">Touches</th>
                <th className="px-4 py-2">Sales</th>
                <th className="px-4 py-2">Contingents</th>
                <th className="px-4 py-2">Revenue</th>
                <th className="px-4 py-2">Commission</th>
                <th className="px-4 py-2">Paid</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.rep_id} className="border-t border-border/40">
                  <td className="px-4 py-2">
                    {r.name}
                    {r.sales < r.sales_minimum && (
                      <span className="ml-2 rounded-full bg-destructive/15 px-2 py-0.5 text-[0.6rem] uppercase tracking-widest text-destructive">
                        below min
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Bar value={r.touches} target={r.touches_target} />
                  </td>
                  <td className="px-4 py-2">
                    <Bar value={r.sales} target={r.sales_target} />
                  </td>
                  <td className="px-4 py-2">
                    <Bar value={r.contingents} target={r.contingents_target} />
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{money(r.revenue)}</td>
                  <td className="px-4 py-2 font-medium">{money(r.earned)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{money(r.paid)}</td>
                </tr>
              ))}
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No activity this week.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {data.isAdmin && pnl && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Weekly P&amp;L · {data.week.label}
            </h2>
            <form
              className="flex items-center gap-2 text-xs text-muted-foreground"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                unitCostMut.mutate(Number(f.get("unit_cost")));
              }}
            >
              Terminal unit cost
              <input
                key={pnl.unit_cost}
                name="unit_cost"
                type="number"
                min="0"
                step="0.01"
                defaultValue={pnl.unit_cost}
                className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
              <Button size="sm" variant="outline" type="submit" disabled={unitCostMut.isPending}>
                Save
              </Button>
            </form>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Collections", value: money(pnl.collections_total) },
              { label: "Cost of goods", value: `−${money(pnl.cogs)}` },
              { label: "Salaries", value: `−${money(pnl.total_salaries)}` },
              { label: "Commissions", value: `−${money(pnl.commissions_total)}` },
              {
                label: "Net",
                value: `${pnl.net < 0 ? "−" : ""}${money(Math.abs(pnl.net))}`,
                tone: pnl.net >= 0 ? "text-primary" : "text-destructive",
              },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-card/40 p-5">
                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">
                  {s.label}
                </p>
                <p className={`mt-2 text-2xl font-bold tracking-tight ${s.tone ?? ""}`}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border">
              <h3 className="border-b border-border/40 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Terminals sold
              </h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-border/40">
                    <td className="px-4 py-2">Full price ($499 + $228/yr)</td>
                    <td className="px-4 py-2 text-right font-medium">{pnl.full_count}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {money(pnl.full_revenue)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">
                      Demo ($250)
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[0.6rem] uppercase tracking-widest text-muted-foreground">
                        no commission
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{pnl.demo_count}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {money(pnl.demo_revenue)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-border">
              <h3 className="border-b border-border/40 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Collected by payment method
              </h3>
              <table className="w-full text-sm">
                <tbody>
                  {(
                    [
                      ["Check", pnl.collections.check],
                      ["Zelle", pnl.collections.zelle],
                      ["ACH", pnl.collections.ach],
                      ["Plaid", pnl.collections.plaid],
                      ["Other / unspecified", pnl.collections.other],
                    ] as const
                  ).map(([label, value]) => (
                    <tr key={label} className="border-b border-border/40 last:border-0">
                      <td className="px-4 py-2">{label}</td>
                      <td className="px-4 py-2 text-right font-medium">{money(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-border">
            <h3 className="border-b border-border/40 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Weekly salaries — set once, carries forward
            </h3>
            <table className="w-full text-sm">
              <tbody>
                {pnl.salaries.map((s) => (
                  <tr key={s.user_id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2">{s.name}</td>
                    <td className="px-4 py-2 text-right">
                      <form
                        className="flex items-center justify-end gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          salaryMut.mutate({
                            user_id: s.user_id,
                            weekly_salary: Number(f.get("weekly_salary")),
                          });
                        }}
                      >
                        <input
                          key={`${s.user_id}:${s.weekly_salary}`}
                          name="weekly_salary"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={s.weekly_salary}
                          className="w-28 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          type="submit"
                          disabled={salaryMut.isPending}
                        >
                          Save
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
                {pnl.salaries.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No reps or managers on the roster yet.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/30">
                  <td className="px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Total salaries
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">
                    {money(pnl.total_salaries)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {data.isAdmin && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Commission lines
            </h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pendingIds.length === 0 || statusMut.isPending}
                onClick={() => statusMut.mutate({ ids: pendingIds, status: "approved" })}
              >
                Approve pending ({pendingIds.length})
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={approvedIds.length === 0 || statusMut.isPending}
                onClick={() => statusMut.mutate({ ids: approvedIds, status: "paid" })}
              >
                Mark approved paid ({approvedIds.length})
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Person</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l) => (
                  <tr key={l.id} className="border-t border-border/40">
                    <td className="px-4 py-2">{l.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {l.role_in_deal.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-2 font-medium">{money(l.amount)}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                        {l.status.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.lines.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      Nothing calculated yet — hit Recalculate.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
