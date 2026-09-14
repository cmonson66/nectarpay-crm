import { useEffect, useState, useCallback } from "react";
import { Download, Share, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const STORAGE_KEY = "pwa-install-prompt-dismissed";
const DISMISS_DAYS = 7;

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

function isIosSafari() {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isStandalone = "standalone" in window.navigator && (window.navigator as any).standalone === true;
  const isChrome = /CriOS/.test(ua);
  const isFirefox = /FxiOS/.test(ua);
  return isIos && !isStandalone && !isChrome && !isFirefox;
}

function isInstalled() {
  if (typeof window === "undefined") return false;
  if ("standalone" in window.navigator && (window.navigator as any).standalone === true) return true;
  return window.matchMedia("(display-mode: standalone)").matches;
}

function wasDismissedRecently() {
  if (typeof window === "undefined") return true;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (!Number.isFinite(dismissedAt)) return false;
  const ms = DISMISS_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - dismissedAt < ms;
}

export function PwaInstallPrompt() {
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isInstalled() || wasDismissedRecently()) return;
    setDismissed(false);
    setIsIos(isIosSafari());

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setDismissed(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    }
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDismissed(true);
      }
    } finally {
      setDeferredPrompt(null);
      setInstalling(false);
    }
  }, [deferredPrompt]);

  if (!mounted) return null;
  if (!isMobile) return null;
  if (dismissed) return null;
  if (isInstalled()) return null;

  const canPrompt = deferredPrompt !== null || isIos;
  if (!canPrompt) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card px-4 pb-[env(safe-area-inset-bottom,0px)] pt-3 shadow-lg",
        "animate-in slide-in-from-bottom-4 duration-300",
      )}
      role="dialog"
      aria-label="Install app"
    >
      <div className="mx-auto flex max-w-md flex-col gap-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-card-foreground">Add NectarPay to your home screen</p>
              <p className="text-xs text-muted-foreground">Get faster access and a full-screen app experience.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Dismiss install prompt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isIos ? (
          <div className="rounded-lg bg-inset p-3 text-xs text-secondary-foreground">
            <p className="flex items-center gap-1.5">
              Tap <Share className="inline h-3.5 w-3.5 text-primary" /> in the toolbar, then choose{" "}
              <strong className="text-foreground">Add to Home Screen</strong>.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleInstall}
            disabled={installing || !deferredPrompt}
            className={cn(
              "w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors",
              "hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {installing ? "Installing…" : "Install NectarPay"}
          </button>
        )}
      </div>
    </div>
  );
}
