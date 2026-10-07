import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { advanceFixture, fixtureGit } from "./helpers/git-advance-fixture.js";
import { openGitRemote } from "./helpers/git-panel.js";
import { serveReceivePack } from "./helpers/git-receive-pack.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
const mode = process.env.INSOMNIUM_PUSH_LIFECYCLE_CASE || "parent";
assert.ok(["parent", "close"].includes(mode));
/** @type {Awaited<ReturnType<typeof serveReceivePack>>|undefined} */
let remote;
/** @type {any} */
let proof;
/** @type {string[]} */
const checks = [];
try {
  await withNativeApp(
    `git-push-${mode}`,
    async (context) => {
      const { page, invoke, output } = context;
      const x = await advanceFixture(context);
      remote = await serveReceivePack(output);
      await page.getByRole("button", { name: "Git", exact: true }).click();
      await openGitRemote(page);
      const panel = page.getByRole("region", {
        name: "Git remote",
        exact: true,
      });
      await panel
        .getByLabel("Repository URL", { exact: true })
        .fill(remote.url);
      await panel
        .getByRole("button", { name: "Save remote settings", exact: true })
        .click();
      await panel
        .getByRole("status")
        .filter({ hasText: "Remote settings saved." })
        .waitFor();
      await panel
        .getByLabel("Push destination branch", { exact: true })
        .fill("main");
      const baseline = await invoke("load_workspace");
      const refs = await fixtureGit(x.repo, ["show-ref"]);
      const head = await readFile(join(x.repo, ".git", "HEAD"));
      await panel
        .getByRole("button", { name: "Review Push", exact: true })
        .click();
      const review = page.getByRole("dialog", {
        name: "Review Push",
        exact: true,
      });
      await review.waitFor();
      assert.ok((await review.innerText()).includes(x.f.oid));
      remote.state.holdNextPush = true;
      await review
        .getByRole("button", { name: "Confirm Push", exact: true })
        .click();
      await poll(
        async () => remote?.state.heldReceives === 1,
        "Actual held receive-pack before parent/OS close",
      );
      const pending = await invoke("load_workspace");
      const binding = pending.resources.find(
        (/** @type {any} */ row) => row._id === x.f.repositoryId,
      );
      assert.ok(binding.nativePushIntent);
      const request = {
        intent: structuredClone(binding.nativePushIntent),
        expectedBinding: structuredClone(binding),
      };
      const expected = structuredClone(baseline);
      expected.resources.find(
        (/** @type {any} */ row) => row._id === binding._id,
      ).nativePushIntent = request.intent;
      assert.deepEqual(pending, expected);
      const receiptPath = join(
        x.directory,
        "git-push-v1",
        `push-${request.intent.operationId}`,
        "receipt.json",
      );
      const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
      assert.equal(receipt.phase, "submitted");
      assert.equal(receipt.result, null);
      const outgoing = join(x.directory, "git-fetch-v1", receipt.stageName);
      const marker = await readFile(join(outgoing, ".insomnium-push-snapshot"));
      assert.equal(marker.toString(), request.intent.operationId);
      const bytes = await readFile(x.workspace);
      assert.equal(await remote.tip(), null);
      assert.equal(await fixtureGit(x.repo, ["show-ref"]), refs);
      assert.deepEqual(await readFile(join(x.repo, ".git", "HEAD")), head);
      proof = {
        x,
        baseline,
        pending,
        request,
        receiptPath,
        receipt,
        outgoing,
        marker,
        bytes,
        refs,
        head,
        pid: context.pid,
        output,
      };
      // Product confirmation tracks this worker in the real close coordinator.
      if (mode === "parent") await context.terminateParent();
      else await context.requestNativeClose();
      assert.deepEqual(await readFile(x.workspace), bytes);
      assert.equal(remote.state.receivePosts, 1);
      assert.equal(await remote.tip(), null);
      if (mode === "close")
        await poll(
          async () => remote?.state.abortedReceives === 1,
          "WM_CLOSE cancels and drains actual Push connection",
        );
      else assert.equal(remote.state.abortedReceives, 0);
      checks.push(
        mode === "parent"
          ? "actual owned parent termination leaves pending receipt and surviving held worker; full persisted data/local refs preserved"
          : "real PID-scoped WM_CLOSE drains tracked product Push, normal exit0 and actual response disconnect; pending data retained",
      );
      await Bun.write(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            checks,
            server: remote.state,
            operationId: request.intent.operationId,
          },
          null,
          2,
        ),
      );
    },
    {
      allowParentTermination: mode === "parent",
      allowNativeClose: mode === "close",
    },
  );
  assert.ok(proof && remote);
  const server = remote;
  await withNativeApp(
    `git-push-${mode}-reopen`,
    async ({ page, invoke, output, pid }) => {
      const {
        x,
        baseline,
        pending,
        request,
        receiptPath,
        receipt,
        outgoing,
        marker,
        bytes,
        refs,
        head,
      } = proof;
      assert.notEqual(pid, proof.pid);
      assert.deepEqual(await invoke("load_workspace"), pending);
      assert.deepEqual(await readFile(x.workspace), bytes);
      assert.equal(server.state.receivePosts, 1);
      const inspect = () =>
        invoke("git_remote_push_inspect", {
          request: { push: request, attemptId: crypto.randomUUID() },
        });
      if (mode === "parent") {
        await assert.rejects(inspect, /active|lease/i);
        await assert.rejects(
          () =>
            invoke("git_remote_push_retire", {
              request: {
                push: request,
                attemptId: crypto.randomUUID(),
                expectedReceipt: receipt,
              },
            }),
          /active|lease/i,
        );
        assert.deepEqual(
          JSON.parse(await readFile(receiptPath, "utf8")),
          receipt,
        );
        assert.deepEqual(
          await readFile(join(outgoing, ".insomnium-push-snapshot")),
          marker,
        );
        assert.deepEqual(await invoke("load_workspace"), pending);
        assert.deepEqual(await readFile(x.workspace), bytes);
        assert.equal(server.state.receivePosts, 1);
        assert.equal(await server.tip(), null);
        checks.push(
          "fresh process refuses Inspect and retirement while orphan holds its snapshot lease; no mutation or resend",
        );
        server.releaseHeldPushes();
        assert.equal(server.state.releasedReceives, 1);
      }
      /** @type {any} */
      let observed;
      await poll(async () => {
        try {
          observed = await inspect();
          return true;
        } catch (error) {
          assert.match(String(error), /active|lease/i);
          return false;
        }
      }, "Fresh Inspect after worker settlement");
      assert.equal(observed.observedRemoteOid, null);
      assert.equal(observed.matchesPinnedCommit, false);
      assert.equal(observed.receipt.phase, "submitted");
      assert.equal(observed.receipt.result, null);
      assert.deepEqual(await invoke("load_workspace"), pending);
      checks.push(
        mode === "parent"
          ? "controlled response EOF settles orphan without Git execution; fresh Inspect preserves submitted unknown receipt and performs no upload"
          : "fresh process independently inspects drained submitted Push; no automatic resend or outcome attribution",
      );
      await page.getByRole("button", { name: "Git", exact: true }).click();
      await openGitRemote(page);
      const panel = page.getByRole("region", {
        name: "Git remote",
        exact: true,
      });
      await panel
        .getByRole("button", { name: "Inspect pending Push", exact: true })
        .click();
      const review = page.getByRole("dialog", {
        name: "Inspect Push result",
        exact: true,
      });
      await review.waitFor();
      const clear = review.getByRole("button", {
        name: "Stop tracking reviewed Push",
        exact: true,
      });
      const acknowledgment = review.getByRole("checkbox", {
        name: "I have reviewed the observed remote state.",
        exact: true,
      });
      assert.equal(await acknowledgment.isChecked(), false);
      assert.equal(await clear.isDisabled(), true);
      await acknowledgment.check();
      await clear.click();
      await panel
        .getByRole("status")
        .filter({ hasText: "Reviewed Push tracking cleared." })
        .waitFor();
      assert.deepEqual(await invoke("load_workspace"), baseline);
      const retired = JSON.parse(await readFile(receiptPath, "utf8"));
      assert.equal(retired.phase, "retired");
      assert.equal(retired.stageName, null);
      assert.equal(retired.stageMarker, null);
      assert.equal(retired.result, null);
      await assert.rejects(stat(outgoing), { code: "ENOENT" });
      assert.equal(await fixtureGit(x.repo, ["show-ref"]), refs);
      assert.deepEqual(await readFile(join(x.repo, ".git", "HEAD")), head);
      assert.equal(await server.tip(), null);
      assert.equal(server.state.receivePosts, 1);
      assert.equal(server.state.uploadPosts, 0);
      checks.push(
        "fresh unchecked product review and explicit retirement reclaim owned snapshot; exact baseline/local refs restored without resend",
      );
      await Bun.write(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            checks,
            server: server.state,
            firstProcess: { pid: proof.pid, output: proof.output },
            reopenedPid: pid,
            limits:
              "Held response before server Git execution; controlled EOF for orphan settlement. Not server-success cancellation, partial upload, power loss, provider or other-platform proof.",
          },
          null,
          2,
        ),
      );
      console.log(JSON.stringify({ passed: checks.length, checks }));
    },
  );
} finally {
  remote?.releaseHeldPushes();
  await remote?.close();
}
