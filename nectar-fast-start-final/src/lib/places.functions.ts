import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { searchBusinessesOnGoogle } from "@/lib/places.server";

export const searchBusinesses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ query: z.string().trim().min(3).max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    return searchBusinessesOnGoogle(data.query);
  });
