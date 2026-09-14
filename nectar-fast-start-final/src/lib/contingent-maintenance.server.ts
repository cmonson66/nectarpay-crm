import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Flips expired contingent placements to overdue and generates follow-up/pickup tasks. */
export async function runContingentMaintenance() {
  const { data, error } = await (
    supabaseAdmin.rpc as unknown as (fn: string) => Promise<{ data: unknown; error: { message: string } | null }>
  )("run_contingent_maintenance");
  if (error) throw new Error(error.message);
  return (data ?? {}) as Record<string, number>;
}
