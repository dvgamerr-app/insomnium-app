import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
const host = Bun.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [sveltekit()],

  // The app is a pure SPA (ssr = false), so skip the SSR dependency optimizer.
  ssr: { optimizeDeps: { noDiscovery: true, include: [] } },

  // Pre-bundle every bare import (incl. lazy dynamic ones) up front so the dev
  // server does not discover them late and re-optimize/reload mid-session.
  optimizeDeps: {
    include: [
      "@jitl/quickjs-wasmfile-release-sync",
      "@noble/hashes/sha2.js",
      "@noble/hashes/legacy.js",
      "@noble/hashes/utils.js",
      "@scalar/openapi-parser",
      "@scalar/openapi-validator",
      "@tauri-apps/api/core",
      "@tauri-apps/api/window",
      "@tauri-apps/plugin-dialog",
      "@tauri-apps/plugin-fs",
      "@xmldom/xmldom",
      "codemirror",
      "codemirror/keymap/vim.js",
      "codemirror/keymap/sublime.js",
      "codemirror/keymap/emacs.js",
      "codemirror-graphql/mode.js",
      "codemirror-graphql/hint.js",
      "codemirror-graphql/lint.js",
      "codemirror-graphql/variables/mode.js",
      "codemirror-graphql/variables/hint.js",
      "codemirror-graphql/variables/lint.js",
      "codemirror-graphql/jump.js",
      "codemirror-graphql/info.js",
      "date-fns",
      "graphql",
      "jsonpath-plus",
      "openapi-sampler",
      "quickjs-emscripten-core",
      "url/url.js",
      "uuid",
      "xpath",
      "yaml",
    ],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || "127.0.0.1",
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**", "**/_backup/**"],
    },
  },
}));
