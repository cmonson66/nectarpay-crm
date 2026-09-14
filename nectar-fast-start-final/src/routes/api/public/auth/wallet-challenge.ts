import { createFileRoute } from "@tanstack/react-router";
import { randomBytes } from "crypto";
import {
  authDomainFromRequest,
  buildDeepLink,
  buildWalletLoginEnvelope,
  buildSignableMessage,
  publicOriginFromRequest,
} from "@/lib/wallet-auth-shared";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export const Route = createFileRoute("/api/public/auth/wallet-challenge")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const nonce = randomBytes(24).toString("hex");
        const ua = request.headers.get("user-agent")?.slice(0, 256) ?? null;
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          null;

        const { data, error } = await supabaseAdmin
          .from("wallet_login_challenges")
          .insert({ nonce, ip_address: ip, user_agent: ua })
          .select("id, nonce, expires_at, created_at")
          .single();

        if (error || !data) {
          console.error("[wallet-challenge] insert failed:", error);
          return Response.json(
            { error: "Could not create challenge" },
            { status: 500, headers: CORS },
          );
        }

        const origin = publicOriginFromRequest(request);
        const domain = authDomainFromRequest(request);
        const message = buildSignableMessage({
          nonce: data.nonce,
          domain,
          issuedAt: data.created_at ?? new Date().toISOString(),
        });
        const deepLink = buildDeepLink({
          challengeId: data.id,
          nonce: data.nonce,
          origin,
          message,
        });
        const qrData = buildWalletLoginEnvelope({
          challengeId: data.id,
          nonce: data.nonce,
          origin,
          expiresAt: data.expires_at,
        });

        // Opportunistic cleanup of expired rows (cheap, fire-and-forget)
        void supabaseAdmin.rpc("purge_expired_wallet_challenges");

        return Response.json(
          {
            id: data.id,
            nonce: data.nonce,
            expires_at: data.expires_at,
            message,
            deep_link: deepLink,
            qr_data: qrData,
          },
          { headers: CORS },
        );
      },
    },
  },
});
