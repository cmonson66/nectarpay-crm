import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Search,
  MoreHorizontal,
  Sun,
  Moon,
  LogOut,
  Menu,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/kit";
import { SoftphoneProvider } from "@/components/crm/softphone";
import type { ReactNode } from "react";

export type NavEntry = {
  to: string;
  label: string;
  icon: ReactNode;
  exact?: boolean;
  badge?: number;
  badgeTone?: "neutral" | "red" | "honey";
  children?: NavEntry[];
};

export type NavGroupDef = { label: string; items: NavEntry[] };

export function CrmShell({
  groups,
  children,
  homeTo = "/crm",
  kicker = "Sales CRM",
  role = "Rep",
}: {
  groups: NavGroupDef[];
  children: ReactNode;
  homeTo?: string;
  kicker?: string;
  role?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("crm-sidebar-collapsed") === "1");
  }, []);

  const toggleCollapsed = () =>
    setCollapsed((v) => {
      localStorage.setItem("crm-sidebar-collapsed", v ? "0" : "1");
      return !v;
    });

  return (
    <SoftphoneProvider>
      <div className="flex min-h-screen bg-background">
        <DesktopSidebar
          groups={groups}
          homeTo={homeTo}
          kicker={kicker}
          role={role}
          collapsed={collapsed}
          onToggle={toggleCollapsed}
        />
        <main
          className={cn(
            "min-w-0 flex-1 overflow-x-hidden transition-[padding] duration-200",
            collapsed ? "md:pl-[64px]" : "md:pl-[238px]",
          )}
        >
          <MobileTopBar groups={groups} homeTo={homeTo} kicker={kicker} role={role} />
          <div className="mx-auto max-w-[1400px] px-4 pb-10 sm:px-6">{children}</div>
        </main>
      </div>
    </SoftphoneProvider>
  );
}

function DesktopSidebar({
  groups,
  homeTo,
  kicker,
  role,
  collapsed,
  onToggle,
}: {
  groups: NavGroupDef[];
  homeTo: string;
  kicker: string;
  role: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { user } = useAuth();
  return (
    <aside
      className={cn(
        "fixed top-0 left-0 z-30 hidden h-screen flex-col gap-4 overflow-hidden border-r border-border bg-sidebar py-3.5 transition-[width] duration-200 md:flex",
        collapsed ? "w-[64px] px-2" : "w-[238px] px-3",
      )}
    >
      <div className={cn("flex items-center gap-1", collapsed && "flex-col gap-2")}>
        <Link to={homeTo} className="flex min-w-0 flex-1 items-center gap-2.5 px-1">
          <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg bg-honey text-[14px] font-extrabold text-primary-foreground">
            N
          </span>
          {collapsed ? null : (
            <span className="flex min-w-0 flex-col leading-none">
              <span className="truncate text-[14px] font-bold tracking-[-0.01em]">NectarPay</span>
              <span className="micro-cap mt-1">{kicker}</span>
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-chip hover:text-foreground"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {collapsed ? (
        <Link
          to="/crm/leads"
          aria-label="Search prospects"
          title="Search prospects"
          className="grid h-9 place-items-center rounded-lg border border-border bg-inset text-faint hover:bg-chip"
        >
          <Search className="h-4 w-4" />
        </Link>
      ) : (
        <GlobalSearch />
      )}

      <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {groups.map((group) => (
          <NavGroup key={group.label} {...group} collapsed={collapsed} />
        ))}
      </nav>

      {collapsed ? null : <UserFooter email={user?.email ?? ""} role={role} />}
    </aside>
  );
}

function GlobalSearch() {
  return (
    <Link
      to="/crm/leads"
      className="flex h-9 items-center gap-2 rounded-lg border border-border bg-inset px-2.5 text-left text-[12.5px] text-faint transition-colors hover:bg-chip"
    >
      <Search className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 truncate">Search prospects</span>
      <kbd className="num rounded border border-border px-1 text-[10px] text-faint">⌘K</kbd>
    </Link>
  );
}

function NavGroup({ label, items, collapsed }: NavGroupDef & { collapsed?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      {collapsed ? (
        <span className="mx-2 mb-1 h-px bg-divider" />
      ) : (
        <span className="micro-cap px-2 pb-1">{label}</span>
      )}
      {items.map((item) => (
        <NavItem key={item.to + item.label} {...item} collapsed={collapsed} />
      ))}
    </div>
  );
}

export function NavBadge({ value, tone }: { value: number; tone?: "neutral" | "red" | "honey" }) {
  return (
    <span
      className={cn(
        "num ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold",
        tone === "red"
          ? "bg-red/18 text-red-text"
          : tone === "honey"
            ? "bg-honey/18 text-honey-text"
            : "bg-chip text-secondary-text",
      )}
    >
      {value}
    </span>
  );
}

function NavItem({
  to,
  icon,
  label,
  exact,
  badge,
  badgeTone,
  children,
  collapsed,
}: NavEntry & { collapsed?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
  const hasChildren = children && children.length > 0;
  const childActive = hasChildren && children!.some((c) => pathname === c.to || pathname.startsWith(`${c.to}/`));
  const [open, setOpen] = useState(active || childActive);

  if (collapsed) {
    return (
      <Link
        to={to}
        activeOptions={exact ? { exact: true } : undefined}
        title={label}
        aria-label={label}
        className={cn(
          "relative grid h-[34px] place-items-center rounded-lg transition-colors hover:bg-sidebar-accent hover:text-foreground",
          active ? "bg-honey/12 text-foreground" : "text-secondary-text",
        )}
      >
        <span className="shrink-0 opacity-90">{icon}</span>
        {badge ? (
          <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-honey" />
        ) : null}
      </Link>
    );
  }

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "relative flex h-[34px] items-center rounded-lg",
          active &&
            "bg-honey/12 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:rounded-full before:bg-honey",
        )}
      >
        <Link
          to={to}
          activeOptions={exact ? { exact: true } : undefined}
          className={cn(
            "flex flex-1 items-center gap-2.5 rounded-lg px-2 text-[13.5px] font-medium transition-colors hover:bg-sidebar-accent hover:text-foreground",
            active ? "text-foreground" : "text-secondary-text",
          )}
        >
          <span className={cn("shrink-0 opacity-90", active && "text-foreground")}>{icon}</span>
          <span className="truncate">{label}</span>
          {badge ? <NavBadge value={badge} tone={badgeTone} /> : null}
        </Link>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "mr-1 grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
            aria-label={open ? "Collapse" : "Expand"}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {hasChildren && open ? (
        <div className="flex flex-col gap-0.5 pl-4 pt-0.5">
          {children!.map((child) => {
            const childPathActive =
              child.exact
                ? pathname === child.to
                : pathname === child.to || pathname.startsWith(`${child.to}/`);
            return (
              <Link
                key={child.to + child.label}
                to={child.to}
                activeOptions={child.exact ? { exact: true } : undefined}
                className={cn(
                  "relative flex h-[30px] items-center gap-2 rounded-lg px-2 text-[12.5px] font-medium transition-colors",
                  childPathActive
                    ? "bg-honey/10 text-foreground before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[2px] before:rounded-full before:bg-honey/70"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                )}
              >
                <span className="truncate">{child.label}</span>
                {child.badge ? <NavBadge value={child.badge} tone={child.badgeTone} /> : null}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function MobileTopBar({
  groups,
  homeTo,
  kicker,
  role,
}: {
  groups: NavGroupDef[];
  homeTo: string;
  kicker: string;
  role: string;
}) {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();

  return (
    <div className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Open menu"
            className="grid h-11 w-11 place-items-center rounded-lg text-muted-foreground hover:bg-chip hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[17rem] border-border bg-sidebar p-0">
          <div className="flex h-full flex-col gap-4 px-3 py-3.5">
            <Link to={homeTo} onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-1">
              <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg bg-honey text-[14px] font-extrabold text-primary-foreground">
                N
              </span>
              <span className="flex min-w-0 flex-col leading-none">
                <span className="truncate text-[14px] font-bold tracking-[-0.01em]">NectarPay</span>
                <span className="micro-cap mt-1">{kicker}</span>
              </span>
            </Link>

            <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
              {groups.map((group) => (
                <div key={group.label} className="flex flex-col gap-1">
                  <span className="micro-cap px-2 pb-1">{group.label}</span>
                  {group.items.map((item) => (
                    <MobileNavItem key={item.to + item.label} {...item} onNavigate={() => setOpen(false)} />
                  ))}
                </div>
              ))}
            </nav>

            <UserFooter
              email={user?.email ?? ""}
              role={role}
              onSignOut={async () => {
                setOpen(false);
                await signOut();
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Link to={homeTo} className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[14px] font-bold tracking-[-0.01em]">NectarPay</span>
        <span className="micro-cap">{kicker}</span>
      </Link>
    </div>
  );
}

function MobileNavItem({
  to,
  icon,
  label,
  exact,
  badge,
  badgeTone,
  children,
  onNavigate,
}: NavEntry & { onNavigate: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
  const hasChildren = children && children.length > 0;
  const [open, setOpen] = useState(active || (hasChildren && children!.some((c) => pathname === c.to || pathname.startsWith(`${c.to}/`))));

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "relative flex min-h-11 items-center rounded-lg",
          active &&
            "bg-honey/12 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:rounded-full before:bg-honey",
        )}
      >
        <Link
          to={to}
          activeOptions={exact ? { exact: true } : undefined}
          onClick={() => !hasChildren && onNavigate()}
          className={cn(
            "flex flex-1 items-center gap-2.5 rounded-lg px-2 text-[13.5px] font-medium transition-colors hover:bg-sidebar-accent hover:text-foreground",
            active ? "text-foreground" : "text-secondary-text",
          )}
        >
          <span className={cn("shrink-0 opacity-90", active && "text-foreground")}>{icon}</span>
          <span className="truncate">{label}</span>
          {badge ? <NavBadge value={badge} tone={badgeTone} /> : null}
        </Link>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "mr-1 grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
            aria-label={open ? "Collapse" : "Expand"}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {hasChildren && open ? (
        <div className="flex flex-col gap-0.5 pl-4 pt-0.5">
          {children!.map((child) => {
            const childPathActive =
              child.exact
                ? pathname === child.to
                : pathname === child.to || pathname.startsWith(`${child.to}/`);
            return (
              <Link
                key={child.to + child.label}
                to={child.to}
                activeOptions={child.exact ? { exact: true } : undefined}
                onClick={onNavigate}
                className={cn(
                  "relative flex min-h-10 items-center gap-2 rounded-lg px-2 text-[12.5px] font-medium transition-colors",
                  childPathActive
                    ? "bg-honey/10 text-foreground before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:rounded-full before:bg-honey/70"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                )}
              >
                <span className="truncate">{child.label}</span>
                {child.badge ? <NavBadge value={child.badge} tone={child.badgeTone} /> : null}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function UserFooter({
  email,
  role,
  onSignOut,
}: {
  email: string;
  role: string;
  onSignOut?: () => void;
}) {
  const { theme, toggle } = useTheme();
  return (
    <div className="flex items-center gap-2 border-t border-border pt-3">
      <Avatar name={email} size={28} />
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-[12.5px] font-semibold">{email.split("@")[0]}</span>
        <span className="text-[11px] text-muted-foreground">{role}</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Account menu"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-chip hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={toggle}>
            {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            {theme === "dark" ? "Light theme" : "Dark theme"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
