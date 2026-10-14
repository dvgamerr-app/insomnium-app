import assert from "node:assert/strict";
import { lstat, realpath, readFile, readdir } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { knownWindowsApplicationData } from "./native-profile-ownership.js";
import {
  cookieGitMetadataSha256,
  readCookieGitMetadata,
  inventoryCookieGit,
} from "./cookie-native-git-inventory.js";

export const namespaceBaselineSha256 =
  "71c3d7c11051b959c1dbbcd38779e220319b13307f4b68728b8bccd421e61745";
export const namespaceIdentifier = "app.insomnium.probe.checkout20260929";
const sha = (/** @type {Uint8Array} */ bytes) =>
  createHash("sha256").update(bytes).digest("hex");
async function ordinary(/** @type {string} */ path) {
  path = resolve(path);
  for (let parent = path; ; parent = dirname(parent)) {
    assert.ok(
      !(await lstat(parent)).isSymbolicLink(),
      "Refuse linked namespace path",
    );
    if (dirname(parent) === parent) break;
  }
  assert.equal((await realpath(path)).toLowerCase(), path.toLowerCase());
  return lstat(path);
}
async function regular(/** @type {string} */ path) {
  assert.ok((await ordinary(path)).isFile());
  return readFile(path);
}

/** Read-only current profile capture. Whole managed Git uses its exact pinned
 * metadata allowlist. WebView stores are enumerated at top level, never included
 * in the historic protected-byte baseline or traversed as immutable data.
 * @param {{profile:string,gitMetadata:{path:string,sha256:string}}} binding */
export async function captureNamespaceProfile(binding) {
  assert.equal(process.platform, "win32");
  const profile = join(knownWindowsApplicationData(), namespaceIdentifier);
  assert.equal(profile, binding.profile);
  assert.ok((await ordinary(profile)).isDirectory());
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
      if (/** @type {any} */ (error).code !== "ENOENT") throw error;
      present = false;
    }
    const digest = present ? sha(await regular(join(profile, name))) : null;
    if (digest) protectedBefore[name] = digest;
    if (name.startsWith("plugin-data"))
      pluginStores[name] = { present, sha256: digest };
    else assert.ok(present, "Require original namespace workspace");
  }
  const cookies = join(profile, "cookies");
  assert.ok((await ordinary(cookies)).isDirectory());
  for (const name of await readdir(cookies)) {
    assert.match(name, /^[A-Za-z0-9_-]+(?:\.previous)?\.json$/);
    protectedBefore["cookies/" + name] = sha(
      await regular(join(cookies, name)),
    );
  }
  const gitRoot = join(profile, "git-v1");
  assert.equal(binding.gitMetadata.sha256, cookieGitMetadataSha256);
  const metadata = await readCookieGitMetadata(
      gitRoot,
      binding.gitMetadata.path,
      binding.gitMetadata.sha256,
    ),
    gitBefore = await inventoryCookieGit(gitRoot, metadata);
  const topLevel = /** @type {Record<string,string>} */ ({});
  for (const name of (await readdir(profile)).sort()) {
    const info = await ordinary(join(profile, name));
    assert.ok(
      info.isFile() || info.isDirectory(),
      "Refuse special top-level namespace entry",
    );
    topLevel[name] = info.isDirectory() ? "directory" : "file";
  }
  const workspaceBytes = await regular(join(profile, "workspace-v1.json"));
  return {
    profile,
    protectedBefore,
    pluginStores,
    gitBefore,
    workspaceSHA256: sha(workspaceBytes),
    workspace: JSON.parse(workspaceBytes.toString()),
    cookies: normalizeNamespaceProtected(protectedBefore),
    topLevel,
  };
}

/** Compare against the mandatory original raw-byte pin, never an unverified
 * caller object. @param {any} snapshot @param {{path:string,sha256:string}} baseline */
export async function assertNamespaceBaseline(snapshot, baseline) {
  assert.equal(baseline.sha256, namespaceBaselineSha256);
  const bytes = await regular(baseline.path);
  assert.equal(
    sha(bytes),
    namespaceBaselineSha256,
    "Require original namespace baseline bytes",
  );
  const original = JSON.parse(bytes.toString());
  assert.equal(snapshot.profile, original.profile);
  assert.deepEqual(snapshot.protectedBefore, original.protectedBefore);
  assert.deepEqual(snapshot.gitBefore, original.gitBefore);
  assert.deepEqual(snapshot.pluginStores, original.pluginStores);
  assert.equal(snapshot.workspaceSHA256, original.workspaceSHA256);
  assert.equal(snapshot.workspace.resources.length, 43);
  assert.equal(snapshot.workspace.history.length, 20);
  assert.equal(
    Object.keys(snapshot.protectedBefore).filter((path) =>
      path.startsWith("cookies/"),
    ).length,
    654,
  );
  assert.equal(Object.keys(snapshot.gitBefore).length, 13783);
  normalizeNamespaceProtected(snapshot.protectedBefore);
  return original;
}

/** Original preserver evidence contract; workspace originals must be the only
 * buffered protected files. @param {any} before */
export function preserverProtected(before) {
  assert.equal(before.identifier, namespaceIdentifier);
  const result = { ...before.immutable };
  assert.equal(before.buffers.length, 2);
  assert.deepEqual(
    before.buffers.map((/** @type {any} */ row) => row.name).sort(),
    ["workspace-v1.json", "workspace-v1.previous.json"],
  );
  for (const row of before.buffers) {
    assert.equal(row.present, true);
    assert.ok(!Object.hasOwn(result, row.name));
    result[row.name] = row.sha256;
  }
  normalizeNamespaceProtected(result);
  return result;
}

export function normalizeNamespaceProtected(
  /** @type {Record<string,string>} */ raw,
) {
  const normalized = /** @type {Record<string,string>} */ ({}),
    mapping =
      /** @type {{rawPath:string,normalizedPath:string,sha256:string}[]} */ ([]);
  for (const [path, sha256] of Object.entries(raw)) {
    assert.match(sha256, /^[a-f0-9]{64}$/);
    let to = path;
    if (path.startsWith("cookies/")) {
      const name = path.slice(8);
      assert.match(name, /^[A-Za-z0-9_-]+(?:\.previous)?\.json$/);
      to = "request-cookies/" + name;
    } else
      assert(
        [
          "workspace-v1.json",
          "workspace-v1.previous.json",
          "plugin-data-v1.json",
          "plugin-data-v1.previous.json",
        ].includes(path),
      );
    assert(!Object.hasOwn(normalized, to));
    normalized[to] = sha256;
    mapping.push({ rawPath: path, normalizedPath: to, sha256 });
  }
  assert.equal(mapping.length, Object.keys(raw).length);
  return { normalized, mapping };
}
export function fixtureOwnership(
  /** @type {any} */ original,
  /** @type {any} */ changed,
  /** @type {any} */ registered,
  /** @type {any} */ isolation,
  /** @type {number} */ nativeFinishedAt,
) {
  assert.equal(registered.length, 1);
  const [workspaceId, name] = registered[0],
    m = /^wrk_xrf_(\d+)$/.exec(workspaceId);
  assert(m);
  assert.equal(name, "XML response " + m[1]);
  const fixtureStarted = Number(m[1]);
  assert(Number.isSafeInteger(fixtureStarted) && fixtureStarted > 0);
  assert(
    Number.isSafeInteger(nativeFinishedAt) &&
      nativeFinishedAt >= fixtureStarted,
  );
  const requestId = "req_xrf_" + m[1],
    metaId = "reqm_xrf_" + m[1],
    peerId = isolation.peerMeta.parentId;
  assert.match(peerId, /^req_ns_peer_\d+$/);
  const peerStarted = Number(peerId.slice("req_ns_peer_".length));
  assert(
    Number.isSafeInteger(peerStarted) &&
      peerStarted >= fixtureStarted &&
      peerStarted <= nativeFinishedAt,
  );
  assert.equal(isolation.peerMeta._id, "reqm_" + peerId);
  assert.equal(
    changed.resources.length,
    new Set(changed.resources.map((/** @type {any} */ r) => r._id)).size,
  );
  const oldIds = new Set(
    original.resources.map((/** @type {any} */ r) => r._id),
  );
  assert.equal(oldIds.size, original.resources.length);
  for (const r of original.resources)
    assert.deepEqual(
      changed.resources.find((/** @type {any} */ x) => x._id === r._id),
      r,
      "Original resource changed",
    );
  const added = changed.resources.filter(
    (/** @type {any} */ r) => !oldIds.has(r._id),
  );
  assert.equal(
    added.length,
    new Set(added.map((/** @type {any} */ r) => r._id)).size,
  );
  const required = [workspaceId, requestId, metaId, peerId, "reqm_" + peerId];
  for (const id of required)
    assert.equal(
      added.filter((/** @type {any} */ r) => r._id === id).length,
      1,
    );
  const find = (/** @type {any} */ id) =>
    added.find((/** @type {any} */ r) => r._id === id);
  assert.equal(find(workspaceId)._type, "workspace");
  assert.equal(find(workspaceId).name, name);
  assert.equal(find(workspaceId).parentId, null);
  assert.equal(find(workspaceId).scope, "collection");
  for (const [id, title] of [
    [requestId, "Owned XML response"],
    [peerId, "Namespace peer"],
  ]) {
    const r = find(id);
    assert.equal(r._type, "request");
    assert.equal(r.parentId, workspaceId);
    assert.equal(r.name, title);
    assert.equal(r.method, "GET");
    const u = new URL(r.url);
    assert.equal(u.hostname, "127.0.0.1");
    assert.equal(u.protocol, "http:");
    assert.equal(u.pathname, "/mapped");
  }
  for (const [id, parent] of [
    [metaId, requestId],
    ["reqm_" + peerId, peerId],
  ]) {
    assert.equal(find(id)._type, "request_meta");
    assert.equal(find(id).parentId, parent);
  }
  assert.deepEqual(find(metaId).extra, { retained: 42 });
  assert.deepEqual(find(metaId).responseXPathNamespaces, { n: "urn:one" });
  assert.deepEqual(find("reqm_" + peerId), isolation.peerMeta);
  const metas = added.filter(
    (/** @type {any} */ r) => !required.includes(r._id),
  );
  assert(metas.length <= 1);
  for (const r of metas) {
    assert.equal(r._type, "workspace_meta");
    assert.equal(r.parentId, workspaceId);
    assert.match(r._id, /^wrkm_[a-f0-9]{32}$/);
    assert.equal(r.activeEnvironmentId, "");
    assert(Number.isFinite(r.created) && Number.isFinite(r.modified));
    assert(r.created >= fixtureStarted);
    assert(r.modified >= r.created);
    assert(r.created <= nativeFinishedAt && r.modified <= nativeFinishedAt);
    assert.deepEqual(
      Object.keys(r).sort(),
      [
        "_id",
        "_type",
        "parentId",
        "activeEnvironmentId",
        "created",
        "modified",
      ].sort(),
    );
  }
  const oldHistory = new Set(
    original.history.map((/** @type {any} */ r) => r._id),
  );
  assert.deepEqual(
    changed.history.filter((/** @type {any} */ r) => oldHistory.has(r._id)),
    original.history,
  );
  const fresh = changed.history.filter(
    (/** @type {any} */ r) => !oldHistory.has(r._id),
  );
  assert.equal(fresh.length, 3);
  assert.equal(
    fresh.filter((/** @type {any} */ r) => r.requestId === requestId).length,
    2,
  );
  assert.equal(
    fresh.filter((/** @type {any} */ r) => r.requestId === peerId).length,
    1,
  );
  for (const r of fresh) assert([requestId, peerId].includes(r.requestId));
  return {
    workspaceId,
    requestId,
    metaId,
    peerId,
    explicit: 5,
    generatedWorkspaceMeta: metas.length,
    addedIds: added.map((/** @type {any} */ r) => r._id),
  };
}
