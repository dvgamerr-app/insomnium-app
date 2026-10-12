import {elfInputs} from './linux-elf-inputs.mjs';
import {inspectElfClosure} from './linux-elf-closure.mjs';

// Run after the native build, before Tauri's bundle command. The ELF determines
// architecture and symbol requirements; do not hardcode host-specific sonames.
export async function main(args=Bun.argv.slice(2)){
const [binaryArgument, outputArgument, ...extra] = args;
if (
  process.platform !== "linux" ||
  !binaryArgument ||
  !outputArgument
) {
  throw new Error(
    "Usage (Linux): bun scripts/generate-rpm-config.mjs <built-ELF> <output.json> [sidecar-ELF...]",
  );
}
const {binaries,output}=await elfInputs(binaryArgument,outputArgument,extra);
await Bun.write(output+'.dependencies.json',JSON.stringify(await inspectElfClosure(binaries),null,2));
const rpmdeps = Bun.which("rpmdeps") ?? "/usr/lib/rpm/rpmdeps";
const child = Bun.spawn([rpmdeps, "--requires", ...binaries], {
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
}
if(import.meta.main)await main();
