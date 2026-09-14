import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { z } from "zod";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

const bodySchema = z.object({
  id: z.string().uuid(),
  token: z.string().length(64),
});

const SYNTHETIC_EMAIL_DOMAIN = "wallet.payhme.local";

function eqConstantTime(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return timingSafeEqual(A, B);
}

export const Route = createFileRoute("/api/public/auth/wallet-exchange")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "invalid json" }, { status: 400, headers: CORS });
        }
        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "invalid payload" }, { status: 400, headers: CORS });
        }
        const { id, token } = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: ch, error: chErr } = await supabaseAdmin
          .from("wallet_login_challenges")
          .select("id, status, one_time_token, wallet_address, expires_at")
          .eq("id", id)
          .single();

        if (chErr || !ch || !ch.one_time_token || !ch.wallet_address) {
          return Response.json({ error: "unknown" }, { status: 404, headers: CORS });
        }
        if (ch.status !== "signed") {
          return Response.json({ error: "not ready" }, { status: 409, headers: CORS });
        }
        if (new Date(ch.expires_at).getTime() < Date.now()) {
          return Response.json({ error: "expired" }, { status: 410, headers: CORS });
        }
        if (!eqConstantTime(ch.one_time_token, token)) {
          return Response.json({ error: "bad token" }, { status: 401, headers: CORS });
        }

        const address = ch.wallet_address;
        const lowerAddr = address.toLowerCase();
        const synthEmail = `${lowerAddr}@${SYNTHETIC_EMAIL_DOMAIN}`;

        // 1. Find or create the user
        let userId: string | null = null;
        const { data: existingWallet } = await supabaseAdmin
          .from("wallet_accounts")
          .select("user_id")
          .eq("wallet_address", address)
          .maybeSingle();

        if (existingWallet?.user_id) {
          userId = existingWallet.user_id;
        } else {
          const created = await supabaseAdmin.auth.admin.createUser({
            email: synthEmail,
            email_confirm: true,
            user_metadata: { wallet_address: address, chain: "TXC" },
          });
          if (created.error || !created.data.user) {
            console.error("[wallet-exchange] createUser failed:", created.error);
            return Response.json(
              { error: "could not create user" },
              { status: 500, headers: CORS },
            );
          }
          userId = created.data.user.id;
          await supabaseAdmin
            .from("wallet_accounts")
            .insert({ wallet_address: address, user_id: userId, chain: "TXC" });
        }

        // 2. Auto-promote admin if wallet is in env list
        const admins = (process.env.ADMIN_WALLETS ?? "")
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        const isConfiguredAdmin = admins.includes(lowerAddr);
        if (isConfiguredAdmin) {
          const { error: roleErr } = await supabaseAdmin
            .from("user_roles")
            .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
          if (roleErr) console.error("[wallet-exchange] admin role upsert failed:", roleErr);
        }

        const { data: adminRole } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();
        const isAdmin = isConfiguredAdmin || Boolean(adminRole);

        // 3. Update last_login + mark challenge consumed
        await Promise.all([
          supabaseAdmin
            .from("wallet_accounts")
            .update({ last_login_at: new Date().toISOString() })
            .eq("wallet_address", address),
          supabaseAdmin
            .from("wallet_login_challenges")
            .update({
              status: "consumed",
              one_time_token: null,
              consumed_at: new Date().toISOString(),
            })
            .eq("id", id),
        ]);

        // 4. Generate a magic link → client uses token_hash to verify and get a session
        const link = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: synthEmail,
        });
        if (link.error || !link.data?.properties) {
          console.error("[wallet-exchange] generateLink failed:", link.error);
          return Response.json(
            { error: "could not issue session" },
            { status: 500, headers: CORS },
          );
        }

        return Response.json(
          {
            email: synthEmail,
            token_hash: link.data.properties.hashed_token,
            wallet_address: address,
            is_admin: isAdmin,
          },
          { headers: CORS },
        );
      },
    },
  },
});
