import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { toE164 } from "@/lib/phone";

const payloadSchema = z.object({
  event: z.string().trim().max(80).optional(),
  event_id: z.string().trim().max(120).optional(),
  created_at: z.string().trim().max(60).optional(),
  lead: z.object({
    id: z.string().trim().max(120).optional(),
    name: z.string().trim().max(200).optional(),
    email: z.string().trim().max(320).optional(),
    phone: z.string().trim().max(60).optional(),
    telegram: z.string().trim().max(100).optional(),
    business: z.string().trim().max(200).optional(),
    market: z.string().trim().max(100).optional(),
    interest: z.string().trim().max(200).optional(),
    preferred_time: z.string().trim().max(200).optional(),
    message: z.string().trim().max(5000).optional(),
    source: z.string().trim().max(120).optional(),
  }),
});

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/leads/intake")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["LEAD_INTAKE_WEBHOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });

        const auth = request.headers.get("authorization") ?? "";
        const provided =
          request.headers.get("x-webhook-secret") ??
          (auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "");
        if (!provided || !safeEqual(provided, secret)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const parsed = payloadSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Invalid payload" }, { status: 400 });
        }
        const { lead, event, event_id } = parsed.data;
        if (event && event !== "lead.created") {
          return Response.json({ ok: true, ignored: event });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotency: the same external event or lead id should not create duplicates.
        const externalRef = event_id || lead.id || null;
        if (externalRef) {
          const { data: existing } = await supabaseAdmin
            .from("leads")
            .select("id")
            .eq("source", "web_intake")
            .ilike("admin_notes", `%intake-ref:${externalRef}%`)
            .maybeSingle();
          if (existing) return Response.json({ ok: true, lead_id: existing.id, duplicate: true });
        }

        const noteLines = [
          `Inbound website intake${event_id ? ` · intake-ref:${event_id}` : ""}`,
          lead.id && lead.id !== event_id ? `intake-ref:${lead.id}` : null,
          lead.interest ? `Interest: ${lead.interest}` : null,
          lead.preferred_time ? `Preferred time: ${lead.preferred_time}` : null,
          lead.telegram ? `Telegram: ${lead.telegram}` : null,
          lead.source ? `Form: ${lead.source}` : null,
        ].filter(Boolean);

        const { data: row, error } = await supabaseAdmin
          .from("leads")
          .insert({
            business_name: lead.business || lead.name || "Website intake",
            contact_name: lead.name || null,
            contact_email: lead.email || null,
            contact_phone_e164: toE164(lead.phone) || null,
            telegram: lead.telegram || null,
            market: lead.market || null,
            interest: lead.interest || null,
            preferred_time: lead.preferred_time || null,
            message: lead.message || null,
            admin_notes: noteLines.join("\n"),
            status: "new" as const,
            source: "web_intake" as const,
            owner_rep_id: null,
          })
          .select("id")
          .single();

        if (error) {
          console.error("[lead-intake] insert failed", error);
          return Response.json({ error: "Could not store lead" }, { status: 500 });
        }

        return Response.json({ ok: true, lead_id: row.id });
      },
    },
  },
});
