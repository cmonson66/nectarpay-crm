// Server functions for notification preferences + telegram bind flow.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { randomBytes } from "crypto";

export interface NotificationPrefs {
  email_enabled: boolean;
  email_address: string | null;
  telegram_enabled: boolean;
  telegram_chat_id: string | null;
  telegram_username: string | null;
  events: Record<string, boolean>;
}

export const getNotificationPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotificationPrefs> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("notification_prefs")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data) {
      // Default with the user's auth email pre-filled
      const { data: userRow } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      return {
        email_enabled: true,
        email_address: userRow?.user?.email ?? null,
        telegram_enabled: false,
        telegram_chat_id: null,
        telegram_username: null,
        events: {
          invoice_paid: true,
          invoice_underpaid: true,
          invoice_expired: true,
          deposit_received: true,
          plan_renewed: true,
          grace_warning: true,
        },
      };
    }
    return {
      email_enabled: data.email_enabled,
      email_address: data.email_address,
      telegram_enabled: data.telegram_enabled,
      telegram_chat_id: data.telegram_chat_id,
      telegram_username: data.telegram_username,
      events: (data.events as Record<string, boolean>) ?? {},
    };
  });

export const saveNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Partial<NotificationPrefs>) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("notification_prefs").upsert(
      {
        user_id: context.userId,
        email_enabled: data.email_enabled ?? true,
        email_address: data.email_address ?? null,
        telegram_enabled: data.telegram_enabled ?? false,
        events: data.events ?? {},
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
    return { ok: true };
  });

export const createTelegramBindCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = randomBytes(6).toString("base64url");
    const { error } = await supabaseAdmin
      .from("telegram_bind_codes")
      .insert({ code, user_id: context.userId });
    if (error) throw error;
    // The bot username should be exposed via env or settings; using env if present.
    const botUsername = (process.env.TELEGRAM_BOT_USERNAME || "TexitPayBot").replace(/^@+/, "");
    return {
      code,
      deepLink: `https://t.me/${botUsername}?start=${code}`,
      botUsername,
      expiresInMinutes: 15,
    };
  });

export const disconnectTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("notification_prefs")
      .update({ telegram_enabled: false, telegram_chat_id: null, telegram_username: null })
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const getNotificationLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("notification_log")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });
