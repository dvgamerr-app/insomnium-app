import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp } from "./helpers/native-app.js";
import { advanceFixture, fixtureGit } from "./helpers/git-advance-fixture.js";
import { serveReceivePack } from "./helpers/git-receive-pack.js";
import { gitRemoteSettingsPatch } from "../../src/lib/git-remote-settings.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
await withNativeApp("git-push-admission", async (context) => {
  const x = await advanceFixture(context);
  const remote = await serveReceivePack(context.output);
  /** @type {string[]} */
  const checks = [];
  try {
    const baseline = await context.invoke("load_workspace");
    Object.assign(
      baseline.resources.find(
        (/** @type {any} */ row) => row._id === x.f.repositoryId,
      ),
      gitRemoteSettingsPatch({
        url: remote.url,
        credentials: { kind: "anonymous" },
      }),
    );
    /** @param {string} sourceOid @param {string|null} expectedRemoteOid @param {(data:any,binding:any)=>void} [change] */
    async function prepare(
      sourceOid = x.f.oid,
      expectedRemoteOid = null,
      change = () => {},
    ) {
      const data = structuredClone(baseline);
      const binding = data.resources.find(
        (/** @type {any} */ row) => row._id === x.f.repositoryId,
      );
      const intent = {
        version: 1,
        phase: "submitted",
        operationId: crypto.randomUUID(),
        workspaceId: x.f.workspaceId,
        repositoryId: x.f.repositoryId,
        bindingId: binding._id,
        url: remote.url,
        sourceBranch: "main",
        sourceOid,
        destinationBranch: "main",
        expectedRemoteOid,
      };
      binding.nativePushIntent = intent;
      const request = {
        intent: structuredClone(intent),
        expectedBinding: structuredClone(binding),
      };
      change(data, binding);
      await context.invoke("save_workspace", { data });
      return request;
    }
    /** @param {()=>Promise<any>} action */
    async function unchanged(action) {
      const data = await context.invoke("load_workspace");
      const bytes = await readFile(x.workspace);
      const refs = await fixtureGit(x.repo, ["show-ref"]);
      const head = await readFile(join(x.repo, ".git", "HEAD"));
      const value = await action();
      assert.deepEqual(await context.invoke("load_workspace"), data);
      assert.deepEqual(await readFile(x.workspace), bytes);
      assert.equal(await fixtureGit(x.repo, ["show-ref"]), refs);
      assert.deepEqual(await readFile(join(x.repo, ".git", "HEAD")), head);
      return value;
    }
    /** @param {any} request @param {RegExp} error */
    async function refused(request, error) {
      const ads = remote.state.advertisements;
      const posts = remote.state.receivePosts;
      await unchanged(() =>
        assert.rejects(
          () => context.invoke("git_remote_push", { request }),
          error,
        ),
      );
      assert.equal(remote.state.advertisements, ads);
      assert.equal(remote.state.receivePosts, posts);
    }
    /** @param {any} request */
    async function retire(request) {
      const observed = await context.invoke("git_remote_push_inspect", {
        request: { push: request, attemptId: crypto.randomUUID() },
      });
      const retired = await unchanged(() =>
        context.invoke("git_remote_push_retire", {
          request: {
            push: request,
            attemptId: crypto.randomUUID(),
            expectedReceipt: observed.receipt,
          },
        }),
      );
      assert.equal(retired.phase, "retired");
      assert.equal(retired.stageName, null);
      return retired;
    }
    const changed = await prepare(x.f.oid, null, (_data, binding) => {
      binding.name = "Changed after pinned intent";
    });
    await refused(changed, /binding or operation changed/i);
    await assert.rejects(
      stat(
        join(x.directory, "git-push-v1", `push-${changed.intent.operationId}`),
      ),
      { code: "ENOENT" },
    );
    checks.push(
      "exact saved binding changed after request pin: no receipt, discovery, upload or local rewrite",
    );

    await refused(
      await prepare(x.f.oid, null, (data) => {
        data.resources.find(
          (/** @type {any} */ row) => row._id === x.f.workspaceId,
        ).isPrivate = true;
      }),
      /missing or private/i,
    );
    checks.push(
      "private collection admission refuses before network with full bytes/data/refs preserved",
    );
    await refused(
      await prepare(x.f.oid, null, (data, binding) => {
        data.resources.push({
          ...structuredClone(binding),
          _id: binding._id + "_duplicate",
        });
      }),
      /binding or operation changed/i,
    );
    checks.push(
      "duplicate saved repository binding refuses before discovery/upload",
    );
    for (const key of [
      "nativeFetchIntent",
      "nativeCreateIntent",
      "nativeRemoteCheckoutIntent",
    ]) {
      const request = await prepare(x.f.oid, null, (_data, binding) => {
        binding[key] = { operationId: crypto.randomUUID() };
      });
      request.expectedBinding[key] = structuredClone(
        (await context.invoke("load_workspace")).resources.find(
          (/** @type {any} */ row) => row._id === x.f.repositoryId,
        )[key],
      );
      await refused(request, /binding or operation changed/i);
    }
    checks.push(
      "pending Fetch/create/remote-checkout each refuse Push with exact matching saved binding and no network",
    );

    const sourceChanged = await prepare();
    await fixtureGit(x.repo, [
      "update-ref",
      "refs/heads/main",
      x.newOid,
      x.f.oid,
    ]);
    try {
      await refused(sourceChanged, /Local branch changed/i);
      const path = join(
        x.directory,
        "git-push-v1",
        `push-${sourceChanged.intent.operationId}`,
        "receipt.json",
      );
      const preparing = JSON.parse(await readFile(path, "utf8"));
      assert.equal(preparing.phase, "preparing");
      assert.equal(preparing.stageName, null);
      await retire(sourceChanged);
    } finally {
      await fixtureGit(x.repo, [
        "update-ref",
        "refs/heads/main",
        x.f.oid,
        x.newOid,
      ]);
    }
    checks.push(
      "source tip changes after review: no network, durable preparing receipt independently inspected/retired without rewriting changed ref",
    );

    const headChanged = await prepare();
    await fixtureGit(x.repo, [
      "symbolic-ref",
      "HEAD",
      "refs/heads/another-selected-branch",
    ]);
    try {
      await refused(headChanged, /Local branch changed/i);
      await retire(headChanged);
    } finally {
      await fixtureGit(x.repo, ["symbolic-ref", "HEAD", "refs/heads/main"]);
    }
    checks.push(
      "symbolic HEAD changes after review: no network; inspection/retirement preserve actual current HEAD",
    );

    await fixtureGit(x.repo, [
      "update-ref",
      "refs/heads/main",
      x.newOid,
      x.f.oid,
    ]);
    const advance = await prepare(x.newOid, null);
    const accepted = await unchanged(() =>
      context.invoke("git_remote_push", { request: advance }),
    );
    assert.equal(accepted.result.outcome, "accepted");
    assert.equal(await remote.tip(), x.newOid);
    assert.equal(remote.state.receivePosts, 1);
    await retire(advance);
    await fixtureGit(x.repo, [
      "update-ref",
      "refs/heads/main",
      x.f.oid,
      x.newOid,
    ]);
    const rewind = await prepare(x.f.oid, x.newOid);
    const rejected = await unchanged(() =>
      context.invoke("git_remote_push", { request: rewind }),
    );
    assert.equal(rejected.result.outcome, "nonFastForward");
    assert.equal(await remote.tip(), x.newOid);
    assert.equal(
      remote.state.receivePosts,
      1,
      "Non-fast-forward refuses before any second receive-pack POST",
    );
    await retire(rewind);
    assert.equal(remote.state.receivePosts, 1);
    assert.equal(remote.state.uploadPosts, 0);
    checks.push(
      `real non-fast-forward rewind: ${rejected.result.outcome} receipt, no force/no POST, independent server branch stays advanced; Inspect/retire never upload`,
    );
    await Bun.write(
      join(context.output, "acceptance.json"),
      JSON.stringify(
        {
          checks,
          server: remote.state,
          rewindReceipt: rejected,
          destinationOid: await remote.tip(),
          limits:
            "Native command admission and actual loopback non-force rewind; not frontend review races or provider/platform/fault acceptance.",
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ passed: checks.length, checks }));
  } finally {
    await remote.close();
  }
});
