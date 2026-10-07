import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { advanceFixture, fixtureGit } from "./helpers/git-advance-fixture.js";
import { openGitRemote } from "./helpers/git-panel.js";
import { serveReceivePack } from "./helpers/git-receive-pack.js";
import { heldHttp } from "./helpers/held-http.js";
import { withIpcFailure } from "./helpers/ipc-failure.js";
import { buildComponentFixture } from "./helpers/component-fixture.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
const http = await heldHttp();
const mode = process.env.INSOMNIUM_PUSH_UI_CASE || "normal";
assert.ok(
  [
    "normal",
    "unknown",
    "rejected",
    "non-fast-forward",
    "source-advanced",
    "source-before-confirm",
    "retire-lost",
    "retire-save-failed",
    "retire-save-lost",
    "retire-state-replaced",
    "stop",
    "completed-stop",
    "timeout",
  ].includes(mode),
);
try {
  await withNativeApp(
    mode === "normal" ? "git-push-ui" : `git-push-ui-${mode}`,
    async (context) => {
      const { page, invoke, output } = context;
      const x = await advanceFixture(context);
      const remote = await serveReceivePack(output);
      const checks = [];
      try {
        if (mode === "non-fast-forward") {
          // Seed an independently advanced owned server using real Git objects.
          await fixtureGit(remote.repo, [
            "fetch",
            "--no-tags",
            x.repo,
            x.newOid,
          ]);
          await fixtureGit(remote.repo, [
            "update-ref",
            "refs/heads/main",
            x.newOid,
          ]);
        }
        const data = await invoke("load_workspace");
        const original = data.resources.find(
          (/** @type {any} */ row) => row._id === x.f.requestId,
        );
        const held = {
          ...structuredClone(original),
          _id: "req_push_held_" + Date.now(),
          isPrivate: true,
          name: "Retained private Push Send",
          url: `http://127.0.0.1:${http.port}/held`,
        };
        data.resources.push(held);
        if (mode === "timeout") data.settings.timeout = 600_000;
        data.activeRequestId = held._id;
        data.openTabs = [...data.openTabs, held._id];
        await invoke("save_workspace", { data });
        await page.reload();
        if (mode === "retire-state-replaced") {
          const { root } = await buildComponentFixture(
            "git-recovery-native-copy",
            { minify: true },
          );
          const buildState = process.env.INSOMNIUM_UI_BUILD_STATE;
          assert.ok(buildState);
          const build = await Bun.file(buildState).json();
          assert.equal(
            build.fixtureHash,
            Bun.hash(
              await Bun.file(join(root, "git-recovery-native-copy.js")).text(),
            ).toString(),
            "Rebuild native fixture after source changes",
          );
          await page.evaluate(
            (seed) => {
              /** @type {any} */ (window).__recoveryNativeSeed = seed;
            },
            {
              ...x.f,
              requestId: held._id,
              recoveryCommand: "git_remote_push_retire",
            },
          );
          await page.addScriptTag({
            url: new URL("/__saved-recovery-fixture.js", page.url()).href,
            type: "module",
          });
          await page
            .getByLabel("Native recovery fixture evidence")
            .evaluate((element) => {
              /** @type {HTMLElement} */ (element).hidden = true;
            });
          await poll(
            async () =>
              JSON.parse(
                (await page
                  .getByLabel("Native recovery fixture evidence")
                  .textContent()) || "{}",
              ).ready,
            "Mounted production App for actual retirement state replacement",
          );
        }
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await poll(
          async () => http.held === 1,
          "Real held private Send before Push review",
        );
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
        const bytes = await readFile(x.workspace);
        const sourceRefs = await fixtureGit(x.repo, ["show-ref"]);
        let expectedSourceRefs = sourceRefs;
        await panel
          .getByRole("button", { name: "Review Push", exact: true })
          .click();
        let dialog = page.getByRole("dialog", {
          name: "Review Push",
          exact: true,
        });
        await dialog.waitFor();
        assert.ok((await dialog.innerText()).includes(x.f.oid));
        assert.equal(remote.state.receivePosts, 0);
        await dialog
          .getByRole("button", { name: "Cancel Push review", exact: true })
          .click();
        assert.deepEqual(await invoke("load_workspace"), baseline);
        assert.deepEqual(await readFile(x.workspace), bytes);
        assert.equal(http.cancelled, 0);
        checks.push(
          "real review/cancel: full bytes/data/held Send unchanged and no upload",
        );

        await panel
          .getByRole("button", { name: "Review Push", exact: true })
          .click();
        dialog = page.getByRole("dialog", { name: "Review Push", exact: true });
        await dialog.waitFor();
        await page.screenshot({ path: join(output, "push-review.png") });
        remote.state.dropNextReply = mode === "unknown";
        remote.state.rejectNextPush = mode === "rejected";
        remote.state.holdNextPush = ["stop", "timeout"].includes(mode);
        remote.state.holdCompletedNextPush = mode === "completed-stop";
        if (mode === "source-before-confirm") {
          await fixtureGit(x.repo, [
            "update-ref",
            "refs/heads/main",
            x.newOid,
            x.f.oid,
          ]);
          expectedSourceRefs = await fixtureGit(x.repo, ["show-ref"]);
          assert.notEqual(expectedSourceRefs, sourceRefs);
        }
        if (mode === "source-advanced")
          remote.beforeNextReceive(async () => {
            // Actual local ref movement after the outgoing worker negotiated
            // and sent its pack, before the owned server executes receive-pack.
            await fixtureGit(x.repo, [
              "update-ref",
              "refs/heads/main",
              x.newOid,
              x.f.oid,
            ]);
            expectedSourceRefs = await fixtureGit(x.repo, ["show-ref"]);
            assert.notEqual(expectedSourceRefs, sourceRefs);
          });
        const submittedAt = performance.now();
        await dialog
          .getByRole("button", { name: "Confirm Push", exact: true })
          .click();
        if (["stop", "timeout", "completed-stop"].includes(mode)) {
          await poll(
            async () => remote.state.heldReceives === 1,
            "Actual receive-pack response held",
          );
          if (["stop", "completed-stop"].includes(mode))
            await panel
              .getByRole("button", { name: "Stop remote request", exact: true })
              .click();
          await panel
            .getByRole("alert")
            .filter({ hasText: "Inspect pending Push" })
            .waitFor({ timeout: mode === "timeout" ? 335_000 : 15_000 });
          if (mode === "timeout") {
            assert.match(
              await panel.getByRole("alert").innerText(),
              /timed out/i,
            );
            assert.ok(
              performance.now() - submittedAt >= 290_000,
              "Exercise the real 300-second supervisor deadline",
            );
          }
          await poll(
            async () => remote.state.abortedReceives === 1,
            "Stopped native Push disconnects held response",
          );
          assert.equal(
            remote.state.completedHeldReceives,
            mode === "completed-stop" ? 1 : 0,
          );
        } else if (mode === "source-before-confirm") {
          await panel
            .getByRole("alert")
            .filter({ hasText: "Inspect pending Push" })
            .waitFor();
          assert.match(
            await panel.getByRole("alert").innerText(),
            /Local branch changed/,
          );
        } else
          await panel
            .getByRole("status")
            .filter({
              hasText:
                mode === "unknown"
                  ? "Remote outcome is unknown."
                  : mode === "rejected"
                    ? "Server rejected the Push. Local data is unchanged."
                    : mode === "non-fast-forward"
                      ? "Push needs the remote history. No update was sent."
                      : "Server accepted the reviewed Push.",
            })
            .waitFor();
        const expectedPosts = [
          "non-fast-forward",
          "source-before-confirm",
        ].includes(mode)
          ? 0
          : 1;
        assert.equal(remote.state.receivePosts, expectedPosts);
        assert.equal(
          await remote.tip(),
          mode === "non-fast-forward"
            ? x.newOid
            : ["rejected", "stop", "timeout", "source-before-confirm"].includes(
                  mode,
                )
              ? null
              : x.f.oid,
        );
        if (mode === "rejected") {
          assert.equal(
            await readFile(
              join(remote.repo, ".owned-receive-rejection-ran"),
              "utf8",
            ),
            "executed\n",
          );
        } else if (
          ![
            "stop",
            "timeout",
            "non-fast-forward",
            "source-before-confirm",
          ].includes(mode)
        )
          assert.equal(
            await fixtureGit(remote.repo, ["ls-tree", "-r", x.f.oid]),
            await fixtureGit(x.repo, ["ls-tree", "-r", x.f.oid]),
          );
        const after = await invoke("load_workspace");
        const actualBinding = after.resources.find(
          (/** @type {any} */ row) => row._id === x.f.repositoryId,
        );
        const receiptPath = join(
          x.directory,
          "git-push-v1",
          `push-${actualBinding.nativePushIntent.operationId}`,
          "receipt.json",
        );
        const nativeReceipt = JSON.parse(await readFile(receiptPath, "utf8"));
        if (["stop", "timeout", "completed-stop"].includes(mode)) {
          assert.equal(nativeReceipt.phase, "submitted");
          assert.equal(nativeReceipt.result, null);
        }
        const outgoing = nativeReceipt.stageName
          ? join(x.directory, "git-fetch-v1", nativeReceipt.stageName)
          : null;
        if (outgoing) assert.equal((await stat(outgoing)).isDirectory(), true);
        else {
          assert.equal(mode, "source-before-confirm");
          assert.equal(nativeReceipt.phase, "preparing");
          assert.equal(nativeReceipt.result, null);
        }
        const expected = structuredClone(baseline);
        expected.resources.find(
          (/** @type {any} */ row) => row._id === x.f.repositoryId,
        ).nativePushIntent = actualBinding.nativePushIntent;
        assert.equal(actualBinding.nativePushIntent.sourceOid, x.f.oid);
        assert.equal(actualBinding.nativePushIntent.destinationBranch, "main");
        assert.equal(
          actualBinding.nativePushIntent.expectedRemoteOid,
          mode === "non-fast-forward" ? x.newOid : null,
        );
        assert.deepEqual(after, expected);
        assert.equal(
          await fixtureGit(x.repo, ["show-ref"]),
          expectedSourceRefs,
        );
        assert.equal(http.cancelled, 0);
        checks.push(
          ["stop", "timeout", "completed-stop"].includes(mode)
            ? mode === "completed-stop"
              ? "Stop after actual server Git update: native response disconnect/unknown pending receipt, independent exact server commit/tree and full local state/held Send preserved"
              : `${mode}: actual held receive-pack/native disconnect observed, remote unchanged/full live snapshot except exact intent and held private Send preserved`
            : mode === "rejected"
              ? "actual server hook rejects product Push: destination remains absent, full live snapshot except exact intent and held Send preserved"
              : mode === "non-fast-forward"
                ? "actual non-force product Push refuses advanced server before POST; actionable Fetch/Pull guidance, full live snapshot except exact intent and held Send preserved"
                : mode === "source-advanced"
                  ? "local branch actually advanced after worker pack submission: server receives only reviewed immutable commit/tree; later source ref/full workspace/held Send preserved"
                  : mode === "source-before-confirm"
                    ? "source tip moved after product review before confirmation: actionable inspection error, no POST/stage, full state/changed ref/held Send preserved"
                    : "confirmed public Push: pinned actual server tree and full live snapshot except exact saved intent; held Send stays active",
        );

        if (["unknown", "stop", "timeout", "completed-stop"].includes(mode)) {
          await page.reload();
          await page.getByRole("button", { name: "Git", exact: true }).click();
          await openGitRemote(page);
          await page
            .getByRole("region", { name: "Git remote", exact: true })
            .getByRole("button", { name: "Inspect pending Push", exact: true })
            .waitFor();
          assert.equal(remote.state.receivePosts, 1);
          assert.deepEqual(await invoke("load_workspace"), after);
          checks.push(
            ["stop", "timeout", "completed-stop"].includes(mode)
              ? "stopped submitted Push survives reload; fresh Inspect does not resend or rewrite full data"
              : "real completed-server HTTP503 survives reload as pending Push; no automatic upload or full-data rewrite",
          );
        }

        await panel
          .getByRole("button", { name: "Inspect pending Push", exact: true })
          .click();
        const inspected = page.getByRole("dialog", {
          name: "Inspect Push result",
          exact: true,
        });
        await inspected.waitFor();
        const clear = inspected.getByRole("button", {
          name: "Stop tracking reviewed Push",
          exact: true,
        });
        assert.equal(await clear.isDisabled(), true);
        assert.ok((await inspected.innerText()).includes(x.f.oid));
        assert.equal(remote.state.receivePosts, expectedPosts);
        const acknowledgment = inspected.getByRole("checkbox", {
          name: "I have reviewed the observed remote state.",
          exact: true,
        });
        const spacing = await acknowledgment.evaluate((input) => {
          const label = input.closest("label");
          if (!label) throw new Error("Acknowledgment label missing");
          const text = [...label.childNodes].find(
            (node) =>
              node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
          );
          if (!text) throw new Error("Acknowledgment text missing");
          const range = document.createRange();
          range.selectNodeContents(text);
          const control = input.getBoundingClientRect();
          const bounds = range.getBoundingClientRect();
          return {
            gap: bounds.left - control.right,
            leadingSpace: control.left - label.getBoundingClientRect().left,
          };
        });
        assert.ok(
          spacing.leadingSpace >= -1 && spacing.leadingSpace <= 2,
          "Checkbox must align with the start of its label",
        );
        assert.ok(
          spacing.gap >= 0 && spacing.gap <= 24,
          "Acknowledgment text must sit beside the checkbox",
        );
        await acknowledgment.check();
        await page.screenshot({
          path: join(output, "push-observation-review.png"),
        });
        let clearedOnReload = false;
        if (
          ["retire-lost", "retire-save-failed", "retire-save-lost"].includes(
            mode,
          )
        ) {
          assert.ok(
            outgoing,
            "Retirement fault modes require a submitted snapshot",
          );
          const saveFault = mode !== "retire-lost";
          const afterSuccess = mode !== "retire-save-failed";
          const counts = await withIpcFailure(
            page,
            saveFault ? "save_workspace" : "git_remote_push_retire",
            afterSuccess,
            async () => {
              await clear.click();
              await panel
                .getByRole("alert")
                .filter({
                  hasText: saveFault
                    ? "Push tracking could not be cleared."
                    : "Injected IPC failure: git_remote_push_retire",
                })
                .waitFor();
            },
          );
          assert.equal(counts.calls, 1);
          assert.equal(counts.completed, afterSuccess ? 1 : 0);
          assert.equal(
            JSON.parse(await readFile(receiptPath, "utf8")).phase,
            "retired",
          );
          await assert.rejects(stat(outgoing), { code: "ENOENT" });
          assert.deepEqual(
            await invoke("load_workspace"),
            mode === "retire-save-lost" ? baseline : after,
          );
          assert.equal(remote.state.receivePosts, 1);
          assert.equal(http.cancelled, 0);
          await page.reload();
          await page.getByRole("button", { name: "Git", exact: true }).click();
          await openGitRemote(page);
          if (mode === "retire-save-lost") {
            await panel
              .getByRole("button", { name: "Review Push", exact: true })
              .waitFor();
            assert.equal(
              await panel
                .getByRole("button", {
                  name: "Inspect pending Push",
                  exact: true,
                })
                .count(),
              0,
            );
            clearedOnReload = true;
          } else {
            await panel
              .getByRole("button", {
                name: "Inspect pending Push",
                exact: true,
              })
              .click();
            await inspected.waitFor();
            assert.equal(await clear.isDisabled(), true);
            await acknowledgment.check();
          }
          checks.push(
            mode === "retire-save-lost"
              ? "actual tracking save completed but reply lost: reload reconciles authoritative cleared intent/full snapshot without resend or remote undo"
              : mode === "retire-save-failed"
                ? "tracking save refused after native retirement: durable intent preserved, reload/fresh unchecked Inspect/explicit retry without upload"
                : "actual native retirement completed but reply lost: durable intent survives reload, fresh unchecked observation retries cleanup without upload or remote undo",
          );
        }
        if (!clearedOnReload) {
          await clear.click();
          await panel
            .getByRole("status")
            .filter({ hasText: "Reviewed Push tracking cleared." })
            .waitFor();
        }
        const clearedBaseline = structuredClone(baseline);
        if (mode === "retire-state-replaced") {
          clearedBaseline.resources.find(
            (/** @type {any} */ row) => row._id === held._id,
          ).description = "Unexpected retained native fixture edit";
          const fixtureEvidence = JSON.parse(
            (await page
              .getByLabel("Native recovery fixture evidence")
              .textContent()) || "{}",
          );
          assert.equal(fixtureEvidence.calls, 1);
          assert.deepEqual(fixtureEvidence.current, clearedBaseline);
          checks.push(
            "real native retirement reply followed by whole live Svelte state replacement: latest private edit retained/current intent cleared/exact live snapshot persisted without resend",
          );
        }
        assert.deepEqual(await invoke("load_workspace"), clearedBaseline);
        const retired = JSON.parse(await readFile(receiptPath, "utf8"));
        assert.equal(retired.phase, "retired");
        assert.equal(retired.stageName, null);
        assert.equal(retired.stageMarker, null);
        assert.deepEqual(retired.result, nativeReceipt.result);
        if (outgoing) await assert.rejects(stat(outgoing), { code: "ENOENT" });
        assert.equal(remote.state.receivePosts, expectedPosts);
        assert.equal(
          await remote.tip(),
          mode === "non-fast-forward"
            ? x.newOid
            : ["rejected", "stop", "timeout", "source-before-confirm"].includes(
                  mode,
                )
              ? null
              : x.f.oid,
        );
        assert.equal(http.cancelled, 0);
        assert.equal(
          await fixtureGit(x.repo, ["show-ref"]),
          expectedSourceRefs,
        );
        checks.push(
          "fresh Inspect: required unchecked acknowledgment, durable native retirement/owned snapshot absent without resend or remote undo, exact expected live full snapshot after tracking clear",
        );
        await Bun.write(
          join(output, "acceptance.json"),
          JSON.stringify(
            {
              checks,
              server: remote.state,
              held: { started: http.held, cancelled: http.cancelled },
            },
            null,
            2,
          ),
        );
        console.log(JSON.stringify({ passed: checks.length, checks }));
      } finally {
        remote.close();
      }
    },
  );
} finally {
  await http.close();
}
