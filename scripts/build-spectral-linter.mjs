import { resolve, dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";

const root = resolve(import.meta.dir, "..");
const packageRoot = resolve(root, "tools/spectral-linter");
const targets = {
  "x86_64-pc-windows-msvc": "bun-windows-x64",
  "x86_64-unknown-linux-gnu": "bun-linux-x64-baseline",
  "aarch64-unknown-linux-gnu": "bun-linux-arm64",
  "x86_64-apple-darwin": "bun-darwin-x64",
  "aarch64-apple-darwin": "bun-darwin-arm64",
};

async function command(argv, cwd) {
  const child = Bun.spawn(argv, { cwd, stdout: "inherit", stderr: "inherit" });
  const code = await child.exited;
  if (code !== 0) throw new Error("Spectral build step failed (" + code + ")");
}

let target = process.argv[2];
if (process.argv.length > 3) throw new Error("Expected one Rust target triple");
if (!target) {
  const rust = Bun.spawnSync(["rustc", "-vV"], { stdout: "pipe", stderr: "pipe" });
  if (rust.exitCode !== 0) throw new Error("Cannot determine native Rust target");
  target = Buffer.from(rust.stdout).toString().match(/^host: (.+)$/m)?.[1];
}
if (!target || !Object.hasOwn(targets, target)) throw new Error("Unsupported Spectral executable target");
await command(["bun", "install", "--frozen-lockfile", "--ignore-scripts"], packageRoot);
await command(["bun", "run", "bundle"], packageRoot);
const filename = "spectral-linter-" + target + (target.includes("windows") ? ".exe" : "");
const output = resolve(root, "src-tauri/binaries", filename);
await mkdir(dirname(output), { recursive: true });
await command([
  "bun", "build", resolve(packageRoot, "dist/host.js"),
  "--compile", "--target=" + targets[target], "--external", "fsevents",
  "--no-compile-autoload-dotenv", "--no-compile-autoload-bunfig",
  "--compile-exec-argv=--no-install",
  "--outfile", output,
], packageRoot);
const bytes = await Bun.file(output).bytes();
await Bun.write(output + ".manifest.json", JSON.stringify({
  target, bunTarget: targets[target], bunVersion: Bun.version,
  bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex"),
  lockSHA256: createHash("sha256").update(await Bun.file(resolve(packageRoot, "bun.lock")).bytes()).digest("hex"),
}, null, 2));
console.log("Spectral executable ready: " + filename);
