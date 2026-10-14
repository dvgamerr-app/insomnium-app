import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import {
  assertCrudNativePathBinding,
  assertCrudNativeDirectoryPolicy,
  assertCrudFailedFirstLaunchRecovery,
  assertCrudProfileRestartable,
  resourceCrudProbeIdentifier,
  assertCrudProfileOwnership,
  crudReconstructionProofPins,
  assertCrudReconstructionCandidate,
} from "./helpers/native-profile-ownership.js";
const folder = "C:\\Owned\\Roaming",
  profile = join(folder, resourceCrudProbeIdentifier),
  record = {
    state: "reserved",
    identifier: resourceCrudProbeIdentifier,
    initiallyAbsent: true,
    knownFolder: folder,
    profile,
    candidate: { exeSha256: "99f88" },
    launches: [],
  };
assert.doesNotThrow(() =>
  assertCrudNativePathBinding(record, 42, profile, folder),
);
assert.doesNotThrow(() => assertCrudNativeDirectoryPolicy(record, true));
assert.doesNotThrow(() =>
  assertCrudNativeDirectoryPolicy(
    { ...record, launches: [{ pid: 42 }] },
    false,
  ),
);
assert.throws(() =>
  assertCrudNativeDirectoryPolicy({ ...record, launches: [{ pid: 42 }] }, true),
);
for (const mutation of [
  { initiallyAbsent: false },
  { identifier: "app.insomnium.desktop" },
  { knownFolder: "C:\\Other" },
  { profile: profile + ".extra" },
  { candidate: null },
  { state: "owned" },
])
  assert.throws(() =>
    assertCrudNativePathBinding(
      { ...record, ...mutation },
      42,
      profile,
      folder,
    ),
  );
assert.throws(() =>
  assertCrudNativePathBinding(record, 42, profile + ".extra", folder),
);
assert.throws(() => assertCrudNativePathBinding(record, 0, profile, folder));
assert.throws(() =>
  assertCrudProfileRestartable({
    state: "owned",
    launches: [{ pid: 42, profileBinding: "native-path-first-absence" }],
  }),
);
assert.throws(() =>
  assertCrudProfileRestartable({
    state: "owned-exited",
    launches: [
      { pid: 42, observedExit: { observed: 1 }, profileBinding: "pending" },
    ],
  }),
);
const prelaunch = {
  passed: true,
  initiallyAbsent: true,
  identifier: record.identifier,
  profile,
  exeSha256: "99f88",
  sources: 752,
  assets: 51,
  consumed: {
    "tests/ui/helpers/native-profile-ownership.js":
      "15312e1964f8bbdbf6c989471c6f47d3c064bdf6a08f38d2a1a13bd430000ecc",
    "tests/ui/helpers/native-app.js":
      "b5a7d840221db88d8ef8347e3e9a506d6950678b2d60e4e0785a8dbece35e5ed",
  },
};
const inventory = [
    {
      name: ".window-state.json",
      bytes: 212,
      sha256:
        "afa8dbc1198f6677fb053f160a03b00e106a8f670b638df2431827886107752f",
      created: "2026-10-12T05:34:40.379Z",
      modified: "2026-10-12T05:34:40.379Z",
    },
  ],
  exit = { code: 0, signal: null };
const negative = {
  passedNegativeAudit: true,
  fullCrudAcceptance: false,
  nativeLastCollection: false,
  fixturesRegistered: [],
  liveHandles: [],
  hostPid: 55764,
  exit,
  inventory,
  profile,
  profileCreatedOnClose: true,
  markerState: "reserved",
  sourceFrozen: true,
};
const host = {
  status: "failed",
  expectedIdentifier: record.identifier,
  pid: 55764,
  exit,
  renderingMode: "native-hidden",
  hiddenWindow: { pid: 55764, visible: false },
  error:
    "Error: ENOENT: no such file or directory, lstat '" +
    profile +
    "'\n at async bindCrudProfileLaunch (native-profile-ownership.js:50:20)",
  startedAt: "2026-10-12T05:34:37.373Z",
  finishedAt: "2026-10-12T05:34:40.396Z",
};
assert.doesNotThrow(() =>
  assertCrudFailedFirstLaunchRecovery(
    record,
    prelaunch,
    negative,
    host,
    inventory,
  ),
);
for (const bad of [
  { ...host, pid: 12 },
  { ...host, expectedIdentifier: "foreign" },
  { ...host, exit: { code: 1, signal: null } },
  { ...host, error: "Unrelated failure" },
  { ...host, hiddenWindow: { pid: 55764, visible: true } },
])
  assert.throws(() =>
    assertCrudFailedFirstLaunchRecovery(
      record,
      prelaunch,
      negative,
      bad,
      inventory,
    ),
  );
assert.throws(() =>
  assertCrudFailedFirstLaunchRecovery(record, prelaunch, negative, host, [
    ...inventory,
    { name: "workspace-v1.json" },
  ]),
);
assert.throws(() =>
  assertCrudFailedFirstLaunchRecovery(
    record,
    prelaunch,
    { ...negative, liveHandles: [55764] },
    host,
    inventory,
  ),
);
assert.throws(() =>
  assertCrudFailedFirstLaunchRecovery(
    record,
    { ...prelaunch, initiallyAbsent: false },
    negative,
    host,
    inventory,
  ),
);
console.log(
  JSON.stringify({
    passed: true,
    checks: 23,
    nativeLaunched: false,
    profileMutated: false,
    scope:
      "First native path binding/absence versus missing retired profile, foreign/live/pending/recovery-extra-file/oldproof refusals",
  }),
);

// Reconstruction is new provenance, never fabricated old marker/initial absence.
const reconstructed = {
  schemaVersion: 2,
  identifier: resourceCrudProbeIdentifier,
  knownFolder: folder,
  profile,
  ownershipBasis: "reconstructed-root-acceptance",
  initiallyAbsent: false,
  initialAbsenceClaim: false,
  oldRawMarkerAvailable: false,
  state: "reconstructed-owned-exited",
  launches: [],
  proofPins: crudReconstructionProofPins(),
  historicalLaunchReceipt: {
    pid: 47904,
    exit: { code: 0, signal: null },
    renderingMode: "native-hidden",
    profile,
  },
  currentBaseline: {
    profile,
    immutable: {},
    buffers: {
      "workspace-v1.json": {
        sha256:
          "f0b51e39011ac5a8beb8d2e4a364ffe1362bbea52f7c0c06ba1f12afc9b072b9",
      },
      "workspace-v1.previous.json": {
        sha256:
          "d8b032c2f61cb71a69d2576d9b250d390ec3b3a149b6574cc74f48b79e4befc2",
      },
    },
  },
};
assert.doesNotThrow(() => assertCrudProfileOwnership(reconstructed));
assert.doesNotThrow(() => assertCrudProfileRestartable(reconstructed));
for (const change of [
  (/** @type {any} */ r) => (r.ownershipBasis = "invented"),
  (/** @type {any} */ r) => (r.initiallyAbsent = true),
  (/** @type {any} */ r) => (r.initialAbsenceClaim = true),
  (/** @type {any} */ r) => (r.oldRawMarkerAvailable = true),
  (/** @type {any} */ r) => (r.proofPins["audit.json"].sha256 = "0".repeat(64)),
  (/** @type {any} */ r) => (r.historicalLaunchReceipt.exit.code = 1),
  (/** @type {any} */ r) =>
    (r.currentBaseline.buffers["workspace-v1.json"].sha256 = "0".repeat(64)),
]) {
  const value = structuredClone(reconstructed);
  change(value);
  assert.throws(() => assertCrudProfileOwnership(value));
}
assert.throws(() => assertCrudNativeDirectoryPolicy(reconstructed, true));
const { createHash } = await import("node:crypto"),
  digest = (/** @type {Uint8Array} */ b) =>
    createHash("sha256").update(b).digest("hex"),
  artifact = resolve(
    "artifacts/native-resource-crud-audit-probe/current/insomnium-resource-crud-probe.exe",
  ),
  executable = Buffer.from(resourceCrudProbeIdentifier),
  capture = Buffer.from(
    JSON.stringify({
      identifier: resourceCrudProbeIdentifier,
      target: "x86_64-pc-windows-msvc",
      root: resolve("."),
      candidate: resolve(artifact, ".."),
    }),
  ),
  candidate = {
    identifier: resourceCrudProbeIdentifier,
    status: "finished",
    started: 1,
    finished: 2,
    result: { code: 0 },
    sourceClosureVerified: true,
    artifact,
    app: {
      path: artifact,
      sha256: digest(executable),
      bytes: executable.length,
    },
    beforeCargoSHA256: digest(capture),
  };
assert.doesNotThrow(() =>
  assertCrudReconstructionCandidate(candidate, executable, capture),
);
for (const changed of [
  { ...candidate, identifier: "foreign" },
  { ...candidate, sourceClosureVerified: false },
  { ...candidate, result: { code: 1 } },
  { ...candidate, beforeCargoSHA256: "0".repeat(64) },
])
  assert.throws(() =>
    assertCrudReconstructionCandidate(changed, executable, capture),
  );
assert.throws(() =>
  assertCrudReconstructionCandidate(candidate, Buffer.from("changed"), capture),
);
assert.throws(() =>
  assertCrudReconstructionCandidate(
    candidate,
    executable,
    Buffer.from("changed"),
  ),
);
console.log(
  JSON.stringify({
    passed: true,
    reconstructionChecks: 17,
    profileMutated: false,
    nativeLaunched: false,
    oldInitialAbsenceClaim: false,
  }),
);
