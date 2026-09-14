import { createFileRoute } from "@tanstack/react-router";
import { randomBytes } from "crypto";
import { z } from "zod";
import { authDomainFromRequest } from "@/lib/wallet-auth-shared";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

const deepLinkBodySchema = z.object({
  id: z.string().uuid(),
  address: z.string().min(26).max(64),
  signature: z.string().min(40).max(200),
  /** Optional: wallet may send the exact message it signed for audit. */
  message: z.string().max(2000).optional(),
});

const envelopeBodySchema = z.object({
  chain: z.string().min(1).max(32),
  address: z.string().min(26).max(64),
  signature: z.string().min(40).max(200),
  message: z.string().min(1).max(2000),
  nonce: z.string().min(16).max(128),
});

const bodySchema = z.union([deepLinkBodySchema, envelopeBodySchema]);

export const Route = createFileRoute("/api/public/auth/wallet-callback")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
          return Response.json({ error: "invalid id" }, { status: 400, headers: CORS });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: ch, error } = await supabaseAdmin
          .from("wallet_login_challenges")
          .select("id, nonce, status, expires_at, created_at")
          .eq("id", id)
          .single();
        if (error || !ch) {
          return Response.json({ error: "unknown challenge" }, { status: 404, headers: CORS });
        }
        const { buildSignableMessage } = await import("@/lib/wallet-auth-shared");
        const domain = authDomainFromRequest(request);
        const message = buildSignableMessage({
          nonce: ch.nonce,
          domain,
          issuedAt: ch.created_at,
        });
        return Response.json(
          {
            id: ch.id,
            nonce: ch.nonce,
            domain,
            issued_at: ch.created_at,
            expires_at: ch.expires_at,
            status: ch.status,
            message,
          },
          {
            headers: {
              ...CORS,
              "cache-control": "no-store",
            },
          },
        );
      },
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "invalid json" }, { status: 400, headers: CORS });
        }

        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "invalid payload", details: parsed.error.format() },
            { status: 400, headers: CORS },
          );
        }
        const payload = parsed.data;
        const address = payload.address.trim();
        const signature = payload.signature.replace(/\s+/g, "");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { buildSignableMessage, verifyTxcSignature, looksLikeTxcAddress } =
          await import("@/lib/wallet-signature.server");

        if (!looksLikeTxcAddress(address)) {
          return Response.json({ error: "invalid address" }, { status: 400, headers: CORS });
        }

        // Load and validate the challenge. Deep links identify by id; the
        // wallet's native QR-envelope flow posts back by nonce.
        let challengeQuery = supabaseAdmin
          .from("wallet_login_challenges")
          .select("id, nonce, status, expires_at, created_at");
        challengeQuery =
          "id" in payload
            ? challengeQuery.eq("id", payload.id)
            : challengeQuery.eq("nonce", payload.nonce).eq("status", "pending");

        const { data: ch, error: chErr } = await challengeQuery.single();

        if (chErr || !ch) {
          return Response.json({ error: "unknown challenge" }, { status: 404, headers: CORS });
        }
        if (ch.status !== "pending") {
          return Response.json({ error: "challenge already used" }, { status: 409, headers: CORS });
        }
        if (new Date(ch.expires_at).getTime() < Date.now()) {
          await supabaseAdmin
            .from("wallet_login_challenges")
            .update({ status: "expired" })
            .eq("id", ch.id);
          return Response.json({ error: "challenge expired" }, { status: 410, headers: CORS });
        }

        const message =
          "message" in payload && payload.message
            ? payload.message
            : buildSignableMessage({
                nonce: ch.nonce,
                domain: authDomainFromRequest(request),
                issuedAt: ch.created_at,
              });

        if (!message.includes(`Nonce: ${ch.nonce}`)) {
          return Response.json({ error: "nonce mismatch" }, { status: 400, headers: CORS });
        }

        const ok = verifyTxcSignature({ address, message, signature });
        if (!ok) {
          // Diagnostic: recover address-from-signature for both prefixes so we can compare.
          const { recoverAddressesFromSignature } = await import("@/lib/wallet-signature.server");
          let recovered: unknown = null;
          let recoveredAddress: string | null = null;
          try {
            const recoveredCandidates = recoverAddressesFromSignature({ message, signature });
            recovered = recoveredCandidates;
            recoveredAddress =
              recoveredCandidates.find((candidate) => candidate.prefix.includes("TEXITcoin"))
                ?.address ?? null;
          } catch (e) {
            recovered = `recover_failed: ${(e as Error).message}`;
          }
          console.error("[wallet-callback] bad signature", {
            address,
            messageLen: message.length,
            messagePreview: message.slice(0, 60),
            messageBytesHex: Buffer.from(message, "utf8").toString("hex").slice(0, 160),
            signaturePrefix: signature.slice(0, 10),
            recovered,
          });
          // Do NOT leak the recovered address back to the caller — it would
          // disclose third-party wallet ownership to anyone who can hit this
          // endpoint. The recovered address is already in server logs above.
          return Response.json({ error: "bad signature" }, { status: 401, headers: CORS });

        }

        const oneTimeToken = randomBytes(32).toString("hex");

        const { error: upErr } = await supabaseAdmin
          .from("wallet_login_challenges")
          .update({
            status: "signed",
            wallet_address: address,
            signature,
            one_time_token: oneTimeToken,
            signed_at: new Date().toISOString(),
          })
          .eq("id", ch.id)
          .eq("status", "pending"); // race guard

        if (upErr) {
          console.error("[wallet-callback] update failed:", upErr);
          return Response.json(
            { error: "could not record signature" },
            { status: 500, headers: CORS },
          );
        }

        return Response.json({ ok: true }, { headers: CORS });
      },
    },
  },
});
