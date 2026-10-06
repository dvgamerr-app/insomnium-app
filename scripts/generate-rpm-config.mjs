import { resolve } from "node:path";

// Run after the native build, before Tauri's bundle command. The ELF determines
// architecture and symbol requirements; do not hardcode host-specific sonames.
const [binaryArgument, outputArgument, ...extra] = Bun.argv.slice(2);
if (
  process.platform !== "linux" ||
  !binaryArgument ||
  !outputArgument ||
  extra.length
) {
  throw new Error(
    "Usage (Linux): bun scripts/generate-rpm-config.mjs <built-ELF> <output.json>",
  );
}
const binary = resolve(binaryArgument);
const output = resolve(outputArgument);
if (binary === output)
  throw new Error("Output must differ from the executable");
const magic = new Uint8Array(await Bun.file(binary).slice(0, 4).arrayBuffer());
if (
  magic.length !== 4 ||
  magic[0] !== 0x7f ||
  magic[1] !== 69 ||
  magic[2] !== 76 ||
  magic[3] !== 70
) {
  throw new Error("The input must be a built Linux ELF executable");
}
const rpmdeps = Bun.which("rpmdeps") ?? "/usr/lib/rpm/rpmdeps";
const child = Bun.spawn([rpmdeps, "--requires", binary], {
  stdout: "pipe",
  stderr: "pipe",
});
const [stdout, stderr, code] = await Promise.all([
  new Response(child.stdout).text(),
  new Response(child.stderr).text(),
  child.exited,
]);
if (code !== 0)
  throw new Error("rpmdeps failed (" + code + "): " + stderr.trim());
const depends = [
  ...new Set(
    stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  ),
].sort();
if (!depends.length)
  throw new Error(
    "rpmdeps returned no requirements; refusing incomplete RPM metadata",
  );
await Bun.write(
  output,
  JSON.stringify({ bundle: { linux: { rpm: { depends } } } }, null, 2) + "\n",
);
console.log("Wrote " + depends.length + " ELF requirements to " + output);
