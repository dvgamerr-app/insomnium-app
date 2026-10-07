import assert from "node:assert/strict";
import { readFile, writeFile, unlink, stat } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp } from "./helpers/native-app.js";
import { advanceFixture, fixtureGit } from "./helpers/git-advance-fixture.js";
import { serveReceivePack } from "./helpers/git-receive-pack.js";
import { gitRemoteSettingsPatch } from "../../src/lib/git-remote-settings.js";
import { lockProbePushPayload } from "./helpers/windows-workspace-lock.js";

// Native command contract only. Product review/UI/held Send/lifecycle acceptance
// remain required separately; this does not claim complete Push UX.
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
/** @type {{request:any,retired:any,beforeRetire:any,beforeRetireBytes:Uint8Array,workspace:string,outgoing:string,pid:number}|undefined} */
let restartProof;
await withNativeApp("git-push-native-contract", async (context) => {
  const x = await advanceFixture(context);
  const remote = await serveReceivePack(context.output);
  const proofs = [];
  try {
    /** @param {string} sourceOid @param {string|null} expectedRemoteOid */
    async function savedRequest(sourceOid, expectedRemoteOid) {
      const data = await context.invoke("load_workspace");
      const binding = data.resources.find(
        (/** @type {any} */ row) => row._id === x.f.repositoryId,
      );
      Object.assign(
        binding,
        gitRemoteSettingsPatch({
          url: remote.url,
          credentials: { kind: "anonymous" },
        }),
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
      await context.invoke("save_workspace", { data });
      return { intent, expectedBinding: structuredClone(binding) };
    }
    /** @param {any} request */
    async function preserved(request) {
      const before = await context.invoke("load_workspace");
      const bytes = await readFile(x.workspace);
      const refs = await fixtureGit(x.repo, ["show-ref"]);
      const head = await readFile(join(x.repo, ".git", "HEAD"));
      const result = await context.invoke("git_remote_push", { request });
      assert.deepEqual(await context.invoke("load_workspace"), before);
      assert.deepEqual(await readFile(x.workspace), bytes);
      assert.equal(await fixtureGit(x.repo, ["show-ref"]), refs);
      assert.deepEqual(await readFile(join(x.repo, ".git", "HEAD")), head);
      return result;
    }
    const first = await savedRequest(x.f.oid, null);
    const created = await preserved(first);
    assert.equal(created.phase, "finished");
    assert.equal(created.result.outcome, "accepted");
    assert.equal(await remote.tip(), x.f.oid);
    assert.equal(remote.state.receivePosts, 1);
    assert.equal(
      await fixtureGit(remote.repo, ["ls-tree", "-r", x.f.oid]),
      await fixtureGit(x.repo, ["ls-tree", "-r", x.f.oid]),
    );
    proofs.push(
      "new branch: real receive-pack/exact server commit and complete tree; full local bytes/refs/HEAD preserved",
    );

    // Same-operation repeats may be refused by the bounded job registry or
    // reconcile the durable receipt; neither may send another receive-pack POST.
    try {
      assert.deepEqual(
        await context.invoke("git_remote_push", { request: first }),
        created,
      );
    } catch (error) {
      assert.match(String(error), /already been used/);
    }
    const observed = await context.invoke("git_remote_push_inspect", {
      request: { push: first, attemptId: crypto.randomUUID() },
    });
    assert.equal(observed.observedRemoteOid, x.f.oid);
    assert.equal(observed.matchesPinnedCommit, true);
    assert.equal(remote.state.receivePosts, 1);
    proofs.push(
      "repeat/Inspect: independent fresh advertisement, no resubmission",
    );

    const equal = await preserved(await savedRequest(x.f.oid, x.f.oid));
    assert.equal(equal.result.outcome, "unchanged");
    assert.equal(remote.state.receivePosts, 1);
    proofs.push(
      "equal remote branch: no upload and complete local preservation",
    );

    await fixtureGit(x.repo, [
      "update-ref",
      "refs/heads/main",
      x.newOid,
      x.f.oid,
    ]);
    const advanced = await preserved(await savedRequest(x.newOid, x.f.oid));
    assert.equal(advanced.result.outcome, "accepted");
    assert.equal(await remote.tip(), x.newOid);
    assert.equal(remote.state.receivePosts, 2);
    assert.equal(
      await fixtureGit(remote.repo, ["rev-parse", x.newOid + "^"]),
      x.f.oid,
    );
    proofs.push(
      "normal advance: real server complete ancestry, exact independent destination OID",
    );

    const stale = await preserved(await savedRequest(x.newOid, x.f.oid));
    assert.equal(stale.result.outcome, "stale");
    assert.equal(remote.state.receivePosts, 2);
    assert.equal(await remote.tip(), x.newOid);
    proofs.push(
      "stale expected remote: refuse without upload or local mutation",
    );
    const tree = await fixtureGit(x.repo, ["rev-parse", x.newOid + "^{tree}"]);
    const third = await fixtureGit(
      x.repo,
      ["commit-tree", tree, "-p", x.newOid],
      "Unknown Push response fixture\n",
    );
    await fixtureGit(x.repo, [
      "update-ref",
      "refs/heads/main",
      third,
      x.newOid,
    ]);
    const uncertain = await savedRequest(third, x.newOid);
    remote.state.dropNextReply = true;
    const lost = await preserved(uncertain);
    assert.equal(lost.result.outcome, "unknown");
    assert.equal(await remote.tip(), third);
    assert.equal(remote.state.receivePosts, 3);
    assert.equal(
      await fixtureGit(remote.repo, ["rev-parse", third + "^"]),
      x.newOid,
    );
    const inspected = await context.invoke("git_remote_push_inspect", {
      request: { push: uncertain, attemptId: crypto.randomUUID() },
    });
    assert.equal(inspected.observedRemoteOid, third);
    assert.equal(inspected.matchesPinnedCommit, true);
    assert.equal(inspected.receipt.result.outcome, "unknown");
    assert.equal(remote.state.receivePosts, 3);
    try {
      assert.deepEqual(
        await context.invoke("git_remote_push", { request: uncertain }),
        lost,
      );
    } catch (error) {
      assert.match(String(error), /already been used/);
    }
    assert.equal(remote.state.receivePosts, 3);
    proofs.push(
      "completed real receive-pack then HTTP503: unknown result retained; fresh Inspect observes server, no blind resend",
    );
    const fourth = await fixtureGit(
      x.repo,
      ["commit-tree", tree, "-p", third],
      "Server policy rejection fixture\n",
    );
    await fixtureGit(x.repo, ["update-ref", "refs/heads/main", fourth, third]);
    const rejectRequest = await savedRequest(fourth, third);
    remote.state.rejectNextPush = true;
    const rejected = await preserved(rejectRequest);
    assert.equal(rejected.result.outcome, "rejected");
    assert.equal(
      await readFile(join(remote.repo, ".owned-receive-rejection-ran"), "utf8"),
      "executed\n",
    );
    assert.equal(await remote.tip(), third);
    assert.equal(remote.state.receivePosts, 4);
    const rejectedObservation = await context.invoke(
      "git_remote_push_inspect",
      { request: { push: rejectRequest, attemptId: crypto.randomUUID() } },
    );
    assert.equal(rejectedObservation.observedRemoteOid, third);
    assert.equal(rejectedObservation.matchesPinnedCommit, false);
    assert.equal(remote.state.receivePosts, 4);
    proofs.push(
      "actual server pre-receive policy rejection: callback rejected status despite transport completion, independent unchanged server ref, full local preservation/no resend",
    );
    const concurrent = await fixtureGit(
      remote.repo,
      ["commit-tree", tree, "-p", third],
      "Independent concurrent remote update fixture\n",
    );
    const raceRequest = await savedRequest(fourth, third);
    remote.beforeNextReceive(async () => {
      assert.equal(await remote.tip(), third);
      await fixtureGit(remote.repo, [
        "update-ref",
        "refs/heads/main",
        concurrent,
        third,
      ]);
    });
    const raced = await preserved(raceRequest);
    assert.equal(raced.result.outcome, "rejected");
    assert.equal(await remote.tip(), concurrent);
    assert.equal(remote.state.receivePosts, 5);
    const raceObservation = await context.invoke("git_remote_push_inspect", {
      request: { push: raceRequest, attemptId: crypto.randomUUID() },
    });
    assert.equal(raceObservation.observedRemoteOid, concurrent);
    assert.equal(raceObservation.matchesPinnedCommit, false);
    assert.equal(remote.state.receivePosts, 5);
    proofs.push(
      "real remote-ref race after negotiation: Git rejects stale old OID, preserves independent concurrent ref/full local state; Inspect does not resend",
    );
    const outgoing = join(x.directory, "git-fetch-v1", raced.stageName);
    const receiptPath = join(
      x.directory,
      "git-push-v1",
      `push-${raceRequest.intent.operationId}`,
      "receipt.json",
    );
    const unexpected = join(outgoing, "owned-cleanup-refusal.txt");
    await writeFile(unexpected, "retain unexpected top-level material\n", {
      flag: "wx",
    });
    const beforeRetire = await context.invoke("load_workspace");
    const beforeRetireBytes = await readFile(x.workspace);
    await assert.rejects(
      context.invoke("git_remote_push_retire", {
        request: {
          push: raceRequest,
          attemptId: crypto.randomUUID(),
          expectedReceipt: raced,
        },
      }),
      /Unexpected Push snapshot material/,
    );
    assert.deepEqual(JSON.parse(await readFile(receiptPath, "utf8")), raced);
    assert.deepEqual(await context.invoke("load_workspace"), beforeRetire);
    assert.deepEqual(await readFile(x.workspace), beforeRetireBytes);
    assert.equal(
      await readFile(unexpected, "utf8"),
      "retain unexpected top-level material\n",
    );
    await unlink(unexpected); // Only the unchanged exclusively created fixture file.
    const payloadLock = await lockProbePushPayload(
      raced.stageName,
      raceRequest.intent.operationId,
    );
    let pendingCleanup;
    try {
      await assert.rejects(
        context.invoke("git_remote_push_retire", {
          request: {
            push: raceRequest,
            attemptId: crypto.randomUUID(),
            expectedReceipt: raced,
          },
        }),
        /payload cleanup is incomplete/,
      );
      pendingCleanup = JSON.parse(await readFile(receiptPath, "utf8"));
      assert.equal(pendingCleanup.phase, "retired");
      assert.equal(pendingCleanup.stageName, raced.stageName);
      assert.deepEqual(pendingCleanup.result, raced.result);
      assert.equal(
        await Bun.file(join(outgoing, ".insomnium-push-snapshot")).text(),
        raceRequest.intent.operationId,
      );
      assert.equal(
        await Bun.file(join(outgoing, ".insomnium-fetch-owner")).text(),
        raced.stageMarker,
      );
      assert.deepEqual(await context.invoke("load_workspace"), beforeRetire);
      assert.deepEqual(await readFile(x.workspace), beforeRetireBytes);
      assert.equal(remote.state.receivePosts, 5);
    } finally {
      payloadLock.release();
    }
    const cleanupObservation = await context.invoke("git_remote_push_inspect", {
      request: { push: raceRequest, attemptId: crypto.randomUUID() },
    });
    assert.deepEqual(cleanupObservation.receipt, pendingCleanup);
    assert.equal(cleanupObservation.observedRemoteOid, concurrent);
    const retired = await context.invoke("git_remote_push_retire", {
      request: {
        push: raceRequest,
        attemptId: crypto.randomUUID(),
        expectedReceipt: pendingCleanup,
      },
    });
    assert.equal(retired.phase, "retired");
    assert.equal(retired.stageName, null);
    assert.equal(retired.stageMarker, null);
    assert.deepEqual(retired.result, raced.result);
    assert.deepEqual(JSON.parse(await readFile(receiptPath, "utf8")), retired);
    await assert.rejects(stat(outgoing), { code: "ENOENT" });
    assert.deepEqual(await context.invoke("load_workspace"), beforeRetire);
    assert.deepEqual(await readFile(x.workspace), beforeRetireBytes);
    assert.equal(await remote.tip(), concurrent);
    assert.equal(remote.state.receivePosts, 5);
    restartProof = {
      request: raceRequest,
      retired,
      beforeRetire,
      beforeRetireBytes,
      workspace: x.workspace,
      outgoing,
      pid: context.pid,
    };
    proofs.push(
      "retirement: unexpected material refuses unchanged; real Windows payload-delete failure retains tombstone/markers/full state, fresh Inspect/explicit retry reclaims owned snapshot without upload",
    );
    await Bun.write(
      join(context.output, "proofs.json"),
      JSON.stringify(
        { proofs, server: remote.state, destinationOid: await remote.tip() },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ passed: proofs.length, proofs }));
  } finally {
    remote.close();
  }
});

const restart = restartProof;
assert.ok(restart);
await withNativeApp("git-push-retire-restart", async (context) => {
  assert.notEqual(context.pid, restart.pid);
  assert.deepEqual(
    await context.invoke("load_workspace"),
    restart.beforeRetire,
  );
  assert.deepEqual(
    await readFile(restart.workspace),
    restart.beforeRetireBytes,
  );
  const receipt = await context.invoke("git_remote_push", {
    request: restart.request,
  });
  assert.deepEqual(receipt, restart.retired);
  await assert.rejects(stat(restart.outgoing), { code: "ENOENT" });
  await Bun.write(
    join(context.output, "proofs.json"),
    JSON.stringify(
      {
        proofs: [
          "real native restart: repeated retired operation reconciles tombstone, creates no new stage and preserves exact full workspace bytes/data",
        ],
      },
      null,
      2,
    ),
  );
});
