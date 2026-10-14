// Builtins-only bootstrap checks captured bytes BEFORE importing runtime helpers.
import assert from "node:assert/strict";
import { readFile, lstat, realpath, readlink, readdir } from "node:fs/promises";
import { resolve, join, relative, dirname, sep } from "node:path";
import { createHash } from "node:crypto";
const hash = (/** @type {Uint8Array} */ bytes) =>
  createHash("sha256").update(bytes).digest("hex");
const checkedAncestors = new Set();
/** @param {string} path */
async function ordinaryBytes(path) {
  const full = resolve(path);
  for (let at = dirname(full); ; at = dirname(at)) {
    if (checkedAncestors.has(at)) break;
    assert.ok(
      !(await lstat(at)).isSymbolicLink(),
      "Linked bootstrap path refused",
    );
    checkedAncestors.add(at);
    if (dirname(at) === at) break;
  }
  assert.equal((await realpath(full)).toLowerCase(), full.toLowerCase());
  const stat = await lstat(full);
  assert.ok(stat.isFile() && !stat.isSymbolicLink());
  return readFile(full);
}
const [mode, buildPath, bindingPath, bindingHash] = process.argv.slice(2);
assert.ok(["--run", "--leaf", "--release", "--release-cleanup"].includes(mode));
assert.equal(process.platform, "win32");
assert.equal(process.arch, "x64");
assert.ok(
  resolve(buildPath).startsWith(
    resolve("artifacts/native-namespace-audit-probe") + sep,
  ),
);
const state = JSON.parse((await ordinaryBytes(buildPath)).toString());
assert.equal(state.status, "finished");
assert.equal(state.result.code, 0);
assert.equal(state.identifier, "app.insomnium.probe.checkout20260929");
assert.equal(state.sourceClosureVerified, true);
const candidate = dirname(resolve(state.artifact)),
  raw = await ordinaryBytes(join(candidate, "before-cargo.json"));
assert.equal(hash(raw), state.beforeCargoSHA256);
const ledger = JSON.parse(raw.toString());
assert.equal(ledger.identifier, state.identifier);
assert.equal(ledger.target, "x86_64-pc-windows-msvc");
assert.equal(ledger.root, resolve("."));
assert.equal(ledger.candidate, candidate);
for (const rows of [
  ledger.sources,
  ledger.packages,
  ledger.cargo.rows,
  ledger.tools,
  ledger.assets,
  ledger.notices,
  ledger.spectral,
  ledger.privateInputs,
  ledger.privateFullRows,
  ledger.cargoConfigs,
  [ledger.probeConfig, state.app, state.sidecar],
]) {
  assert.ok(Array.isArray(rows));
  for (const row of rows) {
    if (row.kind === "directory") {
      const stat = await lstat(row.path);
      assert.ok(stat.isDirectory() && !stat.isSymbolicLink());
      continue;
    }
    if (row.kind === "link") {
      assert.ok((await lstat(row.path)).isSymbolicLink());
      assert.equal(await readlink(row.path), row.link);
      assert.equal(await realpath(row.path), row.target);
      continue;
    }
    const bytes = await ordinaryBytes(row.path);
    assert.equal(bytes.length, row.bytes);
    assert.equal(
      hash(bytes),
      row.sha256,
      "Changed captured input: " + row.path,
    );
  }
}
// Exact captured membership must hold before importing runtime helpers.
for (const [rows, scope] of [
  [ledger.sources, "source"],
  [ledger.packages, "package"],
  [ledger.cargo.rows, "cargo"],
  [ledger.assets, "asset"],
  [ledger.notices, "notice"],
  [ledger.privateFullRows, "private"],
]) {
  const directories = new Set(
    rows
      .filter((/** @type {any} */ row) => row.kind === "directory")
      .map((/** @type {any} */ row) => resolve(row.path)),
  );
  const children = new Map([...directories].map((path) => [path, new Set()]));
  for (const row of rows) {
    const path = resolve(row.path);
    children.get(dirname(path))?.add(path);
  }
  const cargoRoots = new Set(
    ledger.cargo.packages.map((/** @type {any} */ pkg) =>
      dirname(pkg.manifestPath),
    ),
  );
  for (const directory of directories) {
    const actual = (await readdir(directory))
      .map((name) => join(directory, name))
      .filter((path) => {
        if (scope === "source")
          return (
            !ledger.generatedOutputExclusions.some(
              (/** @type {string} */ base) => {
                const excluded = resolve(base);
                return path === excluded || path.startsWith(excluded + sep);
              },
            ) &&
            !relative(resolve("."), path).split(sep).includes("node_modules")
          );
        if (scope === "cargo" && cargoRoots.has(directory))
          return !["target", ".git"].includes(relative(directory, path));
        return true;
      });
    assert.deepEqual(
      [...new Set(actual)].sort(),
      [...(children.get(directory) ?? [])].sort(),
      "Captured directory membership changed: " + directory,
    );
  }
}
const capturedRootFiles = ledger.sources
  .filter(
    (/** @type {any} */ row) =>
      row.kind !== "directory" && dirname(row.path) === resolve("."),
  )
  .map((/** @type {any} */ row) => resolve(row.path))
  .sort();
const actualRootFiles = [];
for (const name of await readdir(resolve("."))) {
  const path = resolve(name),
    stat = await lstat(path);
  assert.ok(!stat.isSymbolicLink(), "Linked root input refused");
  if (stat.isFile() && !/\.timestamp-/.test(name)) actualRootFiles.push(path);
}
assert.deepEqual(
  actualRootFiles.sort(),
  capturedRootFiles,
  "Root build-input set changed",
);
for (const binding of ledger.packageBindings) {
  const metadata = JSON.parse(
    (await ordinaryBytes(binding.metadataPath)).toString(),
  );
  assert.equal(metadata.name, binding.name);
  assert.equal(metadata.version, binding.version);
  assert.equal(binding.lockIdentity[0], binding.name + "@" + binding.version);
  if (binding.entry !== null)
    assert.equal(
      await realpath(
        Bun.resolveSync(
          binding.resolutionSpecifier ?? binding.specifier,
          binding.project,
        ),
      ),
      binding.entry,
    );
  for (const entry of binding.resolutionEntries ?? []) {
    assert.equal(
      await realpath(Bun.resolveSync(entry.specifier, binding.project)),
      entry.entry,
    );
  }
  if (binding.runtimeBuiltin !== null && binding.runtimeBuiltin !== undefined)
    assert.equal(
      Bun.resolveSync(binding.specifier, binding.project),
      binding.runtimeBuiltin,
    );
}
for (const [rows, base, dest] of [
  [ledger.assets, resolve("build"), "frontend"],
  [ledger.notices, resolve("src-tauri/notices"), "notices"],
])
  for (const row of rows) {
    const path = join(candidate, dest, relative(base, row.path));
    if (row.kind === "directory") assert.ok((await lstat(path)).isDirectory());
    else {
      const bytes = await ordinaryBytes(path);
      assert.equal(bytes.length, row.bytes);
      assert.equal(hash(bytes), row.sha256);
    }
  }
for (const [rows, base, dest] of [
  [ledger.assets, resolve("build"), "frontend"],
  [ledger.notices, resolve("src-tauri/notices"), "notices"],
]) {
  const paths = rows.map((/** @type {any} */ row) => ({
    ...row,
    path: join(candidate, dest, relative(base, row.path)),
  }));
  for (const directory of paths.filter(
    (/** @type {any} */ row) => row.kind === "directory",
  )) {
    const expected = paths
      .filter((/** @type {any} */ row) => dirname(row.path) === directory.path)
      .map((/** @type {any} */ row) => row.path)
      .sort();
    assert.deepEqual(
      (await readdir(directory.path))
        .map((name) => join(directory.path, name))
        .sort(),
      expected,
      "Published candidate membership changed",
    );
  }
}
assert.equal(hash(await ordinaryBytes(state.artifact)), state.app.sha256);
if (mode !== "--run") {
  assert.match(
    bindingHash ?? "",
    /^[a-f0-9]{64}$/,
    "Explicit reviewed binding hash required",
  );
  const bytes = await ordinaryBytes(bindingPath);
  assert.equal(hash(bytes), bindingHash);
  const binding = JSON.parse(bytes.toString());
  assert.equal(binding.buildState, resolve(buildPath));
  assert.equal(binding.exeSHA256, state.app.sha256);
  assert.equal(binding.buildStateDescriptor.path, binding.buildState);
  assert.equal(
    binding.buildStateDescriptor.beforeCargoSHA256,
    state.beforeCargoSHA256,
  );
  assert.equal(
    hash(await ordinaryBytes(buildPath)),
    binding.buildStateDescriptor.sha256,
  );
}
if (mode === "--leaf") {
  assert.equal(
    bindingHash,
    process.env.INSOMNIUM_NAMESPACE_OPERATOR_BINDING_SHA256,
  );
  await import(new URL("./xml-response-filter.js", import.meta.url).href);
} else {
  let prepared = null;
  if (mode === "--run") {
    const { namespaceBeforeClaim } =
      await import("./helpers/namespace-before-claim.js");
    prepared = await namespaceBeforeClaim(
      {
        ...state,
        gitMetadata: {
          path: resolve(
            "artifacts/certificate-combined-native-preparation/git-baseline-metadata.json",
          ),
          sha256:
            "fdcb53ab7bc5511fbc73bba59adccc80c6729370621530e2efca6ae77a2c2b43",
        },
      },
      buildPath,
      candidate,
    );
  }
  const { runNamespaceOperator, releaseNamespaceProfile } =
    await import("./helpers/namespace-operator-runtime.js");
  if (mode === "--run")
    await runNamespaceOperator(state, ledger, buildPath, prepared);
  else
    await releaseNamespaceProfile(
      state,
      ledger,
      bindingPath,
      mode === "--release-cleanup",
      bindingHash,
    );
}
