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
const lowMemory = process.env.INSOMNIUM_UI_LOW_MEMORY === "1";
const state = {
  status: "running",
  started,
  identifier: probeIdentifier,
  artifact: join(dir, "insomnium-recovery-copy-probe.exe"),
  compilerProfile: lowMemory
    ? "release with probe-only insomnium opt-level=1/codegen-units=16"
    : "production release profile",
};
await Bun.write(statePath, JSON.stringify(state, null, 2));
const asset = "build/__saved-recovery-fixture.js";
let fixtureHash;
let code = 1;
try {
  // A shorter new build must not leave a previous success line in the log.
  await Bun.write(join(dir, "frontend.log"), "");
  const frontend = Bun.spawn(["bun", "run", "build"], {
    stdout: Bun.file(join(dir, "frontend.log")),
    stderr: "inherit",
    windowsHide: true,
  });
  assert.equal(await frontend.exited, 0, "Frontend build failed");
  const { root } = await buildComponentFixture("git-recovery-native-copy", {
    minify: true,
  });
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
  await Bun.write(join(dir, "build.log"), "");
  await Bun.write(join(dir, "build-error.log"), "");
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
      ...(lowMemory
        ? [
            "--",
            "--config",
            "profile.release.package.insomnium.opt-level=1",
            "--config",
            "profile.release.package.insomnium.codegen-units=16",
          ]
        : []),
    ],
    {
      env,
      stdout: Bun.file(join(dir, "build.log")),
      stderr: Bun.file(join(dir, "build-error.log")),
      windowsHide: true,
    },
  );
  // Persist launcher identity and embedded input hash before waiting. If the
  // wrapper is interrupted, the next turn can audit its exact child ancestry.
  Object.assign(state, {
    nativePid: native.pid,
    fixtureHash,
    nativeStarted: Date.now(),
  });
  await Bun.write(statePath, JSON.stringify(state, null, 2));
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
