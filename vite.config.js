import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { codemirrorLintOwnership } from "./scripts/codemirror-lint-ownership.mjs";
import { viteStaticCopy } from "vite-plugin-static-copy";
const host = Bun.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [codemirrorLintOwnership(), sveltekit(), viteStaticCopy({
    targets: ["cmaps","standard_fonts","wasm","iccs"].map((directory) => ({
      src:`node_modules/pdfjs-dist/${directory}/*`,dest:`pdf-assets/${directory}`,rename:{stripBase:true},
    })),
  })],

  // iconv-lite uses the installed browser Buffer/StringDecoder implementations.
  resolve:{alias:[{find:/^buffer$/,replacement:"buffer/"},{find:/^string_decoder$/,replacement:"string_decoder/"}]},

  // The app is a pure SPA (ssr = false), so skip the SSR dependency optimizer.
  ssr: { optimizeDeps: { noDiscovery: true, include: [] } },

  // Pre-bundle every bare import (incl. lazy dynamic ones) up front so the dev
  // server does not discover them late and re-optimize/reload mid-session.
  optimizeDeps: {
    // Lazy editor imports must not invalidate dependencies already served.
    noDiscovery: true,
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
      "codemirror/mode/javascript/javascript.js",
      "codemirror/mode/xml/xml.js",
      "codemirror/mode/css/css.js",
      "codemirror/mode/htmlmixed/htmlmixed.js",
      "codemirror/mode/yaml/yaml.js",
      "codemirror/mode/markdown/markdown.js",
      "codemirror/addon/dialog/dialog.js",
      "codemirror/addon/search/searchcursor.js",
      "codemirror/addon/search/search.js",
      "codemirror/addon/fold/foldcode.js",
      "codemirror/addon/fold/foldgutter.js",
      "codemirror/addon/fold/brace-fold.js",
      "codemirror/addon/fold/xml-fold.js",
      "codemirror/addon/fold/indent-fold.js",
      "codemirror/addon/edit/matchbrackets.js",
      "codemirror/addon/edit/closebrackets.js",
      "codemirror/addon/comment/comment.js",
      "codemirror/addon/selection/active-line.js",
      "codemirror/addon/display/placeholder.js",
      "codemirror/addon/hint/show-hint.js",
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
      "buffer/",
      "iconv-lite",
      "string_decoder/",
      "papaparse",
      "pdfjs-dist",
      "quickjs-emscripten-core",
      "url",
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
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
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
      // Generated migration proofs are large and are not application sources.
      ignored: ["**/src-tauri/**", "**/_backup/**", "**/artifacts/**"],
    },
  },
}));
