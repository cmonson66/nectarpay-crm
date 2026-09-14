// TwiML for bridged calls: Twilio has already reached the rep, now dial the lead.
import { createFileRoute } from "@tanstack/react-router";
import { tokenMatches, escapeXml } from "@/lib/twilio.server";
import { toE164 } from "@/lib/phone";

function twimlResponse(xml: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${xml}</Response>`, {
    headers: { "content-type": "text/xml; charset=utf-8" },
  });
}

async function handle({ request }: { request: Request }) {
  const url = new URL(request.url);
  if (!tokenMatches(url.searchParams.get("t"))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const to = toE164(url.searchParams.get("to") ?? "");
  if (!to) return twimlResponse("<Say>No number to dial.</Say>");

  const callerId = url.searchParams.get("from");
  const dialAttrs = callerId ? ` callerId="${escapeXml(toE164(callerId))}"` : "";
  return twimlResponse(
    `<Say voice="alice">Connecting your call.</Say><Dial${dialAttrs} timeout="30">${escapeXml(to)}</Dial>`,
  );
}

export const Route = createFileRoute("/api/public/twilio/voice")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
    },
  },
});
