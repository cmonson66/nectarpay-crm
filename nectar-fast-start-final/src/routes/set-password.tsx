import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/set-password")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
  },
  head: () => ({
    meta: [
      { title: "Choose a password · Nectar.Pay CRM" },
      {
        name: "description",
        content: "Set your own password to finish setting up your Nectar.Pay CRM account.",
      },
    ],
  }),
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const tooShort = pw.length > 0 && pw.length < 8;
  const mismatch = confirm.length > 0 && confirm !== pw;
  const valid = pw.length >= 8 && pw === confirm;

  async function save() {
    if (!valid) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: pw,
        data: { must_change_password: false },
      });
      if (error) throw error;
      toast.success("Password set — you're all set.");
      await navigate({ to: "/crm" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not set your password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-16">
        <div className="rounded-xl border border-border bg-card/60 p-8">
          <div className="text-center">
            <KeyRound className="mx-auto h-8 w-8 text-primary" />
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Choose a password</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You signed in with a temporary password. Pick your own to continue.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                New password
              </span>
              <Input
                autoFocus
                type="password"
                autoComplete="new-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className="mt-1 h-12"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Confirm password
              </span>
              <Input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void save();
                }}
                className="mt-1 h-12"
              />
            </label>
            {tooShort && (
              <p className="text-xs text-destructive">Use at least 8 characters.</p>
            )}
            {mismatch && <p className="text-xs text-destructive">Passwords don&apos;t match.</p>}
            <Button
              size="lg"
              disabled={!valid || busy}
              onClick={() => void save()}
              className="h-12 w-full text-base"
            >
              {busy ? "Saving…" : "Save password"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
