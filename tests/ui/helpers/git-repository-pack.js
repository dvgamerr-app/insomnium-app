import assert from "node:assert/strict";
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { probeIdentifier } from "./native-app.js";

/** Real complete history pack from one advanceFixture-owned repository.
 * @param {Awaited<ReturnType<import('./git-advance-fixture.js').advanceFixture>>} fixture
 * @param {string} [incomingOid] */
export async function gitRepositoryPack(fixture, incomingOid = fixture.newOid) {
  assert.ok(process.env.APPDATA);
  const expected = resolve(process.env.APPDATA, probeIdentifier, "git-v1", "repo-" + fixture.f.repositoryId);
  assert.equal((await realpath(fixture.repo)).toLowerCase(), expected.toLowerCase());
  assert.match(incomingOid, /^[0-9a-f]{40}$/);
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith("GIT_")) delete env[key];
  env.GIT_CONFIG_GLOBAL = "NUL";
  env.GIT_CONFIG_NOSYSTEM = "1";
  const child = Bun.spawn(["git", "-C", fixture.repo, "pack-objects", "--stdout", "--revs"], {
    env, stdin: new TextEncoder().encode(incomingOid + "\n"),
    stdout: "pipe", stderr: "pipe", windowsHide: true,
  });
  const [bytes, stderr, code] = await Promise.all([
    new Response(child.stdout).arrayBuffer(), new Response(child.stderr).text(), child.exited,
  ]);
  assert.equal(code, 0, stderr);
  const pack = Buffer.from(bytes);
  assert.equal(pack.subarray(0, 4).toString(), "PACK");
  const packet = (/** @type {string} */ text) => (Buffer.byteLength(text) + 4).toString(16).padStart(4, "0") + text;
  const advertisement = packet("# service=git-upload-pack\n") + "0000" +
    packet(incomingOid + " HEAD\0multi_ack symref=HEAD:refs/heads/main\n") +
    packet(incomingOid + " refs/heads/main\n") + "0000";
  return { advertisement, pack };
}
