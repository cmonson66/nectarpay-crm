import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { NavBadge, UserFooter, type NavEntry } from "@/components/crm/shell";

export type MobileNavItem = NavEntry;
export type MobileNavGroup = { label: string; items: NavEntry[] };

/**
 * Mobile top bar: hamburger opens a full navigation drawer so every section is
 * reachable on a phone (the desktop sidebar is hidden below `md`).
 */
export function MobileTopBar({
  groups,
  homeTo,
  kicker,
  role = "Rep",
  signOutTo = "/auth",
}: {
  groups: MobileNavGroup[];
  homeTo: string;
  kicker: string;
  role?: string;
  signOutTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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
        <SheetContent side="left" className="z-[1100] w-[17rem] border-border bg-sidebar p-0">
          <div className="flex h-full flex-col gap-4 px-3 pt-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
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
                    <Link
                      key={item.to + item.label}
                      to={item.to}
                      activeOptions={item.exact ? { exact: true } : undefined}
                      onClick={() => setOpen(false)}
                      className="relative flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-[13.5px] font-medium text-secondary-text transition-colors hover:bg-sidebar-accent hover:text-foreground"
                      activeProps={{
                        className:
                          "bg-honey/12 text-foreground before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:rounded-full before:bg-honey",
                      }}
                    >
                      <span className="shrink-0 opacity-90">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                      {item.badge ? <NavBadge value={item.badge} tone={item.badgeTone} /> : null}
                    </Link>
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
                navigate({ to: signOutTo });
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
