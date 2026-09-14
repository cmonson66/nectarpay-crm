import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Package, Trash2, UserRound, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DeviceStatus } from "@/lib/deals.functions";

type Device = {
  id: string;
  serial_number: string;
  model: string;
  status: string;
  assigned_rep_id: string | null;
  current_lead_id: string | null;
};
type Profile = { user_id: string; full_name: string | null; email: string | null };
type Team = { id: string; name: string; manager_id: string | null; is_active?: boolean };
type Member = { team_id: string; user_id: string };

const HELD_STATUSES = new Set<DeviceStatus | string>(["assigned_to_rep", "placed_contingent", "pending_sale"]);

function nameOf(p?: Profile) {
  return p?.full_name || p?.email || "Unknown";
}

function StatChip({ label, value, tone }: { label: string; value: number; tone?: "muted" | "accent" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${
        tone === "accent" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
      }`}
    >
      <span className="font-semibold tabular-nums">{value}</span>
      {label}
    </span>
  );
}

function RepRow({
  profile,
  devices,
  leadName,
  onMarkLost,
  onDelete,
}: {
  profile: Profile;
  devices: Device[];
  leadName: Record<string, string>;
  onMarkLost?: (device: Device) => void;
  onDelete?: (device: Device) => void;
}) {
  const [open, setOpen] = useState(false);
  const placed = devices.filter((d) => d.status === "placed_contingent").length;
  const inHand = devices.filter((d) => d.status === "assigned_to_rep").length;

  return (
    <div className="border-t border-border/50 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40"
      >
        <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{nameOf(profile)}</span>
        <span className="hidden gap-1.5 sm:flex">
          <StatChip label="in hand" value={inHand} />
          <StatChip label="placed" value={placed} />
        </span>
        <Badge variant={devices.length ? "default" : "secondary"} className="tabular-nums">
          {devices.length}
        </Badge>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="space-y-1 bg-muted/20 px-3 pb-3 pt-1">
          {devices.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">No terminals assigned.</p>
          ) : (
            devices.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono">{d.serial_number}</span>
                <span className="text-muted-foreground">{d.model}</span>
                {d.status === "placed_contingent" ? (
                  <span className="text-muted-foreground">
                    → {d.current_lead_id ? leadName[d.current_lead_id] || "placed" : "placed"}
                  </span>
                ) : null}
                {onMarkLost ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => onMarkLost(d)}
                  >
                    <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                    Mark lost
                  </Button>
                ) : null}
                {onDelete ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 px-2 text-xs text-destructive hover:text-destructive ${onMarkLost ? "" : "ml-auto"}`}
                    onClick={() => onDelete(d)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Delete
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}


export function DeviceRollup({
  devices,
  reps,
  teams,
  teamMembers,
  leadName,
  onMarkLost,
  onDelete,
}: {
  devices: Device[];
  reps: Profile[];
  teams: Team[];
  teamMembers: Member[];
  leadName: Record<string, string>;
  onMarkLost?: (device: Device) => void;
  onDelete?: (device: Device) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const model = useMemo(() => {
    const profileOf = new Map(reps.map((r) => [r.user_id, r]));
    const byRep = new Map<string, Device[]>();
    const unassigned: Device[] = [];
    for (const d of devices) {
      if (d.assigned_rep_id && HELD_STATUSES.has(d.status)) {
        const arr = byRep.get(d.assigned_rep_id) ?? [];
        arr.push(d);
        byRep.set(d.assigned_rep_id, arr);
      } else if (!d.assigned_rep_id) {
        unassigned.push(d);
      }
    }

    const memberIds = new Set<string>();
    const groups = teams.map((t) => {
      const repIds = teamMembers.filter((m) => m.team_id === t.id).map((m) => m.user_id);
      for (const id of repIds) memberIds.add(id);
      const members = repIds
        .map((id) => profileOf.get(id))
        .filter((p): p is Profile => Boolean(p))
        .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
      const total = repIds.reduce((sum, id) => sum + (byRep.get(id)?.length ?? 0), 0);
      const placed = repIds.reduce(
        (sum, id) => sum + (byRep.get(id)?.filter((d) => d.status === "placed_contingent").length ?? 0),
        0,
      );
      const managerDevices = t.manager_id ? byRep.get(t.manager_id)?.length ?? 0 : 0;
      return {
        id: t.id,
        name: t.name,
        manager: t.manager_id ? profileOf.get(t.manager_id) : undefined,
        managerDevices,
        members,
        total: total + (t.manager_id && !repIds.includes(t.manager_id) ? managerDevices : 0),
        placed,
        repsWithDevices: repIds.filter((id) => (byRep.get(id)?.length ?? 0) > 0).length,
      };
    });

    const orphanReps = reps
      .filter((r) => !memberIds.has(r.user_id) && !teams.some((t) => t.manager_id === r.user_id))
      .filter((r) => (byRep.get(r.user_id)?.length ?? 0) > 0)
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));

    return { byRep, unassigned, groups, orphanReps };
  }, [devices, reps, teams, teamMembers]);

  const totalHeld = devices.filter((d) => d.assigned_rep_id && HELD_STATUSES.has(d.status)).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <StatChip label="terminals total" value={devices.length} tone="accent" />
        <StatChip label="held by people" value={totalHeld} />
        <StatChip label="unassigned" value={model.unassigned.length} />
      </div>

      {model.groups.map((g) => {
        const open = expanded[g.id] ?? true;
        return (
          <div key={g.id} className="overflow-hidden rounded-lg border border-border">
            <div className="flex flex-wrap items-center gap-3 bg-muted/40 px-3 py-3">
              <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{g.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Manager: {g.manager ? nameOf(g.manager) : "unassigned"}
                  {g.managerDevices ? ` · holds ${g.managerDevices}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <StatChip label="terminals" value={g.total} tone="accent" />
                <StatChip label="placed" value={g.placed} />
                <StatChip label="reps holding" value={g.repsWithDevices} />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded((s) => ({ ...s, [g.id]: !open }))}
              >
                {open ? "Hide reps" : `Show ${g.members.length} reps`}
              </Button>
            </div>
            {open ? (
              <div>
                {g.manager ? (
                  <RepRow
                    profile={g.manager}
                    devices={model.byRep.get(g.manager.user_id) ?? []}
                    leadName={leadName}
                    onMarkLost={onMarkLost}
                    onDelete={onDelete}
                  />
                ) : null}
                {g.members
                  .filter((m) => m.user_id !== g.manager?.user_id)
                  .map((m) => (
                    <RepRow
                      key={m.user_id}
                      profile={m}
                      devices={model.byRep.get(m.user_id) ?? []}
                      leadName={leadName}
                      onMarkLost={onMarkLost}
                      onDelete={onDelete}
                    />
                  ))}
                {g.members.length === 0 && !g.manager ? (
                  <p className="px-3 py-4 text-xs text-muted-foreground">No reps on this team yet.</p>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}

      {model.orphanReps.length ? (
        <div className="overflow-hidden rounded-lg border border-dashed border-border">
          <div className="bg-muted/30 px-3 py-2.5">
            <p className="text-sm font-semibold">Reps without a team</p>
            <p className="text-xs text-muted-foreground">These terminals don’t roll up to any manager.</p>
          </div>
          {model.orphanReps.map((r) => (
            <RepRow
              key={r.user_id}
              profile={r}
              devices={model.byRep.get(r.user_id) ?? []}
              leadName={leadName}
              onMarkLost={onMarkLost}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}

      <div className="rounded-lg border border-border p-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <p className="flex-1 text-sm font-semibold">Unassigned inventory</p>
          <Badge variant="secondary" className="tabular-nums">{model.unassigned.length}</Badge>
        </div>
        {model.unassigned.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {model.unassigned.map((d) => (
              <span key={d.id} className="rounded bg-muted px-2 py-1 font-mono text-xs">
                {d.serial_number}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
