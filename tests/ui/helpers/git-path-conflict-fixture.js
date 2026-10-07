import { fixtureGit, fixtureGitBytes } from "./git-advance-fixture.js";

/** Real rename/rename and file/directory complete-tree histories in an owned repo.
 * @param {Awaited<ReturnType<import('./git-advance-fixture.js').advanceFixture>>} x */
export async function pathConflictFixture(x) {
  const managed = await fixtureGitBytes(x.repo, ["ls-tree", "-z", x.f.oid + "^{tree}"]);
  const text = Array.from({ length: 40 }, (_, i) => `Unique shared rename line ${i}\n`).join("");
  async function blob(/** @type {string} */ content) { return fixtureGit(x.repo, ["hash-object", "-w", "--stdin"], content); }
  async function tree(/** @type {string[]} */ entries) {
    return fixtureGit(x.repo, ["mktree", "-z"], Buffer.concat([managed, Buffer.from(entries.join("\0") + "\0")]));
  }
  const commit = (/** @type {string} */ root, /** @type {string} */ parent, /** @type {string} */ message) =>
    fixtureGit(x.repo, ["commit-tree", root, "-p", parent], message + "\n");
  const original = await blob(text);
  const base = await commit(await tree([`100644 blob ${original}\trename-original.txt`]), x.f.oid, "Rename base");
  const ours = await blob(text.replace("line 0", "current change 0"));
  const theirs = await blob(text.replace("line 0", "incoming change 0"));
  const left = await commit(await tree([`100755 blob ${ours}\trename-current.txt`]), base, "Current rename");
  const right = await commit(await tree([`100644 blob ${theirs}\trename-incoming.txt`]), base, "Incoming rename");
  const file = await blob("Current file at collision\n");
  const child = await blob("Incoming directory child\n");
  const subtree = await fixtureGit(x.repo, ["mktree"], `100644 blob ${child}\tchild.txt\n`);
  const fileTip = await commit(await tree([`100644 blob ${file}\tcollision`]), x.f.oid, "Current collision file");
  const directoryTip = await commit(await tree([`040000 tree ${subtree}\tcollision`]), x.f.oid, "Incoming collision directory");
  return { rename: { left, right, base, original, ours, theirs },
    directory: { left: fileTip, right: directoryTip, base: x.f.oid, file, child } };
}
