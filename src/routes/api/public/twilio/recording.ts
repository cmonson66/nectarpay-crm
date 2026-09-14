// Recording completion callback — attaches the audio to the call record.
import { createFileRoute } from "@tanstack/react-router";
import { tokenMatches } from "@/lib/twilio.server";

export const Route = createFileRoute("/api/public/twilio/recording")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        if (!tokenMatches(url.searchParams.get("t"))) {
          return new Response("Unauthorized", { status: 401 });
        }
        const form = await request.formData();
        const callSid = String(form.get("CallSid") ?? "");
        const recordingUrl = String(form.get("RecordingUrl") ?? "");
        const duration = Number(form.get("RecordingDuration") ?? 0) || null;
        if (!callSid || !recordingUrl) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const patch: { recording_url: string; duration_seconds?: number } = {
          recording_url: `${recordingUrl}.mp3`,
        };
        if (duration) patch.duration_seconds = duration;
        await supabaseAdmin.from("calls").update(patch).eq("twilio_sid", callSid);
        return new Response("ok");
      },
    },
  },
});
