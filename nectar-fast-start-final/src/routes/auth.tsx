import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, Mail } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in · Nectar.Pay Sales CRM" },
      {
        name: "description",
        content:
          "Sign in to the Nectar.Pay sales CRM with Google or email.",
      },
          { property: "og:url", content: "https://nectar-pay.com/auth" },
],
    links: [{ rel: "canonical", href: "https://nectar-pay.com/auth" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"choose" | "email">("choose");

  // Already signed in → bounce (admins to /admin)
  useEffect(() => {
    if (authLoading || !user) return;
    if (user.user_metadata?.must_change_password) {
      navigate({ to: "/set-password" });
      return;
    }
    (async () => {
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      navigate({ to: resolvePostAuthPath(Boolean(adminRole), search.redirect) });
    })();
  }, [authLoading, user, navigate, search.redirect]);


  async function signInGoogle() {
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: typeof window !== "undefined" ? window.location.origin : undefined,
        extraParams: {
          prompt: "select_account",
        },
      });
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Google sign-in failed");
    }
  }



  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-16">
        <div className="rounded-xl border border-border bg-card/60 p-8">
          <div className="text-center">
            <p className="text-[0.7rem] uppercase tracking-[0.4em] text-muted-foreground">
              Welcome back
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              {mode === "choose" ? "Sign in to Nectar-PAY" : "Sign in with email"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Access is invite only — ask an admin to add you to the sales CRM.
            </p>
          </div>

          {mode === "choose" && (
            <ChooseMode
              onGoogle={() => void signInGoogle()}
              onEmail={() => setMode("email")}
            />
          )}

          {mode === "email" && (
            <EmailSignIn onBack={() => setMode("choose")} />
          )}

        </div>
      </div>
    </div>
  );
}

function resolvePostAuthPath(_isAdmin: boolean, redirect?: string) {
  // Sales-rep-only site: everyone lands in the admin CRM after sign-in.
  if (!redirect || redirect === "/" || redirect === "/dashboard") return "/crm";
  return redirect;
}

function ChooseMode({
  onGoogle,
  onEmail,
}: {
  onGoogle: () => void;
  onEmail: () => void;
}) {
  return (
    <div className="mt-8 space-y-3">
      <button
        type="button"
        onClick={onGoogle}
        className="flex h-14 w-full items-center justify-center gap-3 rounded-lg border border-input bg-card text-base font-medium transition hover:bg-accent"
      >
        <GoogleGlyph className="h-5 w-5" />
        Continue with Google
      </button>
      <button
        type="button"
        onClick={onEmail}
        className="flex h-14 w-full items-center justify-center gap-3 rounded-lg border border-input bg-card text-base font-medium transition hover:bg-accent"
      >
        <Mail className="h-5 w-5" />
        Continue with email
      </button>
      <p className="pt-2 text-center text-[11px] text-muted-foreground">
        Email + password, or Google. Accounts are created by an admin.
      </p>
    </div>
  );
}

function EmailSignIn({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function signIn() {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Enter a valid email");
      return;
    }
    if (!password) {
      toast.error("Enter your password");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (error) throw error;
      toast.success("Signed in!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Wrong email or password");
    } finally {
      setBusy(false);
    }
  }

  async function sendResetLink() {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Enter your email first");
      return;
    }
    setLinkBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/set-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the reset email");
    } finally {
      setLinkBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-8 space-y-4">
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 text-center">
          <Mail className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-3 text-base font-medium">Check your inbox</p>
          <p className="mt-1 text-xs text-muted-foreground">
            We sent a password reset link to{" "}
            <strong className="text-foreground">{email.trim()}</strong>.
          </p>
          <p className="mt-3 text-[11px] text-muted-foreground">
            No email? Ask your admin to reset your password — they can give you a new
            temporary one right away.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setPassword("");
          }}
          className="block w-full text-center text-xs text-muted-foreground underline"
        >
          ← Back to sign-in
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-3">
      <label className="block">
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Email
        </span>
        <input
          autoFocus
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@nectar-pay.com"
          className="mt-1 h-14 w-full rounded-lg border border-input bg-background px-4 text-lg"
        />
      </label>
      <label className="block">
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Password
        </span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void signIn();
          }}
          placeholder="••••••••"
          className="mt-1 h-14 w-full rounded-lg border border-input bg-background px-4 text-lg"
        />
      </label>
      <Button
        size="lg"
        onClick={() => void signIn()}
        disabled={busy || !email.trim() || !password}
        className="h-14 w-full text-base"
      >
        {busy ? "Signing in…" : "Sign in"} <ArrowRight className="ml-2 h-5 w-5" />
      </Button>
      <button
        type="button"
        onClick={() => void sendResetLink()}
        disabled={linkBusy}
        className="block w-full text-center text-xs text-muted-foreground underline"
      >
        {linkBusy ? "Sending…" : "Forgot password?"}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="block w-full text-center text-xs text-muted-foreground underline"
      >
        ← Back to sign-in options
      </button>
      <p className="pt-2 text-center text-[11px] text-muted-foreground">
        New here? Your admin gives you a temporary password — you&apos;ll pick your own after
        the first sign-in.
      </p>
    </div>
  );
}


function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.7 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2c-.4.4 6.7-4.9 6.7-14.8 0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
