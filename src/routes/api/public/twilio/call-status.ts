// Call completion callbacks: duration, final status, recording (when enabled).
import { createFileRoute } from "@tanstack/react-router";
import { tokenMatches } from "@/lib/twilio.server";

export const Route = createFileRoute("/api/public/twilio/call-status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        if (!tokenMatches(url.searchParams.get("t"))) {
          return new Response("Unauthorized", { status: 401 });
        }
        const form = await request.formData();
        const sid = String(form.get("CallSid") ?? "");
        // When used as a <Dial action>, Twilio reports the child-leg result.
        const dialStatus = form.get("DialCallStatus");
        const isDialAction = Boolean(dialStatus);
        const status = String(dialStatus ?? form.get("CallStatus") ?? "");
        const duration =
          Number(form.get("DialCallDuration") ?? form.get("CallDuration") ?? 0) || null;
        const recording = form.get("RecordingUrl");
        const callId = url.searchParams.get("call");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const patch: {
          status: string;
          duration_seconds?: number;
          recording_url?: string;
        } = { status };
        if (duration) patch.duration_seconds = duration;
        if (recording) patch.recording_url = String(recording);

        let target = callId;
        if (target) {
          await supabaseAdmin.from("calls").update(patch).eq("id", target);
        } else if (sid) {
          const { data: row } = await supabaseAdmin
            .from("calls")
            .update(patch)
            .eq("twilio_sid", sid)
            .select("id")
            .maybeSingle();
          target = row?.id ?? null;
        }

        // Mirror finished calls into the activity timeline.
        const finished = ["completed", "answered", "no-answer", "busy", "failed", "canceled"];
        if (target && finished.includes(status)) {
          const { data: call } = await supabaseAdmin
            .from("calls")
            .select("lead_id, rep_id, direction, duration_seconds")
            .eq("id", target)
            .maybeSingle();
          if (call?.lead_id && call.rep_id) {
            await supabaseAdmin.from("activities").insert({
              lead_id: call.lead_id,
              rep_id: call.rep_id,
              type: "call",
              direction: call.direction === "inbound" ? "inbound" : "outbound",
              outcome: (call.duration_seconds ?? 0) > 20 ? "connected" : "no_answer",
              duration_seconds: call.duration_seconds,
              occurred_at: new Date().toISOString(),
            });
          }
        }

        // A <Dial action> callback must return TwiML, not plain text.
        if (isDialAction) {
          return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response/>`, {
            headers: { "content-type": "text/xml; charset=utf-8" },
          });
        }
        return new Response("ok");
      },
    },
  },
});

