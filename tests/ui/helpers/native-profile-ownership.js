import assert from "node:assert/strict";
import {
  lstat,
  realpath,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { createHash } from "node:crypto";

export const resourceCrudProbeIdentifier =
  "app.insomnium.probe.resourcecrud20261012";
const canonical = (/** @type {string} */ path) => resolve(path).toLowerCase();
export function knownWindowsApplicationData() {
  assert.equal(process.platform, "win32");
  const result = Bun.spawnSync(
    [
      "powershell",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "[Environment]::GetFolderPath('ApplicationData')",
    ],
    { windowsHide: true },
  );
  assert.equal(result.exitCode, 0);
  const folder = result.stdout.toString().trim();
  assert.ok(
    folder && resolve(folder) === folder,
    "Windows KnownFolder must be absolute",
  );
  return folder;
}
/** @param {string} path */
async function missing(path) {
  return lstat(path).then(
    () => false,
    (error) => {
      if (error.code === "ENOENT") return true;
      throw error;
    },
  );
}
/** @param {string} markerPath */
function validateMarkerPath(markerPath) {
  const path = resolve(markerPath);
  assert.ok(
    path.startsWith(resolve("artifacts") + sep),
    "Ownership proof must be in owned artifacts",
  );
  return path;
}
/** Create proof outside an absent profile; never create/delete app_data_dir.
 * @param {string} markerPath */
export async function prepareCrudProfileOwnership(markerPath) {
  const path = validateMarkerPath(markerPath);
  assert.equal(await missing(path), true, "Refuse to replace ownership proof");
  const knownFolder = knownWindowsApplicationData(),
    profile = join(knownFolder, resourceCrudProbeIdentifier);
  const info = await lstat(knownFolder);
  assert.ok(info.isDirectory() && !info.isSymbolicLink());
  assert.equal(canonical(await realpath(knownFolder)), canonical(knownFolder));
  assert.equal(
    await missing(profile),
    true,
    "Refuse existing unowned CRUD profile",
  );
  const record = {
    identifier: resourceCrudProbeIdentifier,
    knownFolder,
    profile,
    initiallyAbsent: true,
    prepared: Date.now(),
    state: "prepared",
    launches: /** @type {any[]} */ ([]),
  };
  await mkdir(resolve(path, ".."), { recursive: true });
  await Bun.write(path, JSON.stringify(record, null, 2));
  return record;
}
/** Bind the audited completed executable before a profile can be reserved.
 * @param {string} markerPath @param {string} buildStatePath @param {string} artifactPath */
export async function bindCrudProfileCandidate(
  markerPath,
  buildStatePath,
  artifactPath,
) {
  const path = validateMarkerPath(markerPath),
    record = await Bun.file(path).json();
  assert.equal(record.state, "prepared");
  const buildPath = validateMarkerPath(buildStatePath),
    artifact = validateMarkerPath(artifactPath),
    bytes = await Bun.file(artifact).bytes(),
    build = await Bun.file(buildPath).json();
  assert.equal(build.identifier, resourceCrudProbeIdentifier);
  assert.equal(build.status, "finished");
  assert.equal(build.result?.code, 0);
  assert.equal(canonical(build.artifact), canonical(artifact));
  assert.ok(
    Buffer.from(bytes).includes(Buffer.from(resourceCrudProbeIdentifier)),
  );
  record.candidate = {
    buildStatePath: buildPath,
    artifact,
    exeSha256: createHash("sha256").update(bytes).digest("hex"),
    buildStateSha256: createHash("sha256")
      .update(await Bun.file(buildPath).bytes())
      .digest("hex"),
  };
  await Bun.write(path, JSON.stringify(record, null, 2));
  return record;
}
/** @param {string} markerPath @param {string} buildStatePath @param {string} artifactPath */
export async function reserveCrudProfileLaunch(
  markerPath,
  buildStatePath,
  artifactPath,
) {
  const path = validateMarkerPath(markerPath),
    record = await Bun.file(path).json(),
    knownFolder = knownWindowsApplicationData();
  assert.equal(record.identifier, resourceCrudProbeIdentifier);
  assertCrudProfileOwnership(record);
  await verifyCrudReconstructedProofs(record);
  assert.equal(canonical(record.knownFolder), canonical(knownFolder));
  assert.equal(
    canonical(record.profile),
    canonical(join(knownFolder, resourceCrudProbeIdentifier)),
  );
  assert.ok(record.candidate, "Profile requires audited candidate binding");
  assert.equal(
    canonical(record.candidate.buildStatePath),
    canonical(buildStatePath),
  );
  assert.equal(canonical(record.candidate.artifact), canonical(artifactPath));
  assert.equal(
    createHash("sha256")
      .update(await Bun.file(buildStatePath).bytes())
      .digest("hex"),
    record.candidate.buildStateSha256,
    "Build record changed after profile binding",
  );
  assert.equal(
    createHash("sha256")
      .update(await Bun.file(artifactPath).bytes())
      .digest("hex"),
    record.candidate.exeSha256,
    "Executable changed after profile binding",
  );
  if (record.state === "prepared")
    assert.equal(
      await missing(record.profile),
      true,
      "Profile created before its first owned launch",
    );
  else {
    assertCrudProfileRestartable(record);
    const info = await lstat(record.profile);
    assert.ok(info.isDirectory() && !info.isSymbolicLink());
    assert.equal(
      canonical(await realpath(record.profile)),
      canonical(record.profile),
    );
  }
  if (record.ownershipBasis === "reconstructed-root-acceptance") {
    const baseline = await captureCrudReconstructionBaseline(record.profile);
    assert.deepEqual(baseline.buffers, record.currentBaseline.buffers);
    assert.deepEqual(baseline.immutable, record.currentBaseline.immutable);
    assert.deepEqual(baseline.topLevel, record.currentBaseline.topLevel);
  }
  record.state = "reserved";
  await Bun.write(path, JSON.stringify(record, null, 2));
  return record;
}
/** Bind actual native resolved path before the scenario may mutate its profile.
 * @param {string} markerPath @param {number} pid @param {string} nativePath */
export async function bindCrudProfileLaunch(markerPath, pid, nativePath) {
  const path = validateMarkerPath(markerPath),
    record = await Bun.file(path).json(),
    knownFolder = knownWindowsApplicationData();
  assertCrudNativePathBinding(record, pid, nativePath, knownFolder);
  await verifyCrudReconstructedProofs(record);
  const parent = await lstat(knownFolder);
  assert.ok(parent.isDirectory() && !parent.isSymbolicLink());
  assert.equal(canonical(await realpath(knownFolder)), canonical(knownFolder));
  const candidate = record.candidate;
  validateMarkerPath(candidate.buildStatePath);
  validateMarkerPath(candidate.artifact);
  assert.equal(
    createHash("sha256")
      .update(await Bun.file(candidate.buildStatePath).bytes())
      .digest("hex"),
    candidate.buildStateSha256,
  );
  const executable = await Bun.file(candidate.artifact).bytes();
  assert.equal(
    createHash("sha256").update(executable).digest("hex"),
    candidate.exeSha256,
  );
  const build = await Bun.file(candidate.buildStatePath).json();
  assert.equal(build.identifier, resourceCrudProbeIdentifier);
  assert.equal(build.status, "finished");
  assert.equal(build.result?.code, 0);
  assert.equal(canonical(build.artifact), canonical(candidate.artifact));
  assert.ok(
    Buffer.from(executable).includes(Buffer.from(resourceCrudProbeIdentifier)),
  );
  const absent = await missing(record.profile);
  assertCrudNativeDirectoryPolicy(record, absent);
  const row = {
    pid,
    nativePath,
    verified: Date.now(),
    directoryAbsentAtBind: absent,
    profileBinding: "pending",
  };
  // Persist the exact native-resolved owner before directory validation. The
  // path resolver need not create app_data_dir; the first UI Save will do so.
  record.state = "owned";
  record.launches.push(row);
  await Bun.write(path, JSON.stringify(record, null, 2));
  if (!absent) {
    const info = await lstat(record.profile);
    assert.ok(info.isDirectory() && !info.isSymbolicLink());
    assert.equal(
      canonical(await realpath(record.profile)),
      canonical(record.profile),
    );
  }
  row.profileBinding = absent
    ? "native-path-first-absence"
    : "native-path-directory";
  await Bun.write(path, JSON.stringify(record, null, 2));
  return record;
}
/** @param {any} record @param {number} pid @param {string} nativePath @param {string} knownFolder */
export function assertCrudNativePathBinding(
  record,
  pid,
  nativePath,
  knownFolder,
) {
  assert.equal(record.state, "reserved");
  assert.equal(record.identifier, resourceCrudProbeIdentifier);
  assertCrudProfileOwnership(record);
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  assert.ok(record.candidate);
  assert.ok(Array.isArray(record.launches));
  assert.equal(canonical(record.knownFolder), canonical(knownFolder));
  assert.equal(
    canonical(record.profile),
    canonical(join(knownFolder, resourceCrudProbeIdentifier)),
  );
  assert.equal(
    canonical(nativePath),
    canonical(record.profile),
    "Actual native app_data_dir must match approved KnownFolder profile",
  );
}
/** @param {any} record @param {boolean} absent */
export function assertCrudNativeDirectoryPolicy(record, absent) {
  assertCrudProfileOwnership(record);
  if (record.ownershipBasis === "reconstructed-root-acceptance")
    assert.equal(absent, false, "Reconstructed profile must already exist");
  assert.ok(
    !absent || record.launches.length === 0,
    "Only original first owned binding may precede profile creation",
  );
}
/** Readonly validation of the explicitly frozen, failed first-launch evidence.
 * The actual native path is inferred from the old bind's guarded ENOENT line,
 * not from an independently recorded native resolve_directory result.
 * @param {any} record @param {any} prelaunch @param {any} negative @param {any} host @param {any[]} inventory */
export function assertCrudFailedFirstLaunchRecovery(
  record,
  prelaunch,
  negative,
  host,
  inventory,
) {
  assert.equal(record.identifier, resourceCrudProbeIdentifier);
  assert.equal(record.initiallyAbsent, true);
  assert.equal(record.state, "reserved");
  assert.deepEqual(record.launches, []);
  assert.ok(record.candidate);
  assert.equal(prelaunch.passed, true);
  assert.equal(prelaunch.initiallyAbsent, true);
  assert.equal(prelaunch.identifier, record.identifier);
  assert.equal(canonical(prelaunch.profile), canonical(record.profile));
  assert.equal(prelaunch.exeSha256, record.candidate.exeSha256);
  assert.equal(prelaunch.sources, 752);
  assert.equal(prelaunch.assets, 51);
  assert.equal(
    prelaunch.consumed["tests/ui/helpers/native-profile-ownership.js"],
    "15312e1964f8bbdbf6c989471c6f47d3c064bdf6a08f38d2a1a13bd430000ecc",
  );
  assert.equal(
    prelaunch.consumed["tests/ui/helpers/native-app.js"],
    "b5a7d840221db88d8ef8347e3e9a506d6950678b2d60e4e0785a8dbece35e5ed",
  );
  assert.equal(negative.passedNegativeAudit, true);
  assert.equal(negative.fullCrudAcceptance, false);
  assert.equal(negative.nativeLastCollection, false);
  assert.deepEqual(negative.fixturesRegistered, []);
  assert.deepEqual(negative.liveHandles, []);
  assert.equal(canonical(negative.profile), canonical(record.profile));
  assert.equal(negative.profileCreatedOnClose, true);
  assert.equal(negative.markerState, "reserved");
  assert.equal(negative.sourceFrozen, true);
  assert.equal(host.status, "failed");
  assert.equal(host.expectedIdentifier, record.identifier);
  assert.equal(host.pid, negative.hostPid);
  assert.equal(host.exit.code, 0);
  assert.equal(host.exit.signal, null);
  assert.deepEqual(host.exit, negative.exit);
  assert.equal(host.renderingMode, "native-hidden");
  assert.equal(host.hiddenWindow.pid, host.pid);
  assert.equal(host.hiddenWindow.visible, false);
  assert.ok(
    host.error.startsWith(
      "Error: ENOENT: no such file or directory, lstat '" +
        record.profile +
        "'",
    ),
  );
  assert.ok(host.error.includes("at async bindCrudProfileLaunch "));
  assert.ok(host.error.includes("native-profile-ownership.js:50:20"));
  assert.equal(inventory.length, 1);
  assert.deepEqual(inventory, negative.inventory);
  const file = inventory[0];
  assert.equal(file.name, ".window-state.json");
  assert.equal(file.bytes, 212);
  assert.equal(
    file.sha256,
    "afa8dbc1198f6677fb053f160a03b00e106a8f670b638df2431827886107752f",
  );
  const start = Date.parse(host.startedAt),
    end = Date.parse(host.finishedAt);
  assert.ok(Number.isFinite(start) && Number.isFinite(end) && end >= start);
  for (const time of [file.created, file.modified])
    assert.ok(Date.parse(time) >= start && Date.parse(time) <= end);
}
/** A live/bound host is never enough proof that its profile can be reused.
 * @param {any} record */
export function assertCrudProfileRestartable(record) {
  if (record.state === "reconstructed-owned-exited") {
    assertCrudProfileOwnership(record);
    assert.deepEqual(record.launches, []);
    assert.equal(record.historicalLaunchReceipt.pid, 47904);
    assert.equal(record.historicalLaunchReceipt.exit.code, 0);
    return;
  }
  assert.equal(
    record.state,
    "owned-exited",
    "Only observed exited owned host can restart",
  );
  assert.ok(Array.isArray(record.launches) && record.launches.length);
  const last = record.launches.at(-1);
  assert.ok(
    last.observedExit && Number.isFinite(last.observedExit.observed),
    "Owned host exit must be recorded",
  );
  assert.ok(
    [
      "native-path-first-absence",
      "native-path-directory",
      "recovered-failed-first-launch",
    ].includes(last.profileBinding),
    "Exact original native path binding required for restart",
  );
}
/** Called only after withNativeApp observes this exact spawned child's exit.
 * @param {string} markerPath @param {number} pid @param {{code?:number|null,signal?:string|null,error?:string}} exit */
export async function recordCrudProfileExit(markerPath, pid, exit) {
  const path = validateMarkerPath(markerPath),
    record = await Bun.file(path).json();
  if (record.state === "reserved") return; // Failed before native path ownership was established.
  assert.equal(record.state, "owned");
  const last = record.launches.at(-1);
  assert.equal(last?.pid, pid, "Exit must belong to the exact owned host");
  assert.ok(
    !exit.error &&
      (typeof exit.code === "number" || typeof exit.signal === "string"),
    "Actual child exit required",
  );
  last.observedExit = { ...exit, observed: Date.now() };
  record.state = "owned-exited";
  await Bun.write(path, JSON.stringify(record, null, 2));
  return record;
}

/** @type {Readonly<Record<string,string>>} */
const crudProofHashes = Object.freeze({
  "prelaunch.json":
    "768b0437ed5ca7b6537fb7fd8641318d17211434ae25dc07e6536f5c9179f868",
  "audit.json":
    "c7c310507089a514d6def57c2ee83c6e4b30cd23ca940ac706c6715e89115d7b",
  "agent-audit.json":
    "85bd06c4b455cbede7f54e48a8c989edc41e162e0018ab80f5856bf70e43975c",
  "acceptance-supplement.json":
    "4eb862afa969631ecabd503e50145ddb8c3bc3d917be5a8a844a8788c2658a31",
  "native/result.json":
    "44e67e061e32cb13cd1d721af762fb81caea0d38ec9f15b137a71f3e10e8c97d",
  "native/cold-last-collection.json":
    "67118b5f7757aa21625164b360e5af30de63b321e7177797b369cf27a0f1ec05",
  "restoration/before.json":
    "ad4fb0051959937f1c906da44830b7bbafb09c8c1c6d5cb8ea333831773133cb",
  "restoration/result.json":
    "211f10c533116bc695d185396c87d54464a6521617455fcca26dc8b5eebf79df",
  "restoration/original-workspace-v1.json":
    "f0b51e39011ac5a8beb8d2e4a364ffe1362bbea52f7c0c06ba1f12afc9b072b9",
  "restoration/original-workspace-v1.previous.json":
    "d8b032c2f61cb71a69d2576d9b250d390ec3b3a149b6574cc74f48b79e4befc2",
});
const crudHash = (/** @type {Uint8Array} */ bytes) =>
  createHash("sha256").update(bytes).digest("hex");
/** Closed historical evidence set; descriptors never authorize arbitrary files. */
export function crudReconstructionProofPins() {
  return Object.fromEntries(
    Object.entries(crudProofHashes).map(([name, sha256]) => [
      name,
      { path: resolve("artifacts/native-crud-root-proof", name), sha256 },
    ]),
  );
}
/** Pure marker admission. Reconstruction is explicitly NOT initial-absence proof.
 * Raw files are independently repinned by the async reservation path.
 * @param {any} record */
export function assertCrudProfileOwnership(record) {
  if (record.ownershipBasis !== "reconstructed-root-acceptance") {
    assert.equal(record.ownershipBasis, undefined, "Unknown ownership basis");
    assert.equal(record.initiallyAbsent, true);
    return;
  }
  assert.equal(record.schemaVersion, 2);
  assert.equal(record.identifier, resourceCrudProbeIdentifier);
  assert.equal(record.initiallyAbsent, false);
  assert.equal(record.initialAbsenceClaim, false);
  assert.equal(record.oldRawMarkerAvailable, false);
  assert.deepEqual(record.proofPins, crudReconstructionProofPins());
  assert.equal(record.historicalLaunchReceipt.pid, 47904);
  assert.deepEqual(record.historicalLaunchReceipt.exit, {
    code: 0,
    signal: null,
  });
  assert.equal(record.historicalLaunchReceipt.renderingMode, "native-hidden");
  assert.equal(
    canonical(record.historicalLaunchReceipt.profile),
    canonical(record.profile),
  );
  assert.equal(record.currentBaseline.profile, record.profile);
  assert.deepEqual(record.currentBaseline.immutable, {});
  assert.equal(
    record.currentBaseline.buffers["workspace-v1.json"].sha256,
    crudProofHashes["restoration/original-workspace-v1.json"],
  );
  assert.equal(
    record.currentBaseline.buffers["workspace-v1.previous.json"].sha256,
    crudProofHashes["restoration/original-workspace-v1.previous.json"],
  );
}
/** Ordinary canonical files only; ancestors cannot redirect marker/evidence reads.
 * @param {string} path */
async function crudOrdinary(path) {
  const full = resolve(path);
  for (let at = full; ; at = resolve(at, "..")) {
    assert.ok(!(await lstat(at)).isSymbolicLink());
    if (resolve(at, "..") === at) break;
  }
  assert.equal(canonical(await realpath(full)), canonical(full));
  return lstat(full);
}
/** @param {string} path */
async function crudBytes(path) {
  assert.ok((await crudOrdinary(path)).isFile());
  return readFile(path);
}
/** Validate all mandatory preserved raw acceptance artifacts, without relying on
 * a reconstructed marker's self-reported acceptance.
 * @param {any} record */
export async function verifyCrudReconstructedProofs(record) {
  if (record.ownershipBasis !== "reconstructed-root-acceptance") return;
  assertCrudProfileOwnership(record);
  const proofs = /** @type {Record<string,any>} */ ({});
  for (const [name, pin] of Object.entries(crudReconstructionProofPins())) {
    const bytes = await crudBytes(pin.path);
    assert.equal(
      crudHash(bytes),
      pin.sha256,
      "Changed raw CRUD ownership evidence",
    );
    proofs[name] = JSON.parse(bytes.toString());
  }
  const audit = proofs["audit.json"],
    agent = proofs["agent-audit.json"],
    host = proofs["native/result.json"],
    before = proofs["restoration/before.json"],
    after = proofs["restoration/result.json"];
  assert.equal(audit.passed, true);
  assert.equal(audit.nativePid, 47904);
  assert.equal(audit.nativeExit, 0);
  assert.equal(audit.matrixRows.length, 6);
  assert.equal(agent.passed, true);
  assert.equal(agent.profileOwnedExited, true);
  assert.equal(agent.hostPid, 47904);
  assert.equal(agent.hostExit, 0);
  assert.equal(canonical(agent.profilePathRecorded), canonical(record.profile));
  assert.deepEqual(agent.liveHandles, []);
  assert.equal(host.status, "passed");
  assert.equal(host.pid, 47904);
  assert.equal(host.expectedIdentifier, resourceCrudProbeIdentifier);
  assert.deepEqual(host.exit, record.historicalLaunchReceipt.exit);
  assert.equal(host.hiddenWindow.pid, 47904);
  assert.equal(host.hiddenWindow.visible, false);
  assert.equal(host.renderingMode, "native-hidden");
  const cold = proofs["native/cold-last-collection.json"];
  assert.deepEqual(cold, {
    passed: true,
    collections: 1,
    deleteDisabled: true,
    title: "Keep at least one collection",
    keyboard: "Tab skips disabled Delete",
    beforeFixtures: true,
  });
  assert.equal(
    proofs["prelaunch.json"].exeSha256,
    "99f88b1c1af5175f9506ceca3fc6805038d945576aaa31906aea1ac85ca27307",
  );
  assert.equal(
    proofs["acceptance-supplement.json"].rootAuditSha256,
    crudProofHashes["audit.json"],
  );
  assert.equal(after.passed, true);
  assert.deepEqual(after.errors, []);
  assert.equal(before.identifier, resourceCrudProbeIdentifier);
  assert.equal(canonical(before.root), canonical(record.profile));
  assert.equal(canonical(after.root), canonical(record.profile));
  assert.deepEqual(before.buffers, after.buffers);
  assert.deepEqual(before.immutable, {});
  assert.deepEqual(after.immutable, {});
  for (const row of before.buffers)
    assert.equal(
      row.sha256,
      crudProofHashes["restoration/original-" + row.name],
    );
}
/** Capture only the exact currently owned CRUD file set, retaining window state
 * separately as host-mutable bytes, not a claim about WebView immutability.
 * @param {string} profile */
async function captureCrudReconstructionBaseline(profile) {
  assert.ok((await crudOrdinary(profile)).isDirectory());
  const names = (await readdir(profile)).sort();
  assert.deepEqual(names, [
    ".window-state.json",
    "cookies",
    "workspace-v1.json",
    "workspace-v1.previous.json",
  ]);
  const buffers =
    /** @type {Record<string,{sha256:string,bytes:number}>} */ ({});
  for (const name of ["workspace-v1.json", "workspace-v1.previous.json"]) {
    const bytes = await crudBytes(join(profile, name));
    assert.equal(
      crudHash(bytes),
      crudProofHashes["restoration/original-" + name],
    );
    buffers[name] = { sha256: crudHash(bytes), bytes: bytes.length };
  }
  assert.ok((await crudOrdinary(join(profile, "cookies"))).isDirectory());
  assert.deepEqual(await readdir(join(profile, "cookies")), []);
  const window = await crudBytes(join(profile, ".window-state.json"));
  assert.equal(window.length, 212);
  JSON.parse(window.toString());
  const data = JSON.parse(
    (await crudBytes(join(profile, "workspace-v1.json"))).toString(),
  );
  assert.equal(data.resources.length, 4);
  assert.equal(data.history.length, 0);
  assert.equal(
    data.resources.filter((/** @type {any} */ row) => row._type === "workspace")
      .length,
    1,
  );
  assert.equal(
    data.resources.find((/** @type {any} */ row) => row._type === "workspace")
      .name,
    "My Collection",
  );
  return {
    profile,
    buffers,
    immutable: {},
    topLevel: names,
    windowState: {
      sha256: crudHash(window),
      bytes: window.length,
      hostMutable: true,
    },
    webViewImmutableClaim: false,
  };
}
/** Fresh build admission remains independent of historical profile provenance.
 * @param {any} build @param {Uint8Array} executable @param {Uint8Array} beforeCargo */
export function assertCrudReconstructionCandidate(
  build,
  executable,
  beforeCargo,
) {
  assert.equal(build.identifier, resourceCrudProbeIdentifier);
  assert.equal(build.status, "finished");
  assert.equal(build.result?.code, 0);
  assert.equal(build.sourceClosureVerified, true);
  assert.ok(
    Buffer.from(executable).includes(Buffer.from(resourceCrudProbeIdentifier)),
  );
  assert.match(build.beforeCargoSHA256, /^[a-f0-9]{64}$/);
  assert.equal(crudHash(beforeCargo), build.beforeCargoSHA256);
  const ledger = JSON.parse(Buffer.from(beforeCargo).toString());
  assert.equal(ledger.identifier, resourceCrudProbeIdentifier);
  assert.equal(ledger.target, "x86_64-pc-windows-msvc");
  assert.equal(canonical(ledger.root), canonical(resolve(".")));
  assert.equal(
    canonical(ledger.candidate),
    canonical(resolve(build.artifact, "..")),
  );
  assert.ok(
    canonical(build.artifact).startsWith(
      canonical(resolve("artifacts/native-resource-crud-audit-probe")) + sep,
    ),
  );
  assert.ok(
    Number.isFinite(build.started) &&
      Number.isFinite(build.finished) &&
      build.finished >= build.started,
  );
  assert.equal(crudHash(executable), build.app.sha256);
  assert.equal(executable.length, build.app.bytes);
  assert.equal(canonical(build.artifact), canonical(build.app.path));
}
/** Create a NEW provenance record for an existing reviewed profile. Does not
 * recreate the missing old marker, claim initial absence, mutate the profile,
 * launch a UI, or relabel a historical binary.
 * @param {string} markerPath @param {string} buildStatePath */
export async function prepareCrudProfileReconstruction(
  markerPath,
  buildStatePath,
) {
  const hostQuery =
    "@((Get-CimInstance Win32_Process)|Where-Object {$_.Name -match '^insomnium.*\\.exe$'}).Count";
  const noHosts = Bun.spawnSync(
    ["powershell", "-NoProfile", "-NonInteractive", "-Command", hostQuery],
    { windowsHide: true, timeout: 5000, maxBuffer: 4096 },
  );
  assert.equal(noHosts.exitCode, 0);
  assert.equal(noHosts.success, true);
  assert.ok(noHosts.signalCode == null && !noHosts.exitedDueToTimeout);
  assert.equal(
    noHosts.stdout.toString().trim(),
    "0",
    "No native hosts permitted before reconstruction reads",
  );
  const path = validateMarkerPath(markerPath);
  assert.equal(await missing(path), true, "New reconstruction marker only");
  const knownFolder = knownWindowsApplicationData(),
    profile = join(knownFolder, resourceCrudProbeIdentifier);
  const buildPath = validateMarkerPath(buildStatePath),
    buildBytes = await crudBytes(buildPath),
    build = JSON.parse(buildBytes.toString()),
    artifact = validateMarkerPath(build.artifact),
    executable = await crudBytes(artifact),
    beforeCargo = await crudBytes(
      join(resolve(artifact, ".."), "before-cargo.json"),
    );
  assertCrudReconstructionCandidate(build, executable, beforeCargo);
  assert.ok((await lstat(artifact)).mtimeMs >= build.started);
  const record = /** @type {any} */ ({
    schemaVersion: 2,
    identifier: resourceCrudProbeIdentifier,
    knownFolder,
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
      source: "pinned-root-acceptance",
    },
    currentBaseline: {
      profile,
      immutable: {},
      buffers: {
        "workspace-v1.json": {
          sha256: crudProofHashes["restoration/original-workspace-v1.json"],
        },
        "workspace-v1.previous.json": {
          sha256:
            crudProofHashes["restoration/original-workspace-v1.previous.json"],
        },
      },
    },
  });
  await verifyCrudReconstructedProofs(record);
  record.currentBaseline = await captureCrudReconstructionBaseline(profile);
  record.candidate = {
    buildStatePath: buildPath,
    artifact,
    exeSha256: crudHash(executable),
    buildStateSha256: crudHash(buildBytes),
    beforeCargoSHA256: build.beforeCargoSHA256,
  };
  record.prepared = Date.now();
  record.noHostPreflight = { query: hostQuery, count: 0 };
  assertCrudProfileOwnership(record);
  await mkdir(resolve(path, ".."), { recursive: true });
  await crudOrdinary(resolve(path, ".."));
  await writeFile(path, JSON.stringify(record, null, 2), { flag: "wx" });
  return record;
}
/** Admit only the observed first-run cold Save timestamp change. All other
 * resource, metadata, layout and previous-buffer content must remain identical.
 * @param {Uint8Array} original @param {Uint8Array} captured
 * @param {Uint8Array} previous @param {any} host */
export function assertCrudColdSaveDelta(original, captured, previous, host) {
  assert.equal(
    crudHash(original),
    crudProofHashes["restoration/original-workspace-v1.json"],
  );
  assert.equal(
    crudHash(captured),
    "ba65cb1e58b55587ee1e1fbc713e73230225355cdc1b2e6ff7479f31245133b4",
  );
  assert.deepEqual(Buffer.from(previous), Buffer.from(original));
  const before = JSON.parse(Buffer.from(original).toString()),
    after = JSON.parse(Buffer.from(captured).toString());
  assert.equal(before.resources[0]._type, "workspace");
  assert.equal(before.resources[0].name, "My Collection");
  const start = Date.parse(host.startedAt),
    end = Date.parse(host.finishedAt),
    modified = after.resources[0].modified;
  assert.ok(Number.isFinite(start) && Number.isFinite(end) && end >= start);
  assert.ok(
    Number.isFinite(modified) &&
      modified > before.resources[0].modified &&
      modified >= start &&
      modified <= end,
  );
  after.resources[0].modified = before.resources[0].modified;
  assert.deepEqual(after, before);
}
/** Restore ONLY the two reviewed cold baseline buffers for the retained failed
 * first native attempt. Refuses changed evidence, live hosts, links, additional
 * profile entries and any current bytes other than the proven saved baseline.
 * Does not rewrite the failed result or historical/current ownership marker.
 * @param {string} markerPath @param {string} failedOutput @param {string} restorationOutput */
export async function restoreCrudColdBaseline(
  markerPath,
  failedOutput,
  restorationOutput,
) {
  const query =
    "@((Get-CimInstance Win32_Process)|Where-Object {$_.Name -match '^insomnium.*\\.exe$'}).Count";
  const hosts = Bun.spawnSync(
    ["powershell", "-NoProfile", "-NonInteractive", "-Command", query],
    { windowsHide: true, timeout: 5000, maxBuffer: 4096 },
  );
  assert.equal(hosts.exitCode, 0);
  assert.equal(hosts.success, true);
  assert.ok(hosts.signalCode == null && !hosts.exitedDueToTimeout);
  assert.equal(
    hosts.stdout.toString().trim(),
    "0",
    "No native hosts permitted before recovery reads",
  );
  const markerBytes = await crudBytes(validateMarkerPath(markerPath)),
    record = JSON.parse(markerBytes.toString());
  assertCrudProfileOwnership(record);
  assert.equal(record.ownershipBasis, "reconstructed-root-acceptance");
  assert.equal(record.state, "owned-exited");
  assertCrudProfileRestartable(record);
  assert.equal(record.launches.length, 1);
  const launch = record.launches[0];
  assert.equal(launch.pid, 43316);
  assert.equal(launch.observedExit.code, 0);
  assert.equal(launch.observedExit.signal, null);
  assert.equal(
    canonical(record.profile),
    canonical(join(knownWindowsApplicationData(), resourceCrudProbeIdentifier)),
  );
  await verifyCrudReconstructedProofs(record);
  const failureDir = validateMarkerPath(failedOutput),
    restoreDir = validateMarkerPath(restorationOutput);
  assert.equal(
    canonical(failureDir),
    canonical(
      resolve("artifacts/playwright/resource-manager-native-1791995709979"),
    ),
  );
  assert.equal(
    canonical(restoreDir),
    canonical(
      resolve(
        "artifacts/playwright/resource-manager-restoration-1791995709626",
      ),
    ),
  );
  const pins = [
    [
      join(failureDir, "result.json"),
      "72b99c2e372079e677c9df9319f1c27615a2daf910b0dba30b45393a427969ad",
    ],
    [
      join(restoreDir, "before.json"),
      "aaa6d7c71210bc9a2b65d3350ff3ee44f9325ddf13f3147b71973a5560805cf7",
    ],
    [
      join(restoreDir, "result.json"),
      "72059ee8cec65ae6fd02e375e41e978d7ee60d3ecc1bdb55a6094e3a1fb584f6",
    ],
  ];
  const receipts = [];
  for (const [path, hash] of pins) {
    const bytes = await crudBytes(path);
    assert.equal(crudHash(bytes), hash);
    receipts.push(JSON.parse(bytes.toString()));
  }
  const [host, before, after] = receipts;
  assert.equal(host.scenario, "resource-manager-native");
  assert.equal(host.status, "failed");
  assert.equal(host.pid, launch.pid);
  assert.deepEqual(host.exit, { code: 0, signal: null });
  assert.equal(host.expectedIdentifier, resourceCrudProbeIdentifier);
  assert.equal(host.renderingMode, "native-hidden");
  assert.equal(host.hiddenWindow.pid, launch.pid);
  assert.equal(host.hiddenWindow.visible, false);
  assert.equal(canonical(host.profileOwnershipPath), canonical(markerPath));
  assert.equal(
    canonical(host.buildPath),
    canonical(record.candidate.buildStatePath),
  );
  assert.equal(after.passed, true);
  assert.deepEqual(after.errors, []);
  assert.deepEqual(before.immutable, {});
  assert.deepEqual(after.immutable, {});
  assert.deepEqual(after.buffers, before.buffers);
  for (const receipt of [before, after]) {
    assert.equal(receipt.identifier, resourceCrudProbeIdentifier);
    assert.equal(canonical(receipt.root), canonical(record.profile));
  }
  const originals = await Promise.all(
    ["workspace-v1.json", "workspace-v1.previous.json"].map((name) =>
      crudBytes(
        crudReconstructionProofPins()["restoration/original-" + name].path,
      ),
    ),
  );
  const captured = await Promise.all(
    ["workspace-v1.json", "workspace-v1.previous.json"].map((name) =>
      crudBytes(join(restoreDir, "original-" + name)),
    ),
  );
  assertCrudColdSaveDelta(originals[0], captured[0], captured[1], host);
  const names = ["workspace-v1.json", "workspace-v1.previous.json"];
  assert.equal(before.buffers.length, 2);
  for (let i = 0; i < 2; i++) {
    assert.equal(before.buffers[i].name, names[i]);
    assert.equal(before.buffers[i].present, true);
    assert.equal(before.buffers[i].sha256, crudHash(captured[i]));
    assert.equal(originals[i].length, captured[i].length);
  }
  assert.ok((await crudOrdinary(record.profile)).isDirectory());
  const entries = (await readdir(record.profile)).sort();
  assert.deepEqual(entries, record.currentBaseline.topLevel);
  assert.ok(
    (await crudOrdinary(join(record.profile, "cookies"))).isDirectory(),
  );
  assert.deepEqual(await readdir(join(record.profile, "cookies")), []);
  const window = await crudBytes(join(record.profile, ".window-state.json"));
  assert.equal(window.length, 212);
  JSON.parse(window.toString());
  for (let i = 0; i < 2; i++)
    assert.deepEqual(
      await crudBytes(join(record.profile, names[i])),
      captured[i],
    );
  // Revalidate the immutable incident and marker immediately before bounded writes.
  assert.deepEqual(
    await crudBytes(validateMarkerPath(markerPath)),
    markerBytes,
  );
  for (const [path, hash] of pins)
    assert.equal(crudHash(await crudBytes(path)), hash);
  for (let i = 0; i < 2; i++) {
    const path = join(record.profile, names[i]);
    assert.deepEqual(await crudBytes(path), captured[i]);
    await writeFile(path, originals[i], { flag: "r+" });
  }
  const restored = await captureCrudReconstructionBaseline(record.profile);
  assert.deepEqual(restored.buffers, record.currentBaseline.buffers);
  assert.deepEqual(restored.immutable, record.currentBaseline.immutable);
  assert.deepEqual(restored.topLevel, entries);
  assert.deepEqual(
    await crudBytes(join(record.profile, ".window-state.json")),
    window,
  );
  assert.deepEqual(
    await crudBytes(validateMarkerPath(markerPath)),
    markerBytes,
  );
  for (const [path, hash] of pins)
    assert.equal(crudHash(await crudBytes(path)), hash);
  return {
    passed: true,
    restoredFiles: names,
    pid: launch.pid,
    profileReset: false,
    failedEvidenceUnchanged: true,
    markerUnchanged: true,
  };
}
if (import.meta.main) {
  if (process.argv[2] === "--restore-cold-baseline") {
    assert.equal(process.argv.slice(2).length, 4);
    const [, markerPath, failedOutput, restorationOutput] =
      process.argv.slice(2);
    console.log(
      JSON.stringify(
        await restoreCrudColdBaseline(
          markerPath,
          failedOutput,
          restorationOutput,
        ),
      ),
    );
  } else if (process.argv[2] === "--verify-reconstruction-proof") {
    assert.equal(process.argv.slice(2).length, 1);
    const agent = JSON.parse(
        (
          await crudBytes(
            crudReconstructionProofPins()["agent-audit.json"].path,
          )
        ).toString(),
      ),
      profile = agent.profilePathRecorded;
    const record = {
      schemaVersion: 2,
      identifier: resourceCrudProbeIdentifier,
      profile,
      ownershipBasis: "reconstructed-root-acceptance",
      initiallyAbsent: false,
      initialAbsenceClaim: false,
      oldRawMarkerAvailable: false,
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
            sha256: crudProofHashes["restoration/original-workspace-v1.json"],
          },
          "workspace-v1.previous.json": {
            sha256:
              crudProofHashes[
                "restoration/original-workspace-v1.previous.json"
              ],
          },
        },
      },
    };
    await verifyCrudReconstructedProofs(record);
    console.log(
      JSON.stringify({
        passed: true,
        rawProofs: 10,
        profileRead: false,
        nativeLaunched: false,
      }),
    );
  } else {
    const [mode, markerPath, buildStatePath] = process.argv.slice(2);
    assert.equal(mode, "--reconstruct");
    assert.equal(process.argv.slice(2).length, 3);
    const record = await prepareCrudProfileReconstruction(
      markerPath,
      buildStatePath,
    );
    console.log(
      JSON.stringify({
        prepared: true,
        markerPath: resolve(markerPath),
        identifier: record.identifier,
        ownershipBasis: record.ownershipBasis,
        initialAbsenceClaim: false,
        profileMutated: false,
        exeSha256: record.candidate.exeSha256,
      }),
    );
  }
}
