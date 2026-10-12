import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";

const output = resolve(import.meta.dir, "dist");
await mkdir(output, { recursive: true });
const bundled = await Bun.build({
  entrypoints: [resolve(import.meta.dir, "host.js")],
  target: "bun",
  format: "esm",
  outfile: resolve(output, "host.js"),
  external: ["fsevents"],
  plugins: [{
    name: "jsonc-parser-published-esm",
    setup(build) {
      build.onResolve({ filter: /^jsonc-parser$/ }, () => ({
        path: Bun.resolveSync("jsonc-parser/lib/esm/main.js", import.meta.dir),
      }));
    },
  }],
});
if (!bundled.success) throw new AggregateError(bundled.logs, "Spectral host bundle failed");
if (bundled.outputs.length !== 1) throw new Error("Unexpected Spectral host outputs");
await Bun.write(resolve(output, "host.js"), bundled.outputs[0]);
console.log("Spectral host bundle ready");
