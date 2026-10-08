import assert from "node:assert/strict";
import { mkdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const output = resolve("artifacts/playwright/sse-bom");
await mkdir(output, { recursive: true });
const deps = resolve("src-tauri/target/release/deps");
const executable = join(output, "sse-bom.exe");
const args = [
  "--edition=2021",
  "-C",
  "panic=abort",
  "-C",
  "lto=yes",
  "--crate-name",
  "sse_bom_regression",
  resolve("tests/ui/fixtures/sse-bom.rs"),
  "-L",
  "dependency=" + deps,
  "-o",
  executable,
];
for (const name of ["eventsource_stream", "futures_util", "tokio"]) {
  const candidates = await Promise.all(
    (
      await Array.fromAsync(new Bun.Glob("lib" + name + "-*.rlib").scan(deps))
    ).map(async (file) => ({
      file,
      modified: (await stat(join(deps, file))).mtimeMs,
    })),
  );
  candidates.sort((a, b) => b.modified - a.modified);
  assert.ok(candidates.length, "Current release dependency required: " + name);
  args.push("--extern", name + "=" + join(deps, candidates[0].file));
}
const vc =
  "C:/Program Files (x86)/Microsoft Visual Studio/2017/BuildTools/VC/Tools/MSVC/14.16.27023";
const sdk = "C:/Program Files (x86)/Windows Kits/10";
const env = {
  ...process.env,
  CARGO_HOME: "D:/home/.cargo",
  RUSTUP_HOME: "D:/home/.rustup",
  PATH: vc + "/bin/Hostx64/x64;D:/home/.cargo/bin;" + process.env.PATH,
  LIB:
    vc +
    "/lib/x64;" +
    sdk +
    "/Lib/10.0.19041.0/ucrt/x64;" +
    sdk +
    "/Lib/10.0.19041.0/um/x64",
};
const compiler = Bun.spawnSync(["D:/home/.cargo/bin/rustc.exe", ...args], {
  env,
  windowsHide: true,
});
assert.equal(compiler.exitCode, 0, compiler.stderr.toString());
const result = Bun.spawnSync([executable], { windowsHide: true });
assert.equal(result.exitCode, 0, result.stderr.toString());
const evidence = JSON.parse(result.stdout.toString());
assert.equal(evidence.passed, true);
await Bun.write(join(output, "result.json"), JSON.stringify(evidence, null, 2));
console.log(evidence);
