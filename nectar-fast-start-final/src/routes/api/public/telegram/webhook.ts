// Telegram bot webhook. Handles /start <bind_code> to link a chat_id to a user.
import { createFileRoute } from "@tanstack/react-router";
import { deriveTelegramWebhookSecret } from "@/lib/notify.server";
import { timingSafeEqual } from "crypto";

function safeEq(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

async function sendReply(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch(() => {});
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = deriveTelegramWebhookSecret();
        const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEq(got, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const update = (await request.json()) as {
          message?: {
            chat: { id: number; username?: string };
            text?: string;
          };
        };
        const msg = update.message;
        if (!msg?.text) return Response.json({ ok: true, ignored: true });

        const text = msg.text.trim();
        const chatId = msg.chat.id;
        const username = msg.chat.username ?? null;

        if (text.startsWith("/start")) {
          const code = text.slice(6).trim();
          if (!code) {
            await sendReply(
              chatId,
              "👋 Welcome to <b>TEXITcoin Pay</b>!\n\nTo link this chat to your account, go to <b>Notifications</b> in the dashboard, click <b>Connect Telegram</b>, and tap the link there — or send <code>/start &lt;your-code&gt;</code>.",
            );
            return Response.json({ ok: true });
          }
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: bind } = await supabaseAdmin
            .from("telegram_bind_codes")
            .select("*")
            .eq("code", code)
            .is("consumed_at", null)
            .gt("expires_at", new Date().toISOString())
            .maybeSingle();
          if (!bind) {
            await sendReply(chatId, "❌ That code is invalid or expired. Generate a new one in the dashboard.");
            return Response.json({ ok: true });
          }
          await supabaseAdmin
            .from("notification_prefs")
            .upsert(
              {
                user_id: bind.user_id,
                telegram_enabled: true,
                telegram_chat_id: String(chatId),
                telegram_username: username,
              },
              { onConflict: "user_id" },
            );
          await supabaseAdmin
            .from("telegram_bind_codes")
            .update({ consumed_at: new Date().toISOString() })
            .eq("code", code);
          await sendReply(
            chatId,
            "✅ <b>Linked!</b> You'll get instant alerts here for invoices, deposits, and billing events.",
          );
          return Response.json({ ok: true });
        }

        if (text === "/stop") {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin
            .from("notification_prefs")
            .update({ telegram_enabled: false })
            .eq("telegram_chat_id", String(chatId));
          await sendReply(chatId, "🔕 Telegram alerts disabled. Re-enable anytime from your dashboard.");
          return Response.json({ ok: true });
        }

        await sendReply(
          chatId,
          "Commands:\n<code>/start &lt;code&gt;</code> — link this chat\n<code>/stop</code> — disable alerts",
        );
        return Response.json({ ok: true });
      },
      GET: async () => Response.json({ ok: true, info: "telegram webhook" }),
    },
  },
});
