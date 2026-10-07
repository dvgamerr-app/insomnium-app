import assert from "node:assert/strict";
import {
  mkdir,
  readFile,
  readdir,
  realpath,
  rmdir,
  stat,
  unlink,
} from "node:fs/promises";
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
    const reserved = await prepare();
    const receiptRoot = join(x.directory, "git-push-v1");
    await mkdir(receiptRoot, { recursive: true });
    assert.equal(
      (await realpath(receiptRoot)).toLowerCase(),
      receiptRoot.toLowerCase(),
    );
    const reservedDirectory = join(
      receiptRoot,
      `push-${reserved.intent.operationId}`,
    );
    await mkdir(reservedDirectory); // Exclusive creation; never reuse an old operation.
    assert.equal(
      (await realpath(reservedDirectory)).toLowerCase(),
      reservedDirectory.toLowerCase(),
    );
    const sentinelPath = join(reservedDirectory, "owned-scenario-sentinel");
    const sentinel = crypto.randomUUID();
    await Bun.write(sentinelPath, sentinel);
    const stagesBefore = (
      await readdir(join(x.directory, "git-fetch-v1"))
    ).sort();
    const assertReserved = async () => {
      assert.deepEqual(await readdir(reservedDirectory), [
        "owned-scenario-sentinel",
      ]);
      assert.equal(await Bun.file(sentinelPath).text(), sentinel);
      assert.deepEqual(
        (await readdir(join(x.directory, "git-fetch-v1"))).sort(),
        stagesBefore,
      );
      await assert.rejects(stat(join(reservedDirectory, "receipt.json")), {
        code: "ENOENT",
      });
    };
    try {
      await refused(reserved, /already reserved or unconfirmed/i);
      await assertReserved();
      const observed = await unchanged(() =>
        context.invoke("git_remote_push_inspect", {
          request: { push: reserved, attemptId: crypto.randomUUID() },
        }),
      );
      assert.equal(observed.receipt, null);
      assert.equal(observed.observedRemoteOid, null);
      const advertisements = remote.state.advertisements;
      await unchanged(() =>
        assert.rejects(
          () =>
            context.invoke("git_remote_push_retire", {
              request: {
                push: reserved,
                attemptId: crypto.randomUUID(),
                expectedReceipt: observed.receipt,
              },
            }),
          /directory is unconfirmed.*retain tracking and material/i,
        ),
      );
      assert.equal(remote.state.advertisements, advertisements);
      assert.equal(remote.state.receivePosts, 0);
      await assertReserved();
    } finally {
      // Remove only this exclusive fixture's exact sentinel and now-empty directory.
      // No recursive deletion, native material, older receipt, or foreign file adoption.
      assert.equal(await Bun.file(sentinelPath).text(), sentinel);
      await unlink(sentinelPath);
      await rmdir(reservedDirectory);
    }
    const retiredReserved = await retire(reserved); // Fresh observation after explicit fixture removal.
    assert.equal(retiredReserved.phase, "retired");
    assert.equal(retiredReserved.result, null);
    assert.equal(remote.state.receivePosts, 0);
    assert.deepEqual(
      (await readdir(join(x.directory, "git-fetch-v1"))).sort(),
      stagesBefore,
    );
    checks.push(
      "preexisting receiptless operation directory: Push refuses before network/snapshot/receipt; fresh Inspect observes absent remote but retirement refuses adoption/cleanup, exact sentinel/full workspace/refs preserved; exclusive fixture removal then fresh Inspect allows tombstone without upload",
    );
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
    const tree = await fixtureGit(x.repo, ["rev-parse", x.newOid + "^{tree}"]);
    const localNext = await fixtureGit(
      x.repo,
      ["commit-tree", tree, "-p", x.newOid],
      "Pinned local next commit\n",
    );
    const concurrent = await fixtureGit(
      remote.repo,
      ["commit-tree", tree, "-p", x.newOid],
      "Independent server advertisement race\n",
    );
    await fixtureGit(x.repo, [
      "update-ref",
      "refs/heads/main",
      localNext,
      x.f.oid,
    ]);
    const negotiationRace = await prepare(localNext, x.newOid);
    const advertisementsBeforeRace = remote.state.advertisements;
    remote.afterNextReceiveAdvertisement(async () => {
      assert.equal(await remote.tip(), x.newOid);
      await fixtureGit(remote.repo, [
        "update-ref",
        "refs/heads/main",
        concurrent,
        x.newOid,
      ]);
    });
    const staleNegotiation = await unchanged(() =>
      context.invoke("git_remote_push", { request: negotiationRace }),
    );
    assert.equal(
      staleNegotiation.result.advertisedRemoteOid,
      x.newOid,
      "Initial worker advertisement must still contain the pinned old ref",
    );
    assert.equal(staleNegotiation.result.outcome, "stale");
    assert.ok(
      remote.state.advertisements >= advertisementsBeforeRace + 2,
      "Actual Push negotiation must read a second independent advertisement",
    );
    assert.equal(
      remote.state.receivePosts,
      1,
      "Negotiation pin refuses before a second receive POST",
    );
    assert.equal(await remote.tip(), concurrent);
    await retire(negotiationRace);
    assert.equal(await remote.tip(), concurrent);
    assert.equal(remote.state.receivePosts, 1);
    checks.push(
      "actual server ref changes after captured worker advertisement: fresh negotiation old-OID pin refuses stale before POST, independent concurrent ref/full local state preserved",
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
