import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// Qlty sanitizes plugin environments and runs formatters in a temporary tree.
// Pass explicit Bun/formatter paths rather than relying on PATH or downloading JS.
const root = fileURLToPath(new URL("../", import.meta.url));
const qlty = Bun.which("qlty");
if (!qlty)
  throw new Error("Install the native Qlty CLI before running quality checks.");
const child = Bun.spawn([qlty, ...process.argv.slice(2)], {
  cwd: root,
  env: {
    ...process.env,
    QLTY_TELEMETRY: "off",
    INSOMNIUM_QLTY_BUN: process.execPath,
    INSOMNIUM_QLTY_FORMATTER: resolve(root, "scripts/qlty-prettier.mjs"),
  },
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});
process.exit(await child.exited);
