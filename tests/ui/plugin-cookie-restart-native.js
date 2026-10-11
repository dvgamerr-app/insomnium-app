import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, lstat, realpath, unlink, readdir } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import { createHash } from "node:crypto";
import { withNativeApp, probeIdentifier } from "./helpers/native-app.js";

const hash = (/** @type {Uint8Array} */ bytes) => createHash("sha256").update(bytes).digest("hex");
assert.ok(process.env.APPDATA);
assert.ok(process.env.INSOMNIUM_COOKIE_RESTART_FIXTURE);
const fixture = resolve(process.env.INSOMNIUM_COOKIE_RESTART_FIXTURE);
const relation = relative(resolve("artifacts/playwright"), fixture);
assert.ok(relation && !relation.startsWith("..") && !relation.includes(":"));
assert.ok((await lstat(fixture)).isFile());
assert.equal((await realpath(fixture)).toLowerCase(), fixture.toLowerCase());
const bytes = await readFile(fixture), cookies = JSON.parse(bytes.toString());
assert.equal(cookies.length, 3);
const expired = cookies.find((/** @type {any} */ item) => item.raw_cookie.startsWith("owned_expiry="));
assert.ok(expired?.expires?.AtUtc && Date.parse(expired.expires.AtUtc) < Date.now());
const root = resolve(process.env.APPDATA, probeIdentifier), cookieRoot = join(root, "cookies");
assert.equal((await realpath(root)).toLowerCase(), root.toLowerCase());
assert.equal((await realpath(cookieRoot)).toLowerCase(), cookieRoot.toLowerCase());
const workspaceId = "wrk_plugin_cookie_restart_" + Date.now();
const target = resolve(cookieRoot, workspaceId + ".json");
const previousTarget = resolve(cookieRoot, workspaceId + ".previous.json");
const verifyWrite = process.env.INSOMNIUM_COOKIE_RESTART_WRITE === "1";
assert.equal(relative(cookieRoot, target), workspaceId + ".json");
assert.equal(await Bun.file(target).exists(), false);
assert.equal(relative(cookieRoot, previousTarget), workspaceId + ".previous.json");
assert.equal(await Bun.file(previousTarget).exists(), false);
const output = resolve("artifacts/playwright", "plugin-cookie-restart-restoration-" + Date.now());
await mkdir(output, { recursive: true });
const originals = [];
for (const name of ["workspace-v1.json", "workspace-v1.previous.json"]) {
  const path = join(root, name), stat = await lstat(path);
  assert.ok(stat.isFile() && !stat.isSymbolicLink());
  assert.equal((await realpath(path)).toLowerCase(), path.toLowerCase());
  const original = await readFile(path);
  originals.push({ name, path, bytes: original });
  await writeFile(join(output, "original-" + name), original);
}
const inventory = async () => {
  const rows = /** @type {Record<string,string>} */ ({});
  for (const name of await readdir(cookieRoot)) {
    const path = join(cookieRoot, name), stat = await lstat(path);
    assert.ok(stat.isFile() && !stat.isSymbolicLink());
    rows[name] = hash(await readFile(path));
  }
  return rows;
};
const before = await inventory();
const store = join(root, "plugin-data-v1.json");
const storeBefore = await Bun.file(store).exists() ? hash(await readFile(store)) : null;
let nativeOutput = "";
const nativeOutputs = /** @type {string[]} */ ([]);
const errors = /** @type {string[]} */ ([]), restored = /** @type {any[]} */ ([]);
process.env.INSOMNIUM_UI_BUILD_STATE ||= "artifacts/native-plugin-workspace-helper-probe/build-state.json";
try {
  await writeFile(target, bytes);
  await withNativeApp("plugin-cookie-restart-native", async ({ invoke, output: native }) => {
    nativeOutput = native;
    nativeOutputs.push(native);
    const normal = await invoke("snapshot_request_cookies", { workspaceId });
    const model = await invoke("snapshot_request_cookies", { workspaceId, includeExpired: true });
    await Bun.write(join(native, "cookie-restart-observations.json"), JSON.stringify({
      fixture, fixtureSha256: hash(bytes), workspaceId, normal, model, restoration: output,
    }, null, 2));
    assert.equal(normal.cookies.length, 2);
    assert.equal(normal.cookies.some((/** @type {any} */ item) => item.key === "owned_expiry"), false);
    assert.equal(model.cookies.length, 3, "Model snapshot must retain expired file entries after a fresh native launch");
    assert.equal(model.cookies.find((/** @type {any} */ item) => item.key === "owned_expiry")?.expires?.AtUtc, expired.expires.AtUtc);
    if (verifyWrite) {
      await invoke("change_cookie", { workspaceId, url: "https://api.example.test/cookie/child",
        raw: "owned_write=write-value; Path=/cookie; Secure", previous: null, clear: false });
      const persisted = JSON.parse(await Bun.file(target).text());
      const afterNormal = await invoke("snapshot_request_cookies", { workspaceId });
      const afterModel = await invoke("snapshot_request_cookies", { workspaceId, includeExpired: true });
      await Bun.write(join(native, "cookie-write-observations.json"), JSON.stringify({
        workspaceId, persisted, normal: afterNormal, model: afterModel,
      }, null, 2));
      assert.equal(persisted.length, 4, "Unrelated cookie write must preserve expired model entries on disk");
      assert.equal(persisted.find((/** @type {any} */ item) => item.raw_cookie.startsWith("owned_expiry="))?.expires?.AtUtc, expired.expires.AtUtc);
      assert.equal(afterNormal.cookies.length, 3);
      assert.equal(afterModel.cookies.length, 4);
    }
  });
  if (verifyWrite) {
    await withNativeApp("plugin-cookie-write-restart-native", async ({ invoke, output: native }) => {
      nativeOutput = native;
      nativeOutputs.push(native);
      const normal = await invoke("snapshot_request_cookies", { workspaceId });
      const model = await invoke("snapshot_request_cookies", { workspaceId, includeExpired: true });
      await Bun.write(join(native, "cookie-write-restart-observations.json"), JSON.stringify({
        workspaceId, normal, model, restoration: output,
      }, null, 2));
      assert.equal(normal.cookies.length, 3);
      assert.ok(!normal.cookies.some((/** @type {any} */ item) => item.key === "owned_expiry"));
      assert.equal(model.cookies.length, 4);
      assert.equal(model.cookies.find((/** @type {any} */ item) => item.key === "owned_expiry")?.expires?.AtUtc, expired.expires.AtUtc);
    });
  }
} finally {
  try {
    assert.ok(nativeOutput);
    for (const dir of nativeOutputs) {
      const native = await Bun.file(join(dir, "result.json")).json();
      assert.ok(native.exit && typeof native.exit.code === "number", "Owned native must exit before cleanup");
    }
    assert.equal((await realpath(target)).toLowerCase(), target.toLowerCase());
    assert.ok(!(await lstat(target)).isSymbolicLink());
    await writeFile(join(output, "changed-cookie.json"), await readFile(target));
    await unlink(target);
    assert.equal(await Bun.file(target).exists(), false);
    if (await Bun.file(previousTarget).exists()) {
      assert.equal((await realpath(previousTarget)).toLowerCase(), previousTarget.toLowerCase());
      const stat = await lstat(previousTarget);
      assert.ok(stat.isFile() && !stat.isSymbolicLink());
      await writeFile(join(output, "previous-cookie.json"), await readFile(previousTarget));
      await unlink(previousTarget);
      assert.equal(await Bun.file(previousTarget).exists(), false);
    }
    assert.deepEqual(await inventory(), before);
  } catch (error) { errors.push(String(error)); }
  for (const row of originals) {
    try {
      const stat = await lstat(row.path); assert.ok(stat.isFile() && !stat.isSymbolicLink());
      assert.equal((await realpath(row.path)).toLowerCase(), row.path.toLowerCase());
      await writeFile(row.path, row.bytes); assert.deepEqual(await readFile(row.path), row.bytes);
      restored.push({ name: row.name, sha256: hash(row.bytes), restored: true });
    } catch (error) { errors.push(String(error)); }
  }
  const storeAfter = await Bun.file(store).exists() ? hash(await readFile(store)) : null;
  if (storeBefore !== storeAfter) errors.push("Original plugin store changed");
  await Bun.write(join(output, "result.json"), JSON.stringify({ status: errors.length ? "failed" : "passed",
    nativeOutput, nativeOutputs, verifyWrite, workspaceId, fixtureSha256: hash(bytes), originalCookieFiles: before,
    restored, storeBefore, storeAfter, errors }, null, 2));
  console.log(JSON.stringify({ restoration: output, workspaceRestored: restored.length, errors }));
  if (errors.length) throw Error(errors.join("\n"));
}
