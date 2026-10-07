import assert from "node:assert/strict";
import { fixtureGit } from "./git-advance-fixture.js";

/** Independent complete managed trees with two actual common ancestors.
 * All writes stay in the already validated, uniquely owned scenario repository.
 * @param {Awaited<ReturnType<import('./git-advance-fixture.js').advanceFixture>>} fixture
 * @param {boolean} [conflictingBases] */
export async function crissCrossFixture(fixture, conflictingBases = false) {
  const git = (/** @type {string[]} */ args, /** @type {string} */ input = "") => fixtureGit(fixture.repo, args, input);
  const base = await git(["ls-tree", fixture.f.oid + "^{tree}"]);
  async function tree(/** @type {{name:string,text:string}[]} */ files) {
    const entries = base.split("\n");
    const blobs = /** @type {Record<string,string>} */ ({});
    for (const file of files) {
      blobs[file.name] = await git(["hash-object", "-w", "--stdin"], file.text);
      entries.push(`100644 blob ${blobs[file.name]}\t${file.name}`);
    }
    return { oid: await git(["mktree"], entries.join("\n") + "\n"), blobs };
  }
  const commit = (/** @type {string} */ treeId, /** @type {string[]} */ parents, /** @type {string} */ message) =>
    git(["commit-tree", treeId, ...parents.flatMap(parent => ["-p", parent])], message + "\n");
  const aFiles = [{ name: conflictingBases ? "conflict.txt" : "base-a.txt", text: "Base A\n" }];
  const bFiles = [{ name: conflictingBases ? "conflict.txt" : "base-b.txt", text: "Base B\n" }];
  const aTree = await tree(aFiles), bTree = await tree(bFiles);
  const a = await commit(aTree.oid, [fixture.f.oid], "Actual base A");
  const b = await commit(bTree.oid, [fixture.f.oid], "Actual base B");
  const leftFiles = conflictingBases ? [{ name: "conflict.txt", text: "Left resolution\n" }] : [...aFiles, ...bFiles];
  const rightFiles = conflictingBases ? [{ name: "conflict.txt", text: "Right resolution\n" }] : [...aFiles, ...bFiles];
  const leftTree = await tree(leftFiles), rightTree = await tree(rightFiles);
  const leftJoin = await commit(leftTree.oid, [a, b], "Left criss-cross join");
  const rightJoin = await commit(rightTree.oid, [b, a], "Right criss-cross join");
  const leftTipTree = await tree([...leftFiles, { name: "left-only.txt", text: "Preserve left\n" }]);
  const rightTipTree = await tree([...rightFiles, { name: "right-only.txt", text: "Preserve right\n" }]);
  const left = await commit(leftTipTree.oid, [leftJoin], "Left selected tip");
  const right = await commit(rightTipTree.oid, [rightJoin], "Right selected tip");
  const bases = [a, b].sort();
  assert.deepEqual((await git(["merge-base", "--all", left, right])).split("\n").sort(), bases);
  return { left, right, bases, aTree, bTree, leftTipTree, rightTipTree };
}
