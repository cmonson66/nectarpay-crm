/**
 * First-year value per prospect, summed from that prospect's deals.
 * Reads through the browser client so row-level security scopes it exactly
 * like every other CRM read.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDealValues() {
  const query = useQuery({
    queryKey: ["crm-deal-values"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("lead_id, total_amount, status")
        .limit(5000);
      if (error) throw new Error(error.message);
      const map = new Map<string, number>();
      for (const d of data ?? []) {
        if (!d.lead_id || d.status === "lost" || d.status === "returned") continue;
        map.set(d.lead_id, (map.get(d.lead_id) ?? 0) + Number(d.total_amount ?? 0));
      }
      return map;
    },
  });
  return query.data ?? new Map<string, number>();
}
