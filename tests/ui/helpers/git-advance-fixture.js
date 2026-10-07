import assert from "node:assert/strict";
import { realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { gitCollection } from "./git-fixture.js";
import { probeIdentifier } from "./native-app.js";
import { snapshotGitCollection } from "../../../src/lib/git-collection.js";

/** Git plumbing for owned synthetic objects only, with ambient Git config removed.
 * @param {string} repo @param {string[]} args @param {string|Uint8Array} [input] */
export async function fixtureGit(repo, args, input) {
  const env = { ...process.env };
  for (const name of Object.keys(env))
    if (name.startsWith("GIT_")) delete env[name];
  Object.assign(env, {
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "NUL",
    GIT_AUTHOR_NAME: "Advance fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.invalid",
    GIT_COMMITTER_NAME: "Advance fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.invalid",
  });
  const child = Bun.spawn(["git", "-C", repo, ...args], {
    env,
    stdin: input === undefined ? "ignore" : typeof input === "string" ? new TextEncoder().encode(input) : input,
    stdout: "pipe",
    stderr: "pipe",
    windowsHide: true,
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  assert.equal(code, 0, stderr);
  return stdout.trim();
}

/** @param {import('./native-app.js').ScenarioContext} context */
export async function advanceFixture(context) {
  const f = await gitCollection(context);
  assert.ok(process.env.APPDATA);
  const directory = resolve(process.env.APPDATA, probeIdentifier);
  assert.equal(
    (await realpath(directory)).toLowerCase(),
    directory.toLowerCase(),
  );
  const repo = join(directory, "git-v1", "repo-" + f.repositoryId);
  assert.equal((await realpath(repo)).toLowerCase(), repo.toLowerCase());
  const before = await context.invoke("load_workspace");
  const after = structuredClone(before);
  after.resources.find((/** @type {any} */ r) => r._id === f.requestId).url =
    "https://example.invalid/advance-writer";
  const newOid = await context.invoke("git_repository_commit", {
    repositoryId: f.repositoryId,
    input: {
      branch: "main",
      expectedHeadOid: f.oid,
      workspaceId: f.workspaceId,
      files: snapshotGitCollection(after.resources, f.workspaceId).files,
      authorName: f.author.name,
      authorEmail: f.author.email,
      message: "Advance writer fixture",
    },
  });
  await fixtureGit(repo, ["update-ref", "refs/heads/main", f.oid, newOid]);
  const journal = {
    schemaVersion: 2,
    operationId: crypto.randomUUID(),
    repositoryId: f.repositoryId,
    workspaceId: f.workspaceId,
    sourceBranch: "main",
    targetBranch: "main",
    sourceOid: f.oid,
    targetOid: newOid,
    beforeWorkspace: before,
    afterWorkspace: after,
    advance: { kind: "fastForward", incomingOid: newOid, mergeBaseOid: f.oid },
  };
  const input = {
    journal,
    authorName: f.author.name,
    authorEmail: f.author.email,
  };
  return {
    f,
    directory,
    repo,
    before,
    after,
    newOid,
    journal,
    input,
    workspace: join(directory, "workspace-v1.json"),
    journalPath: join(directory, "git-transition-v1.json"),
    marker: join(repo, ".git", "insomnium-advance-ref-locks-v1.json"),
    branchLock: join(repo, ".git", "refs", "heads", "main.lock"),
    headLock: join(repo, ".git", "HEAD.lock"),
  };
}

/** @param {Awaited<ReturnType<typeof advanceFixture>>} fixture */
export async function assertAdvanceCleanup(fixture) {
  for (const path of [
    fixture.journalPath,
    fixture.marker,
    fixture.branchLock,
    fixture.headLock,
    join(fixture.repo, ".git", "insomnium-restore-ref-locks-v1.json"),
  ])
    assert.equal(
      await Bun.file(path).exists(),
      false,
      "Unexpected retained file: " + path,
    );
}
