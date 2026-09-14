import type { LeadStatus } from "@/lib/crm.functions";

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  thinking: "Thinking",
  contingent: "Contingent",
  pending: "Pending payment",
  won: "Won",
  lost: "Lost",
  do_not_contact: "Do not contact",
};

export const STATUS_CLASS: Record<LeadStatus, string> = {
  new: "bg-amber-500 text-amber-950 border-amber-600",
  contacted: "bg-sky-500 text-sky-950 border-sky-600",
  thinking: "bg-violet-500 text-violet-950 border-violet-600",
  contingent: "bg-orange-500 text-orange-950 border-orange-600",
  pending: "bg-yellow-400 text-yellow-950 border-yellow-500",
  won: "bg-emerald-500 text-emerald-950 border-emerald-600",
  lost: "bg-zinc-500 text-zinc-950 border-zinc-600",
  do_not_contact: "bg-red-500 text-red-950 border-red-600",
};

/** Pill/chip tone per status, using the CRM design tokens. */
export const STATUS_TONE: Record<
  LeadStatus,
  "neutral" | "honey" | "green" | "red" | "blue" | "violet"
> = {
  new: "honey",
  contacted: "blue",
  thinking: "violet",
  contingent: "honey",
  pending: "honey",
  won: "green",
  lost: "neutral",
  do_not_contact: "red",
};
