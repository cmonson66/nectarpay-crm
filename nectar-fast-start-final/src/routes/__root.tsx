import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "../lib/auth-context";
import { ThemeProvider, themeBootstrapScript } from "../lib/theme";
import { Toaster } from "../components/ui/sonner";
import { PwaInstallPrompt } from "../components/pwa-install-prompt";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0F172A" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Nectar.Pay" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "google-site-verification", content: "NDf4f7KhIuawD5rOq3HXdn7plw1sox07A5sUbeFQu6M" },
      { title: "NectarPay — Accept crypto. Keep every cent." },
      { property: "og:title", content: "NectarPay — Accept crypto. Keep every cent." },
      { name: "twitter:title", content: "NectarPay — Accept crypto. Keep every cent." },
      { name: "description", content: "The easiest, safest and smartest way to accept crypto payments. Zero fees, non-custodial, instant settlement. Set up in two minutes." },
      { property: "og:description", content: "The easiest, safest and smartest way to accept crypto payments. Zero fees, non-custodial, instant settlement. Set up in two minutes." },
      { name: "twitter:description", content: "The easiest, safest and smartest way to accept crypto payments. Zero fees, non-custodial, instant settlement. Set up in two minutes." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/96631aee-9d0f-4328-be76-69b4be3d3008/id-preview-426c3511--dd3c55ed-c279-4ad5-a91d-35bb00557f76.lovable.app-1784997594090.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/96631aee-9d0f-4328-be76-69b4be3d3008/id-preview-426c3511--dd3c55ed-c279-4ad5-a91d-35bb00557f76.lovable.app-1784997594090.png" },
    ],

    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://api.fontshare.com" },
      { rel: "preconnect", href: "https://app.nectar-pay.com" },
      { rel: "dns-prefetch", href: "https://app.nectar-pay.com" },

      { rel: "stylesheet", href: "https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&f[]=general-sans@400,500,600,700&display=swap" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],

    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://nectar-pay.com/#organization",
              name: "Nectar.Pay",
              url: "https://nectar-pay.com",
              description:
                "Non-custodial crypto payment gateway for merchants — Bitcoin, TEXITcoin and stablecoins with zero percentage fees.",
              telephone: "+1-855-663-2827",
            },
            {
              "@type": "WebSite",
              "@id": "https://nectar-pay.com/#website",
              name: "Nectar.Pay",
              url: "https://nectar-pay.com",
              publisher: { "@id": "https://nectar-pay.com/#organization" },
            },
          ],
        }),
      },
    ],
  }),


  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
          <PwaInstallPrompt />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

