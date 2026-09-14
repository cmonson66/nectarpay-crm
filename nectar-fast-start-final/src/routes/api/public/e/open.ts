// 1x1 open pixel. Opens are unreliable (mail clients prefetch) — clicks are
// the signal we alert on; this is just directional.

import { createFileRoute } from "@tanstack/react-router";

const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export const Route = createFileRoute("/api/public/e/open")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const recipientId = url.searchParams.get("r") ?? "";
        const sig = url.searchParams.get("s") ?? "";

        try {
          const { verifyLink } = await import("@/lib/email-campaigns.server");
          if (recipientId && verifyLink(recipientId, "open", sig)) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await supabaseAdmin
              .from("email_recipients")
              .update({ opened_at: new Date().toISOString() })
              .eq("id", recipientId)
              .is("opened_at", null);
          }
        } catch (e) {
          console.error("[email-open] tracking failed", e);
        }

        return new Response(PIXEL, {
          headers: {
            "Content-Type": "image/gif",
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        });
      },
    },
  },
});
