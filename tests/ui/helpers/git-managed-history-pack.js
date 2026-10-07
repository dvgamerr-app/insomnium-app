import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fixtureGit } from "./git-advance-fixture.js";
import { packGitObjects } from "./git-pack-fixture.js";

/** Build remote-only commits over a validated owned managed tree. Neither new
 * commit is written to the managed ODB before native Fetch imports its pack.
 * @param {Awaited<ReturnType<import('./git-advance-fixture.js').advanceFixture>>} fixture */
export async function managedHistoryPack(fixture) {
  const ids = (await fixtureGit(fixture.repo, ["rev-list", "--objects", "--no-object-names", fixture.newOid])).split("\n");
  assert.ok(ids.length < 10000 && ids.every(id => /^[0-9a-f]{40}$/.test(id)));
  const env = { ...process.env };
  for (const name of Object.keys(env)) if (name.startsWith("GIT_")) delete env[name];
  env.GIT_CONFIG_GLOBAL = "NUL";
  env.GIT_CONFIG_NOSYSTEM = "1";
  const child = Bun.spawn(["git", "-C", fixture.repo, "cat-file", "--batch"], {
    env, stdin: new TextEncoder().encode(ids.join("\n") + "\n"), stdout: "pipe", stderr: "pipe", windowsHide: true,
  });
  const [bytes, stderr, code] = await Promise.all([
    new Response(child.stdout).arrayBuffer(), new Response(child.stderr).text(), child.exited,
  ]);
  assert.equal(code, 0, stderr);
  const buffer = Buffer.from(bytes);
  assert.ok(buffer.length < 20 * 1024 * 1024);
  const objects = /** @type {{type:"commit"|"tree"|"blob",data:Buffer}[]} */ ([]);
  let offset = 0;
  for (const id of ids) {
    const end = buffer.indexOf(10, offset);
    const match = buffer.subarray(offset, end).toString().match(/^([0-9a-f]{40}) (commit|tree|blob) ([0-9]+)$/);
    assert.ok(match);
    assert.equal(match[1], id);
    const size = Number(match[3]);
    assert.ok(Number.isSafeInteger(size) && size >= 0 && end + 1 + size < buffer.length);
    const data = buffer.subarray(end + 1, end + 1 + size);
    const type = /** @type {"commit"|"tree"|"blob"} */ (match[2]);
    assert.equal(createHash("sha1").update(`${type} ${size}\0`).update(data).digest("hex"), id);
    objects.push({ type, data });
    offset = end + 2 + size;
  }
  assert.equal(offset, buffer.length);
  const tree = await fixtureGit(fixture.repo, ["rev-parse", fixture.newOid + "^{tree}"]);
  const author = "Remote history fixture <fixture@example.invalid> 1700000000 +0000";
  const commit = (/** @type {string} */ parent, /** @type {string} */ message) => {
    const data = Buffer.from(`tree ${tree}\nparent ${parent}\nauthor ${author}\ncommitter ${author}\n\n${message}\n`);
    const oid = createHash("sha1").update(`commit ${data.length}\0`).update(data).digest("hex");
    return { type: /** @type {"commit"} */ ("commit"), data, oid };
  };
  const intermediate = commit(fixture.newOid, "Remote missing intermediate");
  const tip = commit(intermediate.oid, "Remote shallow managed tip");
  assert.equal(await fixtureGit(fixture.repo, ["cat-file", "--batch-check"], intermediate.oid + "\n"), intermediate.oid + " missing");
  assert.equal(await fixtureGit(fixture.repo, ["cat-file", "--batch-check"], tip.oid + "\n"), tip.oid + " missing");
  const packet = (/** @type {string} */ text) => (Buffer.byteLength(text) + 4).toString(16).padStart(4, "0") + text;
  const advertisement = packet("# service=git-upload-pack\n") + "0000" +
    packet(tip.oid + " HEAD\0multi_ack shallow symref=HEAD:refs/heads/main\n") +
    packet(tip.oid + " refs/heads/main\n") + "0000";
  return { oid: tip.oid, missingParent: intermediate.oid,
    shallow: { advertisement, pack: packGitObjects([...objects.filter(object => object.type !== "commit"), tip]) },
    full: { advertisement, pack: packGitObjects([...objects, intermediate, tip]) } };
}
