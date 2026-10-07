import assert from "node:assert/strict";
import { mkdir, copyFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { buildComponentFixture } from "./helpers/component-fixture.js";
import { probeIdentifier } from "./helpers/native-app.js";

// Saved Windows native UI-fixture build. Only an isolated probe identity is used;
// production capabilities/CSP and application source remain unchanged.
const dir = "artifacts/native-recovery-copy-probe";
await mkdir(dir, { recursive: true });
const started = Date.now();
const statePath = join(dir, "build-state.json");
const state = {
  status: "running",
  started,
  identifier: probeIdentifier,
  artifact: join(dir, "insomnium-recovery-copy-probe.exe"),
};
await Bun.write(statePath, JSON.stringify(state, null, 2));
const asset = "build/__saved-recovery-fixture.js";
let fixtureHash;
let code = 1;
try {
  const frontend = Bun.spawn(["bun", "run", "build"], {
    stdout: Bun.file(join(dir, "frontend.log")),
    stderr: "inherit",
    windowsHide: true,
  });
  assert.equal(await frontend.exited, 0, "Frontend build failed");
  const { root } = await buildComponentFixture("git-recovery-native-copy");
  const bundle = await Bun.file(
    join(root, "git-recovery-native-copy.js"),
  ).text();
  fixtureHash = Bun.hash(bundle).toString();
  await Bun.write(asset, bundle);
  const msvc =
    "C:/Program Files (x86)/Microsoft Visual Studio/2017/BuildTools/VC/Tools/MSVC/14.16.27023";
  const sdk = "C:/Program Files (x86)/Windows Kits/10";
  const env = {
    ...process.env,
    CARGO_HOME: "D:/home/.cargo",
    RUSTUP_HOME: "D:/home/.rustup",
    PATH: `D:/home/.cargo/bin;${msvc}/bin/Hostx64/x64;${sdk}/bin/10.0.19041.0/x64;${process.env.PATH}`,
    INCLUDE: `${msvc}/include;${sdk}/Include/10.0.19041.0/ucrt;${sdk}/Include/10.0.19041.0/shared;${sdk}/Include/10.0.19041.0/um`,
    LIB: `${msvc}/lib/x64;${sdk}/Lib/10.0.19041.0/ucrt/x64;${sdk}/Lib/10.0.19041.0/um/x64`,
  };
  const native = Bun.spawn(
    [
      "bun",
      "x",
      "--bun",
      "tauri",
      "build",
      "--no-bundle",
      "--config",
      JSON.stringify({
        identifier: probeIdentifier,
        build: { beforeBuildCommand: null },
      }),
    ],
    {
      env,
      stdout: Bun.file(join(dir, "build.log")),
      stderr: Bun.file(join(dir, "build-error.log")),
      windowsHide: true,
    },
  );
  code = await native.exited;
  if (code === 0)
    await copyFile("src-tauri/target/release/insomnium.exe", state.artifact);
} finally {
  // Exact generated asset only; never recursively clean build/legacy trees.
  await rm(asset, { force: true });
  await Bun.write(
    statePath,
    JSON.stringify(
      {
        ...state,
        status: "finished",
        finished: Date.now(),
        fixtureHash,
        result: { code },
      },
      null,
      2,
    ),
  );
  process.exitCode = code;
}
