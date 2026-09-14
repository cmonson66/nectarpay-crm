// SMS + calling server functions. All reads/writes run as the calling user so
// RLS scopes messages and calls to the leads the rep may see.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toE164 } from "@/lib/phone";

export interface LeadCommsSnapshot {
  messages: {
    id: string;
    direction: string;
    body: string;
    status: string;
    error: string | null;
    created_at: string;
    campaign_id: string | null;
  }[];
  calls: {
    id: string;
    direction: string;
    status: string;
    duration_seconds: number | null;
    recording_url: string | null;
    created_at: string;
  }[];
}

// ─── Settings ──────────────────────────────────────────────────────────

export const getMessagingSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["twilio_from_number"]);
    const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value ?? ""]));
    const { publicBaseUrl, webhookToken } = await import("@/lib/twilio.server");
    const base = publicBaseUrl();
    const t = webhookToken();
    return {
      fromNumber: map["twilio_from_number"] ?? "",
      webhooks: {
        inboundSms: `${base}/api/public/twilio/sms?t=${t}`,
        smsStatus: `${base}/api/public/twilio/sms-status?t=${t}`,
        callStatus: `${base}/api/public/twilio/call-status?t=${t}`,
        voiceApp: `${base}/api/public/twilio/voice-app?t=${t}`,

      },
    };
  });

export const saveMessagingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ fromNumber: z.string().trim().max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    const value = data.fromNumber ? toE164(data.fromNumber) : "";
    const { error } = await context.supabase
      .from("app_settings")
      .upsert(
        { key: "twilio_from_number", value, updated_at: new Date().toISOString(), updated_by: context.userId },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, value };
  });

// ─── Lead thread ───────────────────────────────────────────────────────

export const getLeadComms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ leadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<LeadCommsSnapshot> => {
    const [{ data: messages }, { data: calls }] = await Promise.all([
      context.supabase
        .from("messages")
        .select("id, direction, body, status, error, created_at, campaign_id")
        .eq("lead_id", data.leadId)
        .order("created_at", { ascending: true })
        .limit(500),
      context.supabase
        .from("calls")
        .select("id, direction, status, duration_seconds, recording_url, created_at")
        .eq("lead_id", data.leadId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    return { messages: messages ?? [], calls: calls ?? [] };
  });

export const sendLeadSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ leadId: z.string().uuid(), body: z.string().trim().min(1).max(1500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: lead, error } = await supabase
      .from("leads")
      .select("id, contact_phone_e164, status, sms_opted_out_at")
      .eq("id", data.leadId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!lead) throw new Error("Lead not found");
    if (!lead.contact_phone_e164) throw new Error("This lead has no phone number.");
    if (lead.sms_opted_out_at) throw new Error("This lead has opted out of text messages.");
    if (lead.status === "do_not_contact") throw new Error("This lead is marked do-not-contact.");

    const { getFromNumber, sendSms, publicBaseUrl, webhookToken } = await import(
      "@/lib/twilio.server"
    );
    const from = await getFromNumber();
    const to = lead.contact_phone_e164;

    const { data: row, error: insertErr } = await supabase
      .from("messages")
      .insert({
        lead_id: lead.id,
        direction: "outbound",
        body: data.body,
        from_number: from,
        to_number: to,
        status: "queued",
        sent_by: userId,
      })
      .select("id")
      .single();
    if (insertErr) throw new Error(insertErr.message);

    try {
      const result = await sendSms({
        to,
        from,
        body: data.body,
        statusCallback: `${publicBaseUrl()}/api/public/twilio/sms-status?t=${webhookToken()}`,
      });
      await supabase
        .from("messages")
        .update({ twilio_sid: result.sid, status: result.status })
        .eq("id", row.id);
    } catch (e) {
      await supabase
        .from("messages")
        .update({ status: "failed", error: (e as Error).message })
        .eq("id", row.id);
      throw e;
    }

    await supabase.from("activities").insert({
      lead_id: lead.id,
      rep_id: userId,
      type: "sms",
      direction: "outbound",
      notes: data.body.slice(0, 500),
      occurred_at: new Date().toISOString(),
    });

    return { ok: true };
  });

/** Twilio rings the rep's phone, then bridges to the lead from the shared number. */
export const startBridgedCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ leadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: lead }, { data: profile }] = await Promise.all([
      supabase
        .from("leads")
        .select("id, contact_phone_e164, status")
        .eq("id", data.leadId)
        .maybeSingle(),
      supabase.from("profiles").select("phone_e164").eq("user_id", userId).maybeSingle(),
    ]);
    if (!lead) throw new Error("Lead not found");
    if (!lead.contact_phone_e164) throw new Error("This lead has no phone number.");
    if (lead.status === "do_not_contact") throw new Error("This lead is marked do-not-contact.");
    const repNumber = profile?.phone_e164;
    if (!repNumber) {
      throw new Error("Add your own phone number in Settings before using bridged calling.");
    }

    const { getFromNumber, createBridgedCall, publicBaseUrl, webhookToken } = await import(
      "@/lib/twilio.server"
    );
    const from = await getFromNumber();
    const base = publicBaseUrl();
    const t = webhookToken();

    const { data: row, error: insertErr } = await supabase
      .from("calls")
      .insert({
        lead_id: lead.id,
        direction: "outbound",
        from_number: from,
        to_number: lead.contact_phone_e164,
        status: "initiated",
        rep_id: userId,
      })
      .select("id")
      .single();
    if (insertErr) throw new Error(insertErr.message);

    try {
      const result = await createBridgedCall({
        repNumber,
        from,
        twimlUrl: `${base}/api/public/twilio/voice?t=${t}&to=${encodeURIComponent(lead.contact_phone_e164)}&call=${row.id}`,
        statusCallback: `${base}/api/public/twilio/call-status?t=${t}&call=${row.id}`,
      });
      await supabase
        .from("calls")
        .update({ twilio_sid: result.sid, status: result.status })
        .eq("id", row.id);
    } catch (e) {
      await supabase.from("calls").update({ status: "failed" }).eq("id", row.id);
      throw e;
    }

    return { ok: true, repNumber };
  });

// ─── Campaigns ─────────────────────────────────────────────────────────

/** Leads the caller may text: visible, has a phone, consented, not opted out. */
export const getCampaignAudience = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("leads")
      .select("id, business_name, contact_name, contact_phone_e164, status, sms_consent, sms_opted_out_at, owner_rep_id")
      .not("contact_phone_e164", "is", null)
      .neq("status", "do_not_contact")
      .is("sms_opted_out_at", null)
      .eq("sms_consent", true)
      .order("business_name", { ascending: true })
      .limit(2000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("campaigns")
      .select("id, name, body, status, total_count, sent_count, failed_count, created_by, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/**
 * Creates a campaign and sends it. Personalization tokens: {business}, {contact}.
 * Every send appends the required opt-out line.
 */
export const sendCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        body: z.string().trim().min(1).max(1200),
        leadIds: z.array(z.string().uuid()).min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: adminRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRow) throw new Error("Only a super admin can send campaigns.");

    const { data: leads, error: leadErr } = await supabase
      .from("leads")
      .select("id, business_name, contact_name, contact_phone_e164, status, sms_consent, sms_opted_out_at")
      .in("id", data.leadIds);
    if (leadErr) throw new Error(leadErr.message);

    const eligible = (leads ?? []).filter(
      (l) =>
        l.contact_phone_e164 &&
        l.sms_consent &&
        !l.sms_opted_out_at &&
        l.status !== "do_not_contact",
    );
    if (eligible.length === 0) throw new Error("No eligible recipients in that selection.");

    const { data: campaign, error: campErr } = await supabase
      .from("campaigns")
      .insert({
        name: data.name,
        body: data.body,
        status: "sending",
        total_count: eligible.length,
        created_by: userId,
      })
      .select("id")
      .single();
    if (campErr) throw new Error(campErr.message);

    const { getFromNumber, sendSms, publicBaseUrl, webhookToken } = await import(
      "@/lib/twilio.server"
    );
    const from = await getFromNumber();
    const statusCallback = `${publicBaseUrl()}/api/public/twilio/sms-status?t=${webhookToken()}`;

    let sent = 0;
    let failed = 0;

    for (const lead of eligible) {
      const body =
        data.body
          .replaceAll("{business}", lead.business_name ?? "")
          .replaceAll("{contact}", lead.contact_name ?? "") + "\nReply STOP to opt out.";

      const { data: row } = await supabase
        .from("messages")
        .insert({
          lead_id: lead.id,
          direction: "outbound",
          body,
          from_number: from,
          to_number: lead.contact_phone_e164,
          status: "queued",
          sent_by: userId,
          campaign_id: campaign.id,
        })
        .select("id")
        .single();

      try {
        const result = await sendSms({
          to: lead.contact_phone_e164!,
          from,
          body,
          statusCallback,
        });
        sent += 1;
        if (row) {
          await supabase
            .from("messages")
            .update({ twilio_sid: result.sid, status: result.status })
            .eq("id", row.id);
        }
        await supabase.from("activities").insert({
          lead_id: lead.id,
          rep_id: userId,
          type: "sms",
          direction: "outbound",
          notes: `Campaign: ${data.name}`,
          occurred_at: new Date().toISOString(),
        });
      } catch (e) {
        failed += 1;
        if (row) {
          await supabase
            .from("messages")
            .update({ status: "failed", error: (e as Error).message })
            .eq("id", row.id);
        }
      }
      // Gentle pacing so we don't burst the carrier queue.
      await new Promise((r) => setTimeout(r, 120));
    }

    await supabase
      .from("campaigns")
      .update({ status: "sent", sent_count: sent, failed_count: failed })
      .eq("id", campaign.id);

    return { ok: true, sent, failed, skipped: (leads?.length ?? 0) - eligible.length };
  });

// ─── Browser softphone ─────────────────────────────────────────────────

/** Short-lived Voice SDK access token for the signed-in rep. */
export const getVoiceToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { mintVoiceToken, voiceIdentity } = await import("@/lib/twilio-token.server");
    const token = mintVoiceToken(context.userId, 3600);
    let fromNumber = "";
    try {
      const { getFromNumber } = await import("@/lib/twilio.server");
      fromNumber = await getFromNumber();
    } catch {
      fromNumber = "";
    }
    return {
      token,
      identity: voiceIdentity(context.userId),
      fromNumber,
      expiresInSeconds: 3600,
    };
  });

/** Resolve an inbound caller ID to a lead the rep can open. */
export const lookupLeadByPhone = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ phone: z.string().min(4).max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    const e164 = toE164(data.phone);
    if (!e164) return null;
    const { data: lead } = await context.supabase
      .from("leads")
      .select("id, business_name, contact_name, status")
      .eq("contact_phone_e164", e164)
      .order("last_activity_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    return lead ?? null;
  });

/** Recording audio as a data URL (Twilio recordings are auth-protected). */
export const getRecordingAudio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ callId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: call } = await context.supabase
      .from("calls")
      .select("recording_url")
      .eq("id", data.callId)
      .maybeSingle();
    const url = call?.recording_url;
    if (!url) throw new Error("No recording for this call.");
    const sid = /\/(RE[a-f0-9]+)(\.\w+)?$/i.exec(url)?.[1];
    if (!sid) throw new Error("Unrecognised recording reference.");

    const { fetchRecording } = await import("@/lib/twilio.server");
    const buf = await fetchRecording(sid);
    if (buf.byteLength > 8_000_000) throw new Error("Recording is too large to stream here.");
    return { dataUrl: `data:audio/mpeg;base64,${Buffer.from(buf).toString("base64")}` };
  });
