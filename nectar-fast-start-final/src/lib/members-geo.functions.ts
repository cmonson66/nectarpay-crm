// Admin-only: aggregated member geo points for the Knowledge heatmap.
// Groups by ZIP (or ~0.1° cell as fallback) so the client renders 7-8k
// weighted points instead of 49k markers.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MemberHeatPoint = { lat: number; lng: number; count: number };
export type TopState = { state: string; count: number };
export type TopMetro = { lat: number; lng: number; count: number };

export const getMemberHeatPoints = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      points: MemberHeatPoint[];
      total: number;
      topStates: TopState[];
      topMetros: TopMetro[];
    }> => {
      const { data: isAdmin } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("Forbidden");

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const pageSize = 1000;
      const all: { lat: number | null; lng: number | null; state: string | null }[] = [];
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabaseAdmin
          .from("members_geo")
          .select("lat,lng,state")
          .eq("country", "US")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
      }

      // Fine grid for the heat layer (~0.7mi)
      const fine = new Map<string, MemberHeatPoint>();
      // Coarse grid for "top metros" (~7mi — roughly one metro area)
      const metro = new Map<string, TopMetro>();
      const stateCounts = new Map<string, number>();

      for (const r of all) {
        if (typeof r.lat !== "number" || typeof r.lng !== "number") continue;
        const flat = Math.round(r.lat * 100) / 100;
        const flng = Math.round(r.lng * 100) / 100;
        const fk = `${flat},${flng}`;
        const fc = fine.get(fk);
        if (fc) fc.count += 1;
        else fine.set(fk, { lat: flat, lng: flng, count: 1 });

        const mlat = Math.round(r.lat * 10) / 10;
        const mlng = Math.round(r.lng * 10) / 10;
        const mk = `${mlat},${mlng}`;
        const mc = metro.get(mk);
        if (mc) mc.count += 1;
        else metro.set(mk, { lat: mlat, lng: mlng, count: 1 });

        if (r.state) stateCounts.set(r.state, (stateCounts.get(r.state) ?? 0) + 1);
      }

      const topStates = [...stateCounts.entries()]
        .map(([state, count]) => ({ state, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);
      const topMetros = [...metro.values()].sort((a, b) => b.count - a.count).slice(0, 25);

      return {
        points: [...fine.values()],
        total: all.length,
        topStates,
        topMetros,
      };
    },
  );
