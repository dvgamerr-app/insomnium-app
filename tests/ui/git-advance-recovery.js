import assert from "node:assert/strict";
import { readFile, writeFile, rm, realpath } from "node:fs/promises";
import { resolve, join } from "node:path";
import { withNativeApp, probeIdentifier } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { snapshotGitCollection } from "../../src/lib/git-collection.js";
import { lockProbeWorkspaceReplacement } from "./helpers/windows-workspace-lock.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";

await withNativeApp(
  "git-advance-recovery",
  async ({ page, invoke, output }) => {
    const f = await gitCollection({ page, invoke });
    assert.ok(process.env.APPDATA);
    const directory = resolve(process.env.APPDATA, probeIdentifier);
    assert.equal(
      (await realpath(directory)).toLowerCase(),
      directory.toLowerCase(),
    );
    const repo = join(directory, "git-v1", "repo-" + f.repositoryId);
    assert.equal((await realpath(repo)).toLowerCase(), repo.toLowerCase());
    const workspace = join(directory, "workspace-v1.json");
    const journalPath = join(directory, "git-transition-v1.json");
    assert.equal(await Bun.file(journalPath).exists(), false);
    const before = await invoke("load_workspace");
    const beforeBytes = await readFile(workspace);
    const after = structuredClone(before);
    after.resources.find((/** @type {any} */ r) => r._id === f.requestId).url =
      "https://example.invalid/advanced";

    // Git plumbing creates only fixture objects/refs inside this owned probe repo.
    // Native load_workspace, not this helper, performs the recovery under test.
    /** @param {string[]} args @param {string} [input] */
    async function git(args, input) {
      const env = { ...process.env };
      for (const name of Object.keys(env))
        if (name.startsWith("GIT_")) delete env[name];
      Object.assign(env, {
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "NUL",
        GIT_AUTHOR_NAME: f.author.name,
        GIT_AUTHOR_EMAIL: f.author.email,
        GIT_COMMITTER_NAME: f.author.name,
        GIT_COMMITTER_EMAIL: f.author.email,
      });
      const child = Bun.spawn(["git", "-C", repo, ...args], {
        env,
        stdin: input === undefined ? "ignore" : new TextEncoder().encode(input),
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
    /** @param {any} data @param {string} expected */
    async function commit(data, expected) {
      return await invoke("git_repository_commit", {
        repositoryId: f.repositoryId,
        input: {
          branch: "main",
          expectedHeadOid: expected,
          workspaceId: f.workspaceId,
          files: snapshotGitCollection(data.resources, f.workspaceId).files,
          authorName: f.author.name,
          authorEmail: f.author.email,
          message: "Advance recovery fixture",
        },
      });
    }
    const newOid = await commit(after, f.oid);
    const main = "refs/heads/main";
    await git(["update-ref", main, f.oid, newOid]);
    const incomingData = structuredClone(before);
    incomingData.resources.find(
      (/** @type {any} */ r) => r._id === f.requestId,
    ).name = "Incoming divergent fixture";
    const incomingOid = await commit(incomingData, f.oid);
    const tree = await git(["rev-parse", newOid + "^{tree}"]);
    const mergeOid = await git(
      ["commit-tree", tree, "-p", newOid, "-p", incomingOid],
      "Pinned merge recovery fixture\n",
    );
    await git(["update-ref", main, f.oid, incomingOid]);
    const target = "fixture/checkout-target";
    await git(["update-ref", "refs/heads/" + target, newOid]);
    const baseJournal = {
      schemaVersion: 2,
      operationId: crypto.randomUUID(),
      repositoryId: f.repositoryId,
      workspaceId: f.workspaceId,
      sourceBranch: "main",
      sourceOid: f.oid,
      targetBranch: "main",
      targetOid: newOid,
      beforeWorkspace: before,
      afterWorkspace: after,
      advance: {
        kind: "fastForward",
        incomingOid: newOid,
        mergeBaseOid: f.oid,
      },
    };
    /** @type {string|undefined} */ let ownedJournal;
    /** @type {string[]} */ const passed = [];

    /** @param {string} name @param {any} record @param {string} tip
     * @param {any} current @param {any} expected @param {RegExp} [refusal]
     * @param {string} [head] @param {boolean} [retain] */
    async function recover(
      name,
      record,
      tip,
      current,
      expected,
      refusal,
      head,
      retain = false,
    ) {
      assert.equal(await Bun.file(journalPath).exists(), false);
      await git(["symbolic-ref", "HEAD", main]);
      await git(["update-ref", main, tip]);
      if (head === "detached")
        await git(["update-ref", "--no-deref", "HEAD", tip]);
      else if (head) await git(["symbolic-ref", "HEAD", head]);
      const headBytes = await readFile(join(repo, ".git", "HEAD"));
      const currentBytes = Buffer.from(JSON.stringify(current, null, 3) + "\n");
      await writeFile(workspace, currentBytes);
      const bytes = JSON.stringify(record);
      await writeFile(journalPath, bytes, { flag: "wx" });
      ownedJournal = bytes;
      await Bun.write(join(output, name + "-journal.json"), bytes);
      if (refusal) {
        let failure;
        try {
          await invoke("load_workspace");
        } catch (error) {
          failure = String(error);
        }
        assert.match(failure || "", refusal);
        assert.deepEqual(await readFile(workspace), currentBytes);
        assert.equal(await readFile(journalPath, "utf8"), bytes);
        // Ordinary writes must remain closed while recovery is unresolved.
        await assert.rejects(() => invoke("save_workspace", { data: before }));
        assert.equal(await readFile(journalPath, "utf8"), bytes);
        assert.deepEqual(await readFile(workspace), currentBytes);
        await Bun.write(join(output, name + "-refusal.txt"), failure || "");
        // Remove only this exact synthetic record, never production recovery data.
        if (!retain) await rm(journalPath);
      } else {
        assert.deepEqual(await invoke("load_workspace"), expected);
        assert.equal(await Bun.file(journalPath).exists(), false);
        assert.deepEqual(
          JSON.parse(await readFile(workspace, "utf8")),
          expected,
        );
        if (JSON.stringify(current) === JSON.stringify(expected))
          assert.deepEqual(await readFile(workspace), currentBytes);
      }
      if (!retain) ownedJournal = undefined;
      assert.deepEqual(await readFile(join(repo, ".git", "HEAD")), headBytes);
      assert.equal(
        await git(["rev-parse", main]),
        tip,
        "Recovery never moves refs",
      );
      passed.push(name);
      await Bun.write(
        join(output, "progress.json"),
        JSON.stringify({ passed }, null, 2),
      );
    }
    try {
      await assert.rejects(() =>
        invoke("git_repository_checkout", {
          input: {
            journal: baseJournal,
            authorName: f.author.name,
            authorEmail: f.author.email,
          },
        }),
      );
      assert.equal(await Bun.file(journalPath).exists(), false);
      assert.deepEqual(await readFile(workspace), beforeBytes);
      passed.push("checkout-refuses-schema2");
      await recover("old-before", baseJournal, f.oid, before, before);
      await recover("new-before", baseJournal, newOid, before, after);
      await recover("new-after", baseJournal, newOid, after, after);
      await recover(
        "old-after",
        baseJournal,
        f.oid,
        after,
        null,
        /unambiguous recorded state/,
      );
      await recover(
        "unrelated-tip",
        baseJournal,
        incomingOid,
        before,
        null,
        /unambiguous recorded state/,
      );
      await recover(
        "detached-head",
        baseJournal,
        newOid,
        before,
        null,
        /HEAD changed or is detached/,
        "detached",
      );
      await recover(
        "changed-head",
        baseJournal,
        newOid,
        before,
        null,
        /HEAD changed or is detached/,
        "refs/heads/" + target,
      );
      const unrelated = structuredClone(before);
      unrelated.resources.find(
        (/** @type {any} */ r) => r._id === f.requestId,
      ).description = "Unrecorded user edit must survive";
      await recover(
        "unrelated-workspace",
        baseJournal,
        newOid,
        unrelated,
        null,
        /unambiguous recorded state/,
      );
      const foreign = structuredClone(after);
      foreign.settings = { ...foreign.settings, unexpected: true };
      await recover(
        "foreign-envelope",
        { ...baseJournal, afterWorkspace: foreign },
        newOid,
        before,
        null,
        /preserve all other workspace data/,
      );
      await recover(
        "invalid-pinned-input",
        {
          ...baseJournal,
          advance: { ...baseJournal.advance, incomingOid },
        },
        newOid,
        before,
        null,
        /fast-forward inputs/,
      );
      await recover(
        "invalid-operation",
        { ...baseJournal, targetBranch: target },
        newOid,
        before,
        null,
        /operation or branch\/OID relationship/,
      );
      const mergeJournal = {
        ...baseJournal,
        sourceOid: newOid,
        targetOid: mergeOid,
        advance: { kind: "merge", incomingOid, mergeBaseOid: f.oid },
      };
      await recover("merge-old-before", mergeJournal, newOid, before, before);
      await recover("merge-new-before", mergeJournal, mergeOid, before, after);
      await recover("merge-new-after", mergeJournal, mergeOid, after, after);
      await recover(
        "merge-invalid-base",
        {
          ...mergeJournal,
          advance: { ...mergeJournal.advance, mergeBaseOid: newOid },
        },
        mergeOid,
        before,
        null,
        /pinned parents\/base/,
      );

      const { advance: _, ...checkoutJournal } = baseJournal;
      const v1 = { ...checkoutJournal, schemaVersion: 1, targetBranch: target };
      await recover("v1-source-before", v1, f.oid, before, before);
      // Version1 recovery still recognizes the target symbolic HEAD and does not
      // reinterpret its OID as a same-branch operation.
      await writeFile(workspace, beforeBytes);
      const v1Bytes = JSON.stringify(v1);
      await writeFile(journalPath, v1Bytes, { flag: "wx" });
      ownedJournal = v1Bytes;
      await git(["symbolic-ref", "HEAD", "refs/heads/" + target]);
      assert.deepEqual(await invoke("load_workspace"), after);
      assert.equal(await Bun.file(journalPath).exists(), false);
      ownedJournal = undefined;
      assert.equal(await git(["symbolic-ref", "HEAD"]), "refs/heads/" + target);
      passed.push("v1-target-before");

      // A real OS replacement refusal must retain both current bytes and journal.
      const held = await lockProbeWorkspaceReplacement();
      try {
        await recover(
          "native-write-refusal",
          baseJournal,
          newOid,
          before,
          null,
          /os error 5/,
          undefined,
          true,
        );
      } finally {
        held.release();
      }
      assert.equal(await readFile(journalPath, "utf8"), ownedJournal);
      assert.deepEqual(await invoke("load_workspace"), after);
      assert.equal(await Bun.file(journalPath).exists(), false);
      assert.equal(await git(["rev-parse", main]), newOid);
      ownedJournal = undefined;
      passed.push("native-write-retry-same-journal");
      await git(["symbolic-ref", "HEAD", main]);
      await page.reload();
      await page.getByLabel("Request URL", { exact: true }).waitFor();
      assert.equal(
        await page.getByLabel("Request URL", { exact: true }).inputValue(),
        "https://example.invalid/advanced",
      );
      await page.screenshot({ path: join(output, "recovered-workspace.png") });
      await Bun.write(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            passed: true,
            checks: passed,
            scope:
              "Synthetic exact journal/commit states recovered through native load_workspace; actual OS write refusal. No public advance writer, network pull/merge or process-crash claim.",
          },
          null,
          2,
        ),
      );
    } finally {
      if (
        ownedJournal !== undefined &&
        (await readFile(journalPath, "utf8")) === ownedJournal
      )
        await rm(journalPath);
      await git(["symbolic-ref", "HEAD", main]);
    }
  },
);
