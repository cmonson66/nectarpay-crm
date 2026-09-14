/**
 * Twilio Voice Access Tokens for the in-browser softphone.
 * Hand-rolled HS256 JWT (Twilio's "twilio-fpa;v=1" flavour) so we don't need
 * the Node-only twilio SDK inside the Worker runtime.
 */
import { createHmac } from "crypto";

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

export function voiceIdentity(userId: string): string {
  return `rep_${userId}`;
}

export function userIdFromIdentity(identity: string | null | undefined): string | null {
  if (!identity) return null;
  return identity.startsWith("rep_") ? identity.slice(4) : null;
}

export function mintVoiceToken(userId: string, ttlSeconds = 3600): string {
  const accountSid = process.env["TWILIO_ACCOUNT_SID"];
  const keySid = process.env["TWILIO_API_KEY_SID"];
  const keySecret = process.env["TWILIO_API_KEY_SECRET"];
  const appSid = process.env["TWILIO_TWIML_APP_SID"];
  if (!accountSid || !keySid || !keySecret || !appSid) {
    throw new Error(
      "Browser calling is not configured yet (missing Twilio account, API key or TwiML app).",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const identity = voiceIdentity(userId);

  const header = { alg: "HS256", typ: "JWT", cty: "twilio-fpa;v=1" };
  const payload = {
    jti: `${keySid}-${now}`,
    iss: keySid,
    sub: accountSid,
    nbf: now,
    exp: now + ttlSeconds,
    grants: {
      identity,
      voice: {
        incoming: { allow: true },
        outgoing: { application_sid: appSid },
      },
    },
  };

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = createHmac("sha256", keySecret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}
