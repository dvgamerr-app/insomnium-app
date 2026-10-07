import assert from "node:assert/strict";
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { probeIdentifier } from "./native-app.js";
import { fixtureGitBytes } from "./git-advance-fixture.js";

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

/** Actual upload-pack advertisement from a fresh native-initialized empty probe repo.
 * @param {string} repositoryId @param {string} repo */
export async function gitEmptyRepositoryAdvertisement(repositoryId, repo) {
  assert.ok(process.env.APPDATA);
  const expected = resolve(process.env.APPDATA, probeIdentifier, "git-v1", "repo-" + repositoryId);
  assert.equal((await realpath(repo)).toLowerCase(), expected.toLowerCase());
  const advertised = await fixtureGitBytes(repo, ["upload-pack", "--stateless-rpc", "--advertise-refs", "."]);
  // Git's no-refs packet advertises capabilities against zero-id, not an object.
  // Preserve actual upload-pack bytes; never manufacture a successful pack.
  const length = Number.parseInt(advertised.subarray(0, 4).toString(), 16);
  assert.ok(length > 4 && length === advertised.length - 4);
  assert.match(advertised.subarray(4, length).toString(), /^0{40} capabilities\^\{\}\0[^\n]+\n?$/);
  assert.equal(advertised.subarray(length).toString(), "0000");
  const service = "# service=git-upload-pack\n";
  return { advertisement: (Buffer.byteLength(service) + 4).toString(16).padStart(4, "0") + service + "0000" + advertised.toString(), pack: Buffer.alloc(0) };
}
