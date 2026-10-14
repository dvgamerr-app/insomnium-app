import assert from "node:assert/strict";
import {
  readFile,
  lstat,
  realpath,
  open,
  opendir,
  readdir,
  mkdir,
  writeFile,
} from "node:fs/promises";
import { resolve, join, sep, dirname } from "node:path";
import { createHash } from "node:crypto";

const cookieGitMetadataSha256 =
  "fdcb53ab7bc5511fbc73bba59adccc80c6729370621530e2efca6ae77a2c2b43";
const canonical = (/** @type {string} */ path) => resolve(path).toLowerCase();
const hash = (/** @type {Uint8Array} */ bytes) =>
  createHash("sha256").update(bytes).digest("hex");
const verifiedPins = new WeakSet();
const namespaceBaselineSha256 =
  "71c3d7c11051b959c1dbbcd38779e220319b13307f4b68728b8bccd421e61745";
const identifier = "app.insomnium.probe.checkout20260929";
const journals = new Set([
  "git-transition-v1.json",
  "git-clone-install-v1.json",
  "insomnium-fetch-journal-v1.json",
  "insomnium-restore-ref-locks-v1.json",
  "insomnium-advance-ref-locks-v1.json",
]);
/** One historical immutable journal is part of the owner-reviewed baseline.
 * Its exact path, length and hash authorize preservation, never recovery.
 * @param {string} path @param {number} bytes @param {string} digest */
export function namespaceReviewedJournal(path, bytes, digest) {
  return (
    path ===
      "repo-git_pw_1791356525503_83aca9b4/.git/insomnium-restore-ref-locks-v1.json" &&
    bytes === 414 &&
    digest ===
      "4762dac534b3ddb82e2e641424cc78a6827c366c448ed5164e471052b339af90"
  );
}
async function ordinary(/** @type {string} */ path) {
  path = resolve(path);
  for (let parent = path; ; parent = dirname(parent)) {
    assert.ok(
      !(await lstat(parent)).isSymbolicLink(),
      "Refuse linked before-claim path",
    );
    if (dirname(parent) === parent) break;
  }
  assert.equal(canonical(await realpath(path)), canonical(path));
  return lstat(path);
}
async function regular(/** @type {string} */ path) {
  assert.ok((await ordinary(path)).isFile());
  return readFile(path);
}
async function pinned(/** @type {{path:string,sha256:string}} */ descriptor) {
  const bytes = await regular(descriptor.path);
  assert.equal(
    hash(bytes),
    descriptor.sha256,
    "Raw before-claim evidence pin mismatch",
  );
  return JSON.parse(bytes.toString());
}

/** Builtins-only admission after Root's entry ledger, before runtime helper imports.
 * No profile mutation, app launch or old-claim mutation. Descriptors are supplied
 * by Root; all baseline/Git/release-chain digests remain exact fixed contracts.
 * @param {any} state @param {string} buildPath @param {string} candidate */
export async function namespaceBeforeClaim(state, buildPath, candidate) {
  assert.equal(process.platform, "win32");
  assert.equal(state.identifier, identifier);
  assert.equal(state.status, "finished");
  assert.equal(state.result.code, 0);
  assert.equal(state.sourceClosureVerified, true);
  const root = resolve("."),
    artifactRoot = join(root, "artifacts");
  candidate = resolve(candidate);
  assert.ok(candidate.startsWith(artifactRoot + sep));
  assert.ok((await ordinary(candidate)).isDirectory());
  assert.equal(state.artifact, state.app.path);
  assert.ok(resolve(state.artifact).startsWith(candidate + sep));
  assert.equal(hash(await regular(state.artifact)), state.app.sha256);
  assert.equal((await lstat(state.artifact)).size, state.app.bytes);
  const baselineDescriptor = state.baseline ?? {
    path: join(
      artifactRoot,
      "namespace-current-baseline-root",
      "baseline.json",
    ),
    sha256: namespaceBaselineSha256,
  };
  assert.equal(baselineDescriptor.sha256, namespaceBaselineSha256);
  const baseline = await pinned(baselineDescriptor);
  const gitDescriptor = state.gitMetadata;
  assert.ok(gitDescriptor, "Root must supply exact Git metadata descriptor");
  assert.equal(gitDescriptor.sha256, cookieGitMetadataSha256);
  const releaseDescriptor = state.previousRelease ?? {
    path: join(
      artifactRoot,
      "namespace-current-native-root-run",
      "failure-profile-release.json",
    ),
    sha256: "65052b528d3abf50fbb77c91aea54104935c36de3dff680d920571079d21575c",
  };
  assert.equal(
    releaseDescriptor.sha256,
    "65052b528d3abf50fbb77c91aea54104935c36de3dff680d920571079d21575c",
  );
  const release = await pinned(releaseDescriptor);
  assert.equal(release.released, true);
  assert.equal(release.cleanupOnly, true);
  assert.equal(release.scenarioFailed, true);
  assert.equal(release.fullOriginalNamespaceScenarioAccepted, false);
  assert.equal(release.claimPreserved, true);
  assert.deepEqual(release.liveHandles, []);
  assert.equal(
    release.claim.sha256,
    "405e2a2add443d9758c9765aa84f74e927c45e2cbdcb9af451847d5c32885c43",
  );
  assert.equal(
    release.audit.sha256,
    "9200fbca85db4539754a770c5f57f7f1242be9fdf5eb959ca2932f8779251b9e",
  );
  const previousClaim = await pinned(release.claim),
    previousAudit = await pinned(release.audit);
  assert.equal(previousAudit.passed, true);
  assert.equal(previousAudit.cleanupOnly, true);
  assert.equal(previousAudit.scenarioFailed, true);
  assert.equal(previousAudit.fullOriginalNamespaceScenarioAccepted, false);
  assert.equal(previousAudit.allRecordedChildrenRequired, true);
  assert.equal(previousAudit.claimSHA256, release.claim.sha256);
  assert.equal(previousAudit.bindingSHA256, release.bindingSHA256);
  assert.equal(previousClaim.bindingSHA256, release.bindingSHA256);
  if (previousAudit.liveHandles !== undefined)
    assert.deepEqual(previousAudit.liveHandles, []);
  assert.equal(previousClaim.owner, "/root");
  assert.equal(previousClaim.held, true);
  assert.equal(previousClaim.terminal, true);
  assert.equal(previousClaim.baselineSHA256, namespaceBaselineSha256);
  const shell = join(
    process.env.SystemRoot ?? "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  assert.ok((await ordinary(shell)).isFile());
  const hostQuery =
    "@((Get-CimInstance Win32_Process)|Where-Object {$_.Name -match '^insomnium.*\\.exe$'}).Count";
  const hosts = Bun.spawnSync(
    [shell, "-NoProfile", "-NonInteractive", "-Command", hostQuery],
    { windowsHide: true, stdout: "pipe", stderr: "pipe", timeout: 5000 },
  );
  assert.equal(hosts.exitCode, 0);
  assert.equal(hosts.success, true);
  assert.ok(!hosts.exitedDueToTimeout);
  assert.ok(hosts.signalCode == null);
  assert.equal(
    hosts.stdout.toString().trim(),
    "0",
    "Refuse live Insomnium host before profile read",
  );
  const hostsEvidence = {
    tool: shell,
    query: hostQuery,
    count: 0,
    pid: hosts.pid,
    exitCode: hosts.exitCode,
    signal: hosts.signalCode ?? null,
    exitedDueToTimeout: !!hosts.exitedDueToTimeout,
  };
  const result = Bun.spawnSync(
    [
      shell,
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "[Environment]::GetFolderPath('ApplicationData')",
    ],
    { windowsHide: true, stdout: "pipe", stderr: "pipe", timeout: 5000 },
  );
  assert.equal(result.exitCode, 0);
  assert.ok(!result.exitedDueToTimeout);
  const knownFolder = result.stdout.toString().trim();
  assert.ok(knownFolder && resolve(knownFolder) === knownFolder);
  assert.ok((await ordinary(knownFolder)).isDirectory());
  const profile = join(knownFolder, identifier);
  assert.equal(profile, baseline.profile);
  assert.ok((await ordinary(profile)).isDirectory());
  const topLevel = /** @type {Record<string,string>} */ ({});
  /** @returns {Promise<void>} */ async function journalsAbsent(
    /** @type {string} */ directory,
  ) {
    for (const name of await readdir(directory)) {
      assert.ok(!journals.has(name), "Pending profile recovery before claim");
      const info = await ordinary(join(directory, name));
      assert.ok(info.isFile() || info.isDirectory());
      if (info.isDirectory()) await journalsAbsent(join(directory, name));
    }
  }
  for (const name of (await readdir(profile)).sort()) {
    assert.ok(!journals.has(name));
    const info = await ordinary(join(profile, name));
    assert.ok(info.isFile() || info.isDirectory());
    topLevel[name] = info.isDirectory() ? "directory" : "file";
    if (info.isDirectory() && name !== "git-v1")
      await journalsAbsent(join(profile, name));
  }
  const protectedBefore = /** @type {Record<string,string>} */ ({}),
    pluginStores =
      /** @type {Record<string,{present:boolean,sha256:string|null}>} */ ({});
  for (const name of [
    "workspace-v1.json",
    "workspace-v1.previous.json",
    "plugin-data-v1.json",
    "plugin-data-v1.previous.json",
  ]) {
    let present = true;
    try {
      await lstat(join(profile, name));
    } catch (error) {
      assert.equal(/** @type {any} */ (error).code, "ENOENT");
      present = false;
    }
    const digest = present ? hash(await regular(join(profile, name))) : null;
    if (digest) protectedBefore[name] = digest;
    if (name.startsWith("plugin-data"))
      pluginStores[name] = { present, sha256: digest };
    else assert.ok(present);
  }
  const cookieRoot = join(profile, "cookies");
  assert.ok((await ordinary(cookieRoot)).isDirectory());
  for (const name of await readdir(cookieRoot)) {
    assert.match(name, /^[A-Za-z0-9_-]+(?:\.previous)?\.json$/);
    protectedBefore["cookies/" + name] = hash(
      await regular(join(cookieRoot, name)),
    );
  }
  assert.equal(
    Object.keys(protectedBefore).filter((name) => name.startsWith("cookies/"))
      .length,
    654,
  );
  assert.deepEqual(protectedBefore, baseline.protectedBefore);
  assert.deepEqual(pluginStores, baseline.pluginStores);
  const workspaceBytes = await regular(join(profile, "workspace-v1.json")),
    workspace = JSON.parse(workspaceBytes.toString());
  assert.equal(hash(workspaceBytes), baseline.workspaceSHA256);
  assert.equal(workspace.resources.length, 43);
  assert.equal(workspace.history.length, 20);
  const gitRoot = join(profile, "git-v1"),
    metadata = await readCookieGitMetadata(
      gitRoot,
      gitDescriptor.path,
      gitDescriptor.sha256,
    );
  assert.ok(
    metadata.files.every(
      (/** @type {any} */ row) =>
        !row.path
          .split("/")
          .some((/** @type {string} */ part) => journals.has(part)) ||
        namespaceReviewedJournal(
          row.path,
          row.bytes,
          baseline.gitBefore[row.path],
        ),
    ),
  );
  const gitBefore = await inventoryCookieGit(
    gitRoot,
    metadata,
    baseline.gitBefore,
  );
  assert.deepEqual(gitBefore, baseline.gitBefore);
  const before = {
    profile,
    protectedBefore,
    pluginStores,
    gitBefore,
    workspaceSHA256: hash(workspaceBytes),
    workspace,
    topLevel,
  };
  const operatorOutput = join(candidate, "operator-" + Date.now());
  await mkdir(operatorOutput);
  const save = async (/** @type {string} */ name, /** @type {any} */ value) => {
    await writeFile(
      join(operatorOutput, name),
      JSON.stringify(value, null, 2) + "\n",
      { flag: "wx" },
    );
  };
  await save("filesystem-before.json", before);
  const binding = {
    status: "current-original-namespace-operator",
    identifier,
    profile,
    artifact: state.artifact,
    exeSHA256: state.app.sha256,
    buildState: resolve(buildPath),
    buildStateDescriptor: {
      path: resolve(buildPath),
      sha256: hash(await regular(buildPath)),
      beforeCargoSHA256: state.beforeCargoSHA256,
    },
    operatorOutput,
    baseline: baselineDescriptor,
    gitMetadata: gitDescriptor,
    previousRelease: releaseDescriptor,
  };
  await save("binding.json", binding);
  const bindingPath = join(operatorOutput, "binding.json"),
    bindingSHA256 = hash(await regular(bindingPath));
  const claim = {
    owner: "/root",
    runnerPid: process.pid,
    held: true,
    terminal: false,
    exe: state.artifact,
    exeSHA256: state.app.sha256,
    bindingPath,
    bindingSHA256,
    baselineSHA256: namespaceBaselineSha256,
    profile,
    identifier,
  };
  await save("claim-before-imports.json", claim);
  await save("claim.json", claim);
  await save("before-import-preflight.json", {
    passed: true,
    profileUnchanged: true,
    originalResources: 43,
    originalHistory: 20,
    cookies: 654,
    gitFiles: 13783,
    gitDirectories: 15865,
    gitBytes: 8504236,
    baselineSHA256: namespaceBaselineSha256,
    priorCleanupReleaseVerified: true,
    noHostsChecked: true,
    hosts: hostsEvidence,
    runtimeHelpersImported: false,
  });
  return { binding, bindingPath, bindingSHA256, before, claim };
}
/** @param {string} path */
function relativePath(path) {
  assert.equal(typeof path, "string");
  assert.ok(path && !path.includes("\\") && !path.includes(":"));
  assert.ok(
    path.split("/").every((part) => part && part !== "." && part !== ".."),
  );
  return path;
}

/** Exact owner-reviewed baseline, no wildcard/prefix/file filtering.
 * @param {string} root @param {string} pinPath @param {string} expectedSha256 */
async function readCookieGitMetadata(root, pinPath, expectedSha256) {
  assert.equal(
    expectedSha256,
    cookieGitMetadataSha256,
    "Explicit reviewed metadata SHA required",
  );
  const path = resolve(pinPath);
  assert.ok(path.startsWith(resolve("artifacts") + sep));
  const info = await lstat(path);
  assert.ok(
    info.isFile() && !info.isSymbolicLink() && info.size <= 16 * 1024 * 1024,
  );
  assert.equal(canonical(await realpath(path)), canonical(path));
  const bytes = await readFile(path);
  assert.equal(
    hash(bytes),
    cookieGitMetadataSha256,
    "Reject unreviewed Git baseline",
  );
  const pin = JSON.parse(bytes.toString());
  assert.equal(pin.identifier, "app.insomnium.probe.checkout20260929");
  assert.equal(pin.metadataOnly, true);
  assert.equal(canonical(pin.root), canonical(root));
  assert.equal(pin.fileCount, 13783);
  assert.equal(pin.files.length, 13783);
  assert.equal(pin.directories.length, 15865);
  assert.equal(pin.bytes, 8504236);
  assert.equal(pin.maximum, 2164811);
  const files = new Map();
  let total = 0,
    maximum = 0;
  for (const file of pin.files) {
    relativePath(file.path);
    assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
    assert.ok(!files.has(file.path));
    files.set(file.path, file.bytes);
    total += file.bytes;
    maximum = Math.max(maximum, file.bytes);
  }
  assert.equal(total, pin.bytes);
  assert.equal(maximum, pin.maximum);
  assert.equal(new Set(pin.directories).size, pin.directories.length);
  assert.equal(pin.directories[0], "");
  for (const directory of pin.directories.slice(1)) relativePath(directory);
  pin.files.forEach(Object.freeze);
  Object.freeze(pin.files);
  Object.freeze(pin.directories);
  Object.freeze(pin);
  verifiedPins.add(pin);
  return pin;
}

/** One64KiB buffer and file descriptor; no whole-file allocation.
 * @param {string} path @param {number} expectedBytes */
async function streamCookieGitFile(path, expectedBytes) {
  const before = await lstat(path);
  assert.ok(before.isFile() && !before.isSymbolicLink());
  assert.equal(before.size, expectedBytes);
  assert.equal(canonical(await realpath(path)), canonical(path));
  const file = await open(path, "r"),
    digest = createHash("sha256"),
    buffer = Buffer.alloc(65536);
  let bytes = 0;
  const stable = (/** @type {import('node:fs').Stats} */ actual) => {
    for (const key of /** @type {const} */ ([
      "size",
      "mtimeMs",
      "ctimeMs",
      "ino",
      "dev",
    ]))
      assert.equal(
        actual[key],
        before[key],
        "File changed during streamed inventory: " + path,
      );
    assert.ok(actual.isFile());
  };
  try {
    stable(await file.stat());
    while (bytes < expectedBytes) {
      const result = await file.read(
        buffer,
        0,
        Math.min(buffer.length, expectedBytes - bytes),
        bytes,
      );
      assert.ok(result.bytesRead > 0);
      digest.update(buffer.subarray(0, result.bytesRead));
      bytes += result.bytesRead;
    }
    const tail = await file.read(buffer, 0, 1, bytes);
    assert.equal(tail.bytesRead, 0);
    stable(await file.stat());
    const after = await lstat(path);
    assert.ok(!after.isSymbolicLink());
    stable(after);
    assert.equal(canonical(await realpath(path)), canonical(path));
    assert.equal(bytes, expectedBytes);
    return digest.digest("hex");
  } finally {
    await file.close();
  }
}

/** Validate complete metadata BEFORE reading content. Unknown/missing paths fail.
 * @param {string} root @param {any} pin @param {Record<string,string>} baselineHashes */
async function inventoryCookieGit(root, pin, baselineHashes) {
  assert.ok(
    verifiedPins.has(pin),
    "Only verified detached pinned metadata may authorize Git reads",
  );
  assert.equal(canonical(pin.root), canonical(root));
  const allowedFiles = new Map(
      pin.files.map((/** @type {any} */ file) => [file.path, file.bytes]),
    ),
    allowedDirectories = new Set(pin.directories);
  const seenFiles = new Set(),
    seenDirectories = new Set();
  let total = 0;
  const walk = async (
    /** @type {string} */ path,
    /** @type {string} */ prefix,
  ) => {
    assert.ok(
      allowedDirectories.has(prefix),
      "Unknown Git directory: " + prefix,
    );
    assert.ok(!seenDirectories.has(prefix));
    seenDirectories.add(prefix);
    const info = await lstat(path);
    assert.ok(info.isDirectory() && !info.isSymbolicLink());
    assert.equal(canonical(await realpath(path)), canonical(path));
    const directory = await opendir(path);
    for await (const entry of directory) {
      const name = prefix ? prefix + "/" + entry.name : entry.name,
        child = join(path, entry.name),
        stat = await lstat(child);
      assert.ok(
        !journals.has(entry.name) ||
          (stat.isFile() &&
            namespaceReviewedJournal(name, stat.size, baselineHashes[name])),
        "Refuse unreviewed managed Git recovery journal before claim",
      );
      assert.ok(!stat.isSymbolicLink());
      if (stat.isDirectory()) await walk(child, name);
      else {
        assert.ok(stat.isFile());
        assert.ok(allowedFiles.has(name), "Unknown Git file: " + name);
        assert.ok(!seenFiles.has(name));
        assert.equal(stat.size, allowedFiles.get(name));
        seenFiles.add(name);
        total += stat.size;
        assert.ok(total <= pin.bytes);
      }
    }
  };
  await walk(root, "");
  assert.equal(seenFiles.size, pin.fileCount);
  assert.equal(seenDirectories.size, pin.directories.length);
  assert.equal(total, pin.bytes);
  const result = /** @type {Record<string,string>} */ ({});
  for (const file of pin.files) {
    result[file.path] = await streamCookieGitFile(
      join(root, ...file.path.split("/")),
      file.bytes,
    );
    if (
      file.path
        .split("/")
        .some((/** @type {string} */ part) => journals.has(part))
    )
      assert.ok(
        namespaceReviewedJournal(file.path, file.bytes, result[file.path]),
        "Reject changed historical journal bytes",
      );
  }
  seenFiles.clear();
  seenDirectories.clear();
  total = 0;
  await walk(root, "");
  assert.equal(seenFiles.size, pin.fileCount);
  assert.equal(seenDirectories.size, pin.directories.length);
  assert.equal(total, pin.bytes);
  return result;
}
