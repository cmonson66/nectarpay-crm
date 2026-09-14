// TwiML Application endpoint — drives both directions of browser calling.
//   Outbound: the softphone dials a lead from the shared org number.
//   Inbound:  the org number rings the owning rep's browser, then their cell,
//             then takes voicemail.
// All legs are recorded (dual channel) and logged to public.calls.
import { createFileRoute } from "@tanstack/react-router";
import { tokenMatches, escapeXml, publicBaseUrl, webhookToken } from "@/lib/twilio.server";
import { userIdFromIdentity, voiceIdentity } from "@/lib/twilio-token.server";
import { toE164 } from "@/lib/phone";

function twiml(xml: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${xml}</Response>`, {
    headers: { "content-type": "text/xml; charset=utf-8" },
  });
}

async function handler({ request }: { request: Request }) {
  const url = new URL(request.url);
  if (!tokenMatches(url.searchParams.get("t"))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const form = await request.formData();
  const from = String(form.get("From") ?? "");
  const to = String(form.get("To") ?? "");
  const callSid = String(form.get("CallSid") ?? "");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const base = publicBaseUrl(request);
  const t = webhookToken();
  const recordingCallback = `${base}/api/public/twilio/recording?t=${t}`;
  const statusCallback = `${base}/api/public/twilio/call-status?t=${t}`;
  const recordAttrs =
    `record="record-from-answer-dual" recordingStatusCallback="${escapeXml(recordingCallback)}"` +
    ` recordingStatusCallbackMethod="POST"`;

  // ── Outbound: browser → lead ────────────────────────────────────────
  if (from.startsWith("client:")) {
    const repId = userIdFromIdentity(from.slice("client:".length));
    const target = toE164(to);
    if (!target) return twiml("<Say>No number to dial.</Say>");

    const { data: setting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "twilio_from_number")
      .maybeSingle();
    const callerId = (setting?.value ?? "").trim();

    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("contact_phone_e164", target)
      .order("last_activity_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (lead) {
      await supabaseAdmin.from("calls").insert({
        lead_id: lead.id,
        direction: "outbound",
        from_number: callerId || null,
        to_number: target,
        twilio_sid: callSid || null,
        status: "in-progress",
        rep_id: repId,
      });
    }

    const callerAttr = callerId ? ` callerId="${escapeXml(callerId)}"` : "";
    return twiml(
      `<Dial${callerAttr} timeout="30" answerOnBridge="true" ${recordAttrs}` +
        ` action="${escapeXml(statusCallback)}" method="POST">` +
        `<Number>${escapeXml(target)}</Number></Dial>`,
    );
  }

  // ── Inbound: lead → org number ──────────────────────────────────────
  const caller = toE164(from);
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id, owner_rep_id, business_name")
    .eq("contact_phone_e164", caller)
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  let repCell: string | null = null;
  if (lead?.owner_rep_id) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("phone_e164")
      .eq("user_id", lead.owner_rep_id)
      .maybeSingle();
    repCell = profile?.phone_e164 ?? null;
  }

  if (lead) {
    await supabaseAdmin.from("calls").insert({
      lead_id: lead.id,
      direction: "inbound",
      from_number: caller || from,
      to_number: to,
      twilio_sid: callSid || null,
      status: "ringing",
      rep_id: lead.owner_rep_id,
    });
  }

  const targets: string[] = [];
  if (lead?.owner_rep_id) {
    targets.push(
      `<Client><Identity>${escapeXml(voiceIdentity(lead.owner_rep_id))}</Identity></Client>`,
    );
    if (repCell) targets.push(`<Number>${escapeXml(repCell)}</Number>`);
  }

  if (targets.length === 0) {
    return twiml(
      `<Say voice="alice">Thanks for calling Nectar Pay. Please leave a message after the tone.</Say>` +
        `<Record maxLength="120" transcribe="false" recordingStatusCallback="${escapeXml(recordingCallback)}" recordingStatusCallbackMethod="POST" />`,
    );
  }

  return twiml(
    `<Dial timeout="25" answerOnBridge="true" callerId="${escapeXml(caller || to)}" ${recordAttrs}` +
      ` action="${escapeXml(statusCallback)}" method="POST">${targets.join("")}</Dial>` +
      `<Say voice="alice">Sorry, no one is available. Please leave a message after the tone.</Say>` +
      `<Record maxLength="120" recordingStatusCallback="${escapeXml(recordingCallback)}" recordingStatusCallbackMethod="POST" />`,
  );
}

export const Route = createFileRoute("/api/public/twilio/voice-app")({
  server: { handlers: { GET: handler, POST: handler } },
});
