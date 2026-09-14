// Delivery-status callbacks for outbound SMS.
import { createFileRoute } from "@tanstack/react-router";
import { tokenMatches } from "@/lib/twilio.server";

export const Route = createFileRoute("/api/public/twilio/sms-status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        if (!tokenMatches(url.searchParams.get("t"))) {
          return new Response("Unauthorized", { status: 401 });
        }
        const form = await request.formData();
        const sid = String(form.get("MessageSid") ?? "");
        const status = String(form.get("MessageStatus") ?? "");
        const errorCode = form.get("ErrorCode");
        if (!sid || !status) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("messages")
          .update({ status, error: errorCode ? `Twilio error ${String(errorCode)}` : null })
          .eq("twilio_sid", sid);
        return new Response("ok");
      },
    },
  },
});
