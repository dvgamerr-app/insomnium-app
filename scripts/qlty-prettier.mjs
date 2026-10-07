import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const [config, ...targets] = process.argv.slice(2);
if (!config || !targets.length)
  throw new Error("Expected Prettier config and staged targets.");
// Resolve before changing cwd: Qlty owns the temporary formatter copies.
const stagedTargets = targets.map((target) => resolve(target));
const child = Bun.spawn(
  [
    process.execPath,
    resolve(root, "node_modules/prettier/bin/prettier.cjs"),
    "--config",
    resolve(config),
    "--write",
    ...stagedTargets,
  ],
  { cwd: root, stdin: "inherit", stdout: "inherit", stderr: "inherit" },
);
process.exit(await child.exited);
