// Read-only conversion. Uses Bun; never opens a live NeDB datastore.
import { readdir } from "node:fs/promises";
import { resolve, join, basename } from "node:path";
import { parseLegacyFiles } from "../src/lib/legacy-import.js";

const [source, output] = Bun.argv.slice(2);
if (!source || !output) {
  console.error(
    "Usage: bun scripts/convert-legacy.mjs <legacy-data-directory> <new-export.json>",
  );
  process.exit(1);
}
const sourceDirectory = resolve(source);
const outputPath = resolve(output);
if (
  outputPath.toLowerCase().startsWith(sourceDirectory.toLowerCase() + "\\") ||
  outputPath.toLowerCase().startsWith(sourceDirectory.toLowerCase() + "/")
)
  throw new Error("Output must be outside the legacy data directory");
if (await Bun.file(outputPath).exists())
  throw new Error("Output already exists; choose a new filename");
const paths = (await readdir(sourceDirectory))
  .filter((name) => /^insomnia\..+\.db$/i.test(name))
  .map((name) => join(sourceDirectory, name));
if (!paths.length) throw new Error("No insomnia.*.db files found");
const files = await Promise.all(
  paths.map(async (path) => ({
    name: basename(path),
    text: await Bun.file(path).text(),
  })),
);
const exported = parseLegacyFiles(files);
await Bun.write(outputPath, JSON.stringify(exported, null, 2));
console.log(
  `Converted ${paths.length} files / ${exported.resources.length} current records to ${outputPath}. Source files unchanged. External response bodies, certificate files and proto files are not copied.`,
);
