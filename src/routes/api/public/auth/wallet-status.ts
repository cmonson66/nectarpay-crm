import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export const Route = createFileRoute("/api/public/auth/wallet-status")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
          return Response.json({ error: "invalid id" }, { status: 400, headers: CORS });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const { data, error } = await supabaseAdmin
          .from("wallet_login_challenges")
          .select("status, one_time_token, expires_at, wallet_address")
          .eq("id", id)
          .single();

        if (error || !data) {
          return Response.json({ status: "unknown" }, { status: 404, headers: CORS });
        }

        if (new Date(data.expires_at).getTime() < Date.now() && data.status === "pending") {
          return Response.json({ status: "expired" }, { headers: CORS });
        }

        if (data.status === "signed") {
          return Response.json(
            {
              status: "signed",
              token: data.one_time_token,
              wallet_address: data.wallet_address,
            },
            { headers: CORS },
          );
        }

        return Response.json({ status: data.status }, { headers: CORS });
      },
    },
  },
});
