import assert from "node:assert/strict";
import { fixtureGit, fixtureGitBytes } from "./git-advance-fixture.js";

/** Complete managed commits plus byte paths, missing gitlinks and preview limits.
 * @param {Awaited<ReturnType<import('./git-advance-fixture.js').advanceFixture>>} fixture */
export async function conflictEdgeFixture(fixture) {
  const rawPath = Buffer.concat([Buffer.from([0xff]), Buffer.from("-raw.txt")]);
  const secondRawPath = Buffer.concat([Buffer.from([0xfe]), Buffer.from("-raw.txt")]);
  const budgetSize = 224 * 1024;
  const largeSize = 256 * 1024 + 1;
  const gitlinks = ["1".repeat(40), "2".repeat(40)];
  for (const id of gitlinks) assert.equal(await fixtureGit(fixture.repo, ["cat-file", "--batch-check"], id + "\n"), id + " missing");
  /** @param {number} side */
  async function commit(side) {
    const base = await fixtureGitBytes(fixture.repo, ["ls-tree", "-z", fixture.f.oid + "^{tree}"]);
    const chunks = [base];
    const records = /** @type {{path:Buffer,oid:string,mode:string,type:string,size:number|null}[]} */ ([]);
    async function entry(/** @type {Buffer} */ path, /** @type {string} */ mode, /** @type {string|null} */ text, /** @type {string} */ id = "") {
      const type = mode === "160000" ? "commit" : "blob";
      const oid = text === null ? id : await fixtureGit(fixture.repo, ["hash-object", "-w", "--stdin"], text);
      chunks.push(Buffer.concat([Buffer.from(`${mode} ${type} ${oid}\t`), path, Buffer.from([0])]));
      records.push({ path, oid, mode, type, size: text === null ? null : Buffer.byteLength(text) });
    }
    await entry(Buffer.from("01-large.txt"), side ? "100755" : "100644", String(side).repeat(largeSize + side));
    await entry(Buffer.from("02-submodule"), "160000", null, gitlinks[side]);
    for (let i = 0; i < 6; i++) {
      const prefix = `${side ? "Incoming" : "Current"} budget ${i}\n`;
      await entry(Buffer.from(`03-budget-${i}.txt`), "100644", prefix + String(side).repeat(budgetSize - Buffer.byteLength(prefix)));
    }
    await entry(Buffer.from("04-link"), "120000", side ? "remote-target" : "local-target");
    await entry(rawPath, side ? "100644" : "100755", side ? "Incoming byte path\n" : "Current byte path\n");
    await entry(secondRawPath, "100644", side ? "Incoming second byte path\n" : "Current second byte path\n");
    await entry(Buffer.from(side ? "remote-only.txt" : "local-only.txt"), "100644", side ? "Remote sentinel\n" : "Local sentinel\n");
    const tree = await fixtureGit(fixture.repo, ["mktree", "-z"], Buffer.concat(chunks));
    const oid = await fixtureGit(fixture.repo, ["commit-tree", tree, "-p", fixture.f.oid], "Conflict edge fixture " + side + "\n");
    return { oid, records };
  }
  return { current: await commit(0), incoming: await commit(1), rawPath, secondRawPath, gitlinks, budgetSize, largeSize };
}

/** NUL-delimited tree records without lossy decoding or pathname quoting.
 * @param {Buffer} bytes */
export function rawTreeEntries(bytes) {
  const entries = /** @type {{path:Buffer,mode:string,type:string,oid:string}[]} */ ([]);
  let offset = 0;
  while (offset < bytes.length) {
    const tab = bytes.indexOf(9, offset), end = bytes.indexOf(0, tab);
    assert.ok(tab > offset && end > tab);
    const match = bytes.subarray(offset, tab).toString("ascii").match(/^([0-7]{6}) (blob|tree|commit) ([0-9a-f]{40})$/);
    assert.ok(match);
    entries.push({ mode: match[1], type: match[2], oid: match[3], path: bytes.subarray(tab + 1, end) });
    offset = end + 1;
  }
  return entries;
}
