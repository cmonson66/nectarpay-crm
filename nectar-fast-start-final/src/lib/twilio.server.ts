/**
 * Twilio access through the Lovable connector gateway.
 * The gateway injects the Account SID + auth, so paths are relative to
 * /2010-04-01/Accounts/{AccountSid}.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

function gatewayHeaders(): Record<string, string> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const twilioKey = process.env["TWILIO_API_KEY"];
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!twilioKey) throw new Error("Twilio is not connected (TWILIO_API_KEY missing)");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": twilioKey,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

async function twilioPost(path: string, form: Record<string, string>) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: "POST",
    headers: gatewayHeaders(),
    body: new URLSearchParams(form),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Twilio request failed [${res.status}]: ${text}`);
    throw new Error(`Twilio request failed [${res.status}]: ${text}`);
  }
  return JSON.parse(text) as Record<string, unknown>;
}

/** The shared org number, stored in app_settings. */
export async function getFromNumber(): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "twilio_from_number")
    .maybeSingle();
  const value = (data?.value ?? "").trim();
  if (!value) {
    throw new Error(
      "No sending number configured. An admin can set it in Admin → Settings → Messaging.",
    );
  }
  return value;
}

export function publicBaseUrl(request?: Request): string {
  const explicit = process.env["PUBLIC_BASE_URL"];
  if (explicit) return explicit.replace(/\/+$/, "");
  if (request) return new URL(request.url).origin;
  return "https://crm.nectar-pay.com";
}

export function webhookToken(): string {
  return process.env["TWILIO_WEBHOOK_TOKEN"] ?? "";
}

/** Constant-time-ish comparison for the webhook query token. */
export function tokenMatches(candidate: string | null): boolean {
  const expected = webhookToken();
  if (!expected || !candidate || candidate.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ candidate.charCodeAt(i);
  return diff === 0;
}

export async function sendSms(opts: {
  to: string;
  from: string;
  body: string;
  statusCallback?: string;
}) {
  const form: Record<string, string> = { To: opts.to, From: opts.from, Body: opts.body };
  if (opts.statusCallback) form["StatusCallback"] = opts.statusCallback;
  const json = await twilioPost("/Messages.json", form);
  return { sid: String(json["sid"] ?? ""), status: String(json["status"] ?? "queued") };
}

/**
 * Bridged call: Twilio rings the rep first, then connects the lead.
 * `twimlUrl` must return TwiML that dials the lead.
 */
export async function createBridgedCall(opts: {
  repNumber: string;
  from: string;
  twimlUrl: string;
  statusCallback?: string;
}) {
  const form: Record<string, string> = {
    To: opts.repNumber,
    From: opts.from,
    Url: opts.twimlUrl,
  };
  if (opts.statusCallback) {
    form["StatusCallback"] = opts.statusCallback;
    form["StatusCallbackEvent"] = "completed";
  }
  const json = await twilioPost("/Calls.json", form);
  return { sid: String(json["sid"] ?? ""), status: String(json["status"] ?? "initiated") };
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Download a recording through the gateway (recordings require Twilio auth). */
export async function fetchRecording(recordingSid: string): Promise<ArrayBuffer> {
  const headers = gatewayHeaders();
  delete headers["Content-Type"];
  const res = await fetch(`${GATEWAY_URL}/Recordings/${recordingSid}.mp3`, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Recording fetch failed [${res.status}]: ${text}`);
  }
  return res.arrayBuffer();
}
