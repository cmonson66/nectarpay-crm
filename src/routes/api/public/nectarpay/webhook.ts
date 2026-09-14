import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { normalizeNectarPayStatus, verifyNectarPaySignature } from "@/lib/nectarpay.server";

// Nectar.Pay webhook payload shape:
// {
//   id: "<uuid>",
//   type: "invoice.paid" | "invoice.underpaid",
//   created_at: "<iso>",
//   data: {
//     invoice_id: "<uuid>",
//     store_id: "<uuid>",
//     status: "confirmed" | "underpaid" | ...,
//     chain: "btc" | ...,
//     address: "<address>" | null,
//     fiat_amount: 499,
//     fiat_currency: "USD",
//     paid_amount_usd: 499,
//     order_id?: "<uuid>" | null,
//   },
// }
const webhookSchema = z.object({
  id: z.string().optional(),
  type: z.string().optional(),
  created_at: z.string().optional(),
  data: z
    .object({
      invoice_id: z.string().optional(),
      store_id: z.string().optional(),
      status: z.string().optional(),
      chain: z.string().optional(),
      address: z.string().nullable().optional(),
      fiat_amount: z.number().optional(),
      fiat_currency: z.string().optional(),
      paid_amount_usd: z.number().optional(),
      order_id: z.string().uuid().nullable().optional(),
    })
    .optional(),
});

export const Route = createFileRoute("/api/public/nectarpay/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signatureHeader = request.headers.get("x-txcpay-signature");
        if (!verifyNectarPaySignature(signatureHeader, rawBody)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const result = webhookSchema.safeParse(parsed);
        if (!result.success) return new Response("Invalid webhook payload", { status: 400 });

        const payload = result.data;
        const data = payload.data;
        const invoiceId = data?.invoice_id ?? payload.id;
        const orderId = data?.order_id ?? undefined;

        // Nectar.Pay emits two invoice events:
        //   - invoice.paid     → invoice status became "confirmed" (completed sale)
        //   - invoice.underpaid→ a payment arrived below the requested amount
        // invoice.confirmed exists in the type union but the watcher never emits it.
        const eventType =
          request.headers.get("x-txcpay-event") ?? payload.type ?? "invoice.paid";
        const isPaidEvent = eventType === "invoice.paid";
        const isUnderpaidEvent = eventType === "invoice.underpaid";

        const gatewayStatus = data?.status;
        const status = isPaidEvent
          ? "paid"
          : isUnderpaidEvent
            ? "underpaid"
            : normalizeNectarPayStatus(gatewayStatus ?? "pending");

        if (!invoiceId && !orderId) return new Response("Missing invoice reference", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let query = supabaseAdmin
          .from("deals")
          .select("id, lead_id, rep_id, device_id, status, nectarpay_invoice_id")
          .limit(1);
        if (orderId) query = query.eq("id", orderId);
        else query = query.eq("nectarpay_invoice_id", invoiceId as string);
        const { data: deal, error: lookupError } = await query.maybeSingle();
        if (lookupError) {
          console.error("[nectarpay] webhook lookup failed", lookupError.message);
          return new Response("Webhook processing failed", { status: 500 });
        }
        if (!deal) return new Response("ok");
        if (invoiceId && deal.nectarpay_invoice_id && deal.nectarpay_invoice_id !== invoiceId) {
          return new Response("Invoice mismatch", { status: 400 });
        }

        const now = new Date().toISOString();
        const { error: dealError } = await supabaseAdmin
          .from("deals")
          .update({
            nectarpay_status: status,
            ...(status === "paid"
              ? { status: "won", paid_at: now, closed_at: now }
              : {}),
          })
          .eq("id", deal.id);
        if (dealError) {
          console.error("[nectarpay] deal update failed", dealError.message);
          return new Response("Webhook processing failed", { status: 500 });
        }

        if (status === "paid") {
          await supabaseAdmin.from("leads").update({ status: "won" }).eq("id", deal.lead_id);
          if (deal.device_id) {
            // Terminal is sold and stays assigned to the customer that bought it.
            await supabaseAdmin
              .from("devices")
              .update({
                status: "sold",
                current_lead_id: deal.lead_id,
                assigned_rep_id: deal.rep_id,
              })
              .eq("id", deal.device_id);
          }
          // Issue the paid invoice PDF. Never fail the webhook over paperwork.
          try {
            const { generateDealDocument } = await import("@/lib/deal-documents.server");
            await generateDealDocument(supabaseAdmin, {
              dealId: deal.id,
              kind: "invoice",
              createdBy: deal.rep_id,
            });
          } catch (docError) {
            console.error("[documents] invoice generation failed", docError);
          }
        }
        return new Response("ok");
      },
    },
  },
});
