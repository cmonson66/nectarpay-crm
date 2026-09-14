// Inbound SMS from Twilio. Handles STOP/UNSTOP and threads replies onto leads.
import { createFileRoute } from "@tanstack/react-router";
import { tokenMatches, escapeXml } from "@/lib/twilio.server";
import { toE164 } from "@/lib/phone";

const STOP_WORDS = ["stop", "stopall", "unsubscribe", "cancel", "end", "quit"];
const START_WORDS = ["start", "unstop", "yes"];

function twiml(message?: string) {
  const body = message ? `<Message>${escapeXml(message)}</Message>` : "";
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "content-type": "text/xml; charset=utf-8" },
  });
}

export const Route = createFileRoute("/api/public/twilio/sms")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        if (!tokenMatches(url.searchParams.get("t"))) {
          return new Response("Unauthorized", { status: 401 });
        }

        const form = await request.formData();
        const from = toE164(String(form.get("From") ?? ""));
        const body = String(form.get("Body") ?? "").trim();
        const sid = String(form.get("MessageSid") ?? "") || null;
        const to = String(form.get("To") ?? "");
        if (!from) return twiml();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: lead } = await supabaseAdmin
          .from("leads")
          .select("id, owner_rep_id")
          .eq("contact_phone_e164", from)
          .order("last_activity_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        const word = body.toLowerCase().replace(/[^a-z]/g, "");
        const isStop = STOP_WORDS.includes(word);
        const isStart = START_WORDS.includes(word);

        if (lead) {
          await supabaseAdmin.from("messages").insert({
            lead_id: lead.id,
            direction: "inbound",
            body: body || "(empty)",
            from_number: from,
            to_number: to,
            twilio_sid: sid,
            status: "received",
          });
          if (lead.owner_rep_id) {
            await supabaseAdmin.from("activities").insert({
              lead_id: lead.id,
              rep_id: lead.owner_rep_id,
              type: "sms",
              direction: "inbound",
              notes: body.slice(0, 500),
              occurred_at: new Date().toISOString(),
            });
          }


          if (isStop) {
            await supabaseAdmin
              .from("leads")
              .update({ sms_opted_out_at: new Date().toISOString(), sms_consent: false })
              .eq("id", lead.id);
          } else if (isStart) {
            await supabaseAdmin
              .from("leads")
              .update({ sms_opted_out_at: null, sms_consent: true })
              .eq("id", lead.id);
          }
        }

        if (isStop) return twiml("You have been unsubscribed and will receive no further messages.");
        if (isStart) return twiml("You are resubscribed. Reply STOP to opt out at any time.");
        return twiml();
      },
    },
  },
});
