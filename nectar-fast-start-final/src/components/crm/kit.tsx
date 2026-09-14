/**
 * Shared visual primitives for the CRM.
 * Presentation only — no data fetching, no business rules.
 */
import type { ReactNode } from "react";
import { Link, useCanGoBack, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── formatting ─────────────────────────────────────────────────── */

export function fmtInt(n: number | null | undefined) {
  return (Number(n) || 0).toLocaleString("en-US");
}

export function fmtMoney(n: number | null | undefined, opts?: { compact?: boolean }) {
  const v = Number(n) || 0;
  if (opts?.compact && Math.abs(v) >= 1000) {
    return `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  }
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function fmtPct(n: number) {
  return `${Math.round(Number.isFinite(n) ? n : 0)}%`;
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(" ", "")
    .toLowerCase();
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return `${fmtDate(iso)} ${fmtTime(iso)}`;
}

export function fmtRel(iso: string | null | undefined) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
}

export function daysBetween(iso: string | null | undefined, from = Date.now()) {
  if (!iso) return 0;
  return Math.ceil((new Date(iso).getTime() - from) / 86_400_000);
}

export function initials(name: string | null | undefined) {
  const parts = (name || "?").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/* ── atoms ──────────────────────────────────────────────────────── */

export function Num({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("num", className)}>{children}</span>;
}

export function Avatar({
  name,
  size = 24,
  className,
}: {
  name: string | null | undefined;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-[7px] bg-chip font-semibold text-secondary-text",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.4)) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Bar({
  pct,
  tone = "honey",
  height = 4,
  className,
}: {
  pct: number;
  tone?: "honey" | "green" | "red" | "muted";
  height?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const bg =
    tone === "green"
      ? "var(--green)"
      : tone === "red"
        ? "var(--red)"
        : tone === "muted"
          ? "var(--text-faint)"
          : "var(--honey)";
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-inset", className)}
      style={{ height }}
    >
      <div style={{ width: `${clamped}%`, height: "100%", background: bg, borderRadius: 999 }} />
    </div>
  );
}

/** Attainment bar: green at/over target, honey close, red far behind. */
export function attainmentTone(pct: number): "green" | "honey" | "red" {
  if (pct >= 100) return "green";
  if (pct < 60) return "red";
  return "honey";
}

export function Chip({
  children,
  active,
  count,
  tone = "neutral",
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  active?: boolean;
  count?: number;
  tone?: "neutral" | "honey" | "green" | "red" | "blue" | "violet";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const toneCls =
    tone === "honey"
      ? "text-honey-text"
      : tone === "green"
        ? "text-green-text"
        : tone === "red"
          ? "text-red-text"
          : tone === "blue"
            ? "text-sky-300"
            : tone === "violet"
              ? "text-violet-300"
              : "text-secondary-text";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors",
        active
          ? "border-honey/50 bg-honey/15 text-honey-text"
          : cn("border-border bg-inset hover:bg-chip", toneCls),
        disabled && "cursor-not-allowed opacity-45",
        className,
      )}
    >
      <span className="truncate">{children}</span>
      {count !== undefined ? <span className="num text-[11.5px] opacity-80">{count}</span> : null}
    </button>
  );
}

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "honey" | "green" | "red" | "blue" | "violet";
  className?: string;
}) {
  const map: Record<string, string> = {
    neutral: "bg-chip text-secondary-text",
    honey: "bg-honey/18 text-honey-text",
    green: "bg-green/18 text-green-text",
    red: "bg-red/18 text-red-text",
    blue: "bg-sky-500/18 text-sky-300",
    violet: "bg-violet-500/18 text-violet-300",
  };
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center whitespace-nowrap rounded-md px-2 text-[11.5px] font-semibold",
        map[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-lg border border-border bg-inset p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 rounded-[7px] px-2.5 text-[12.5px] font-medium transition-colors",
            value === o.value
              ? "bg-honey/20 text-honey-text"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── containers ─────────────────────────────────────────────────── */

export function Card({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("surface flex flex-col overflow-hidden", className)}>
      {title ? (
        <header className="flex min-h-[44px] items-center justify-between gap-3 border-b border-border px-3.5 py-2">
          <h2 className="sec-title truncate">{title}</h2>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn("min-w-0", bodyClassName ?? "p-3.5")}>{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <p className="text-[13px] font-semibold text-foreground">{title}</p>
      {hint ? <p className="max-w-sm text-[12.5px] text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function RowDivider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-divider bg-inset/60 px-3.5 py-1.5">
      <span className="micro-cap">{children}</span>
    </div>
  );
}

/* ── stat strip ─────────────────────────────────────────────────── */

export type StatCell = {
  label: string;
  delta?: ReactNode;
  value: ReactNode;
  target?: ReactNode;
  pct?: number;
  tone?: "honey" | "green" | "red" | "muted";
};

export function StatStrip({ cells, className }: { cells: StatCell[]; className?: string }) {
  return (
    <div className={cn("stat-strip", className)}>
      {cells.map((c, i) => (
        <div
          key={c.label}
          className={cn(
            "flex min-w-0 flex-col gap-2 p-3.5",
            i > 0 && "border-border sm:border-l",
            i > 0 && "border-t border-border sm:border-t-0",
          )}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="card-label truncate">{c.label}</span>
            {c.delta ? <span className="num text-[11.5px] shrink-0">{c.delta}</span> : null}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="num text-[27px] font-semibold leading-none text-foreground">
              {c.value}
            </span>
            {c.target ? (
              <span className="num text-[12px] text-muted-foreground">{c.target}</span>
            ) : null}
          </div>
          {c.pct !== undefined ? (
            <div className="flex items-center gap-2">
              <Bar pct={c.pct} tone={c.tone ?? attainmentTone(c.pct)} />
              <span className="num shrink-0 text-[11px] text-muted-foreground">
                {fmtPct(c.pct)}
              </span>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* ── grid tables ────────────────────────────────────────────────── */

export function GridTable({
  cols,
  minWidth = 860,
  children,
  className,
}: {
  cols: string;
  minWidth?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("scroll-x", className)}>
      <div style={{ minWidth }} data-grid-cols={cols}>
        {children}
      </div>
    </div>
  );
}

export function GridHead({ cols, children }: { cols: string; children: ReactNode }) {
  return (
    <div
      className="grid items-center gap-3 border-b border-border bg-inset/60 px-3.5 py-2"
      style={{ gridTemplateColumns: cols }}
    >
      {children}
    </div>
  );
}

export function GridRow({
  cols,
  children,
  className,
  onClick,
  tone,
}: {
  cols: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  tone?: "danger" | "dim";
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter") onClick();
            }
          : undefined
      }
      className={cn(
        "grid items-center gap-3 border-b border-divider px-3.5 py-2.5 text-[13px] transition-colors last:border-b-0",
        onClick && "cursor-pointer hover:bg-chip/40",
        tone === "danger" && "border-l-2 border-l-red bg-red/8",
        tone === "dim" && "opacity-55",
        className,
      )}
      style={{ gridTemplateColumns: cols }}
    >
      {children}
    </div>
  );
}

/* ── page header ────────────────────────────────────────────────── */

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string | true;
  actions?: ReactNode;
}) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-4 flex min-h-[60px] flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
      {back ? (
        typeof back === "string" ? (
          <Link
            to={back}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-inset text-muted-foreground hover:text-foreground"
            aria-label="Back"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => (canGoBack ? router.history.back() : undefined)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-inset text-muted-foreground hover:text-foreground"
            aria-label="Back"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )
      ) : null}
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h1 className="truncate text-[19px] font-bold tracking-[-0.01em]">{title}</h1>
        {subtitle ? (
          <p className="min-w-0 basis-full text-[12.5px] text-muted-foreground sm:basis-auto sm:truncate">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:basis-full">{actions}</div>
      ) : null}
    </header>
  );
}

/* ── buttons ────────────────────────────────────────────────────── */

const btnBase =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 max-sm:min-h-11";

export const btn = {
  primary: cn(btnBase, "bg-honey text-primary-foreground hover:bg-honey/90"),
  green: cn(btnBase, "bg-green text-white hover:bg-green/90"),
  outlineHoney: cn(btnBase, "border border-honey/55 text-honey-text hover:bg-honey/12"),
  secondary: cn(btnBase, "border border-border bg-inset text-secondary-text hover:bg-chip"),
  ghost: cn(btnBase, "text-muted-foreground hover:bg-chip hover:text-foreground"),
  danger: cn(btnBase, "border border-red/50 text-red-text hover:bg-red/12"),
};

export function IconButton({
  label,
  onClick,
  children,
  tone = "neutral",
  disabled,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  tone?: "neutral" | "honey" | "green";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border bg-inset transition-colors disabled:opacity-40 max-sm:h-11 max-sm:w-11",
        tone === "honey"
          ? "text-honey-text hover:bg-honey/15"
          : tone === "green"
            ? "text-green-text hover:bg-green/15"
            : "text-muted-foreground hover:bg-chip hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/* ── form controls ──────────────────────────────────────────────── */

export const fieldCls =
  "h-9 w-full rounded-lg border border-border bg-inset px-2.5 text-[13px] text-foreground outline-none placeholder:text-faint focus:border-honey/50 max-sm:h-11";

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="card-label">{label}</span>
      {children}
    </label>
  );
}

export function LabelRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-divider py-2 last:border-b-0">
      <span className="card-label shrink-0">{label}</span>
      <span className="min-w-0 break-words text-right text-[13px] text-secondary-text">{value}</span>
    </div>
  );
}
