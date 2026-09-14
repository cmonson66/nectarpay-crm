// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { createRequire } from "node:module";
import path from "node:path";

// pdf-lib imports tslib's CJS build, which breaks ESM interop in the Worker
// runtime ("Cannot destructure property '__extends'"). Point at the ESM build
// by absolute path — the bare subpath is not exported by tslib's package.json.
const tslibEsm = path.join(path.dirname(createRequire(import.meta.url).resolve("tslib")), "tslib.es6.mjs");


// BUILD_ID: injected at build time so the running WebView bundle can compare
// itself against what the server is now shipping. Same value is exposed to
// server route handlers via process.env.LOVABLE_BUILD_ID.
const BUILD_ID = process.env.LOVABLE_BUILD_ID || String(Date.now());
process.env.LOVABLE_BUILD_ID = BUILD_ID;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: {
      __BUILD_ID__: JSON.stringify(BUILD_ID),
    },
    resolve: {
      alias: { tslib: tslibEsm },
    },

  },

});

