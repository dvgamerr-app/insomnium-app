import assert from "node:assert/strict";
import { join } from "node:path";
import { buildComponentFixture } from "./component-fixture.js";
import { withNativeApp, poll } from "./native-app.js";
import { gitCollection } from "./git-fixture.js";
import { respondToOwnedSaveDialog } from "./windows-save-dialog.js";
import { sameWorkspace } from "../../../src/lib/git-workspace.js";
import { withIpcSuccessHook } from "./ipc-success-hook.js";
import { lockScenarioCopyWrite } from "./windows-workspace-lock.js";
import { heldHttp } from "./held-http.js";
import {
  advanceFixture,
  fixtureGit,
  assertAdvanceCleanup,
} from "./git-advance-fixture.js";
import { openGitBranches } from "./git-panel.js";
import { initialData } from "../../../src/lib/model.js";
import { planGitClone } from "../../../src/lib/git-clone.js";
import { gitRepositoryPack } from "./git-repository-pack.js";
import { serveGitPack } from "./git-smart-http.js";

/** @param {"restore"|"merge"|"clone"} kind */
export async function runNativeRecoveryCopy(kind) {
  const recoveryTitle = "Recover " + kind;

  process.env.INSOMNIUM_UI_BUILD_STATE ||=
    "artifacts/native-recovery-copy-probe/build-state.json";
  const { root } = await buildComponentFixture("git-recovery-native-copy");
  const build = await Bun.file(process.env.INSOMNIUM_UI_BUILD_STATE).json();
  assert.equal(
    build.fixtureHash,
    Bun.hash(
      await Bun.file(join(root, "git-recovery-native-copy.js")).text(),
    ).toString(),
    "Rebuild the native fixture probe after fixture changes",
  );
  const http = await heldHttp({ body: "fresh after retained recovery" });
  let network = /** @type {ReturnType<typeof serveGitPack>|undefined} */ (
    undefined
  );
  try {
    await withNativeApp(
      kind === "restore"
        ? "git-recovery-native-copy"
        : "git-" + kind + "-retained-copy",
      async (context) => {
        const { page, pid, invoke, output } = context;
        const errors = /** @type {string[]} */ ([]);
        page.on("pageerror", (error) => errors.push(error.message));
        const advance =
          kind !== "restore" ? await advanceFixture(context) : null;
        const fixture = advance
          ? { ...advance.f, data: advance.before }
          : await gitCollection({ page, invoke });
        if (kind === "clone") {
          fixture.data = initialData();
          fixture.requestId = fixture.data.activeRequestId;
          fixture.workspaceId = fixture.data.activeWorkspaceId;
          assert.ok(advance);
          network = serveGitPack(await gitRepositoryPack(advance));
        }
        if (advance && kind === "merge")
          await fixtureGit(advance.repo, [
            "update-ref",
            "refs/heads/incoming",
            advance.newOid,
          ]);
        fixture.data.resources.find(
          (/** @type {any} */ r) => r._id === fixture.requestId,
        ).url = `http://127.0.0.1:${http.port}/held`;
        await invoke("save_workspace", { data: fixture.data });
        await page.evaluate(
          (seed) => {
            /** @type {any} */ (window).__recoveryNativeSeed = seed;
          },
          {
            ...fixture,
            recoveryCommand:
              kind === "clone"
                ? "git_clone_install"
                : kind === "merge"
                  ? "git_repository_apply_merge"
                  : "git_repository_restore",
          },
        );
        await page.addScriptTag({
          url: new URL("/__saved-recovery-fixture.js", page.url()).href,
          type: "module",
        });
        // Keep the fixture's complete JSON evidence out of the App's layout.
        await page
          .getByLabel("Native recovery fixture evidence")
          .evaluate((element) => {
            /** @type {HTMLElement} */ (element).hidden = true;
          });
        const evidence = async () =>
          JSON.parse(
            (await page
              .getByLabel("Native recovery fixture evidence")
              .textContent()) || "",
          );
        await poll(async () => {
          if (errors.length) throw new Error(errors.join("\n"));
          return (await evidence()).ready;
        }, "Mounted production App initialization");
        if (kind === "clone") {
          await page.keyboard.press("Control+s");
          await poll(
            async () =>
              (await invoke("load_workspace")).resources.some(
                (/** @type {any} */ row) =>
                  row._type === "workspace_meta" &&
                  row.parentId === fixture.workspaceId,
              ),
            "Saved Clone baseline selection metadata",
          );
          fixture.data = await invoke("load_workspace");
        }
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await poll(
          async () => http.held === 1,
          `Real held native request before ${kind}`,
        );
        let clonePlan = /** @type {ReturnType<typeof planGitClone>|null} */ (
          null
        );
        let cloneRequests = 0;
        if (kind === "clone") {
          assert.ok(network);
          await page
            .getByRole("button", { name: "Clone repository", exact: true })
            .click();
          const dialog = page.getByRole("dialog", {
            name: "Clone repository",
            exact: true,
          });
          await dialog
            .getByLabel("Clone repository URL", { exact: true })
            .fill(`http://127.0.0.1:${network.server.port}/repo`);
          await dialog
            .getByLabel("Clone author name", { exact: true })
            .fill("Clone copy owner");
          await dialog
            .getByLabel("Clone author email", { exact: true })
            .fill("copy@example.invalid");
          await dialog
            .getByRole("button", {
              name: "Download Clone for review",
              exact: true,
            })
            .click();
          await dialog
            .getByRole("region", { name: "Clone review", exact: true })
            .waitFor();
          const stages = await invoke("git_clone_list");
          const stage = stages.find(
            (/** @type {any} */ row) =>
              row.url === `http://127.0.0.1:${network?.server.port}/repo` &&
              row.phase === "ready",
          );
          assert.ok(stage);
          clonePlan = planGitClone(
            fixture.data,
            await invoke("git_clone_inspect", {
              operationId: stage.operationId,
            }),
            {
              remote: { url: stage.url, credentials: { kind: "anonymous" } },
              author: {
                name: "Clone copy owner",
                email: "copy@example.invalid",
              },
            },
          );
          cloneRequests = network.state.gets + network.state.posts;
          await dialog
            .getByRole("button", {
              name: "Install cloned collection",
              exact: true,
            })
            .click();
        } else {
          await page.getByRole("button", { name: "Git", exact: true }).click();
          if (kind === "restore") {
            await page
              .getByRole("region", { name: "Source Control", exact: true })
              .getByRole("button", {
                name: "Restore Preserved local request",
                exact: true,
              })
              .click();
            await page
              .getByRole("dialog", {
                name: "Restore selected changes",
                exact: true,
              })
              .getByRole("button", {
                name: "Restore selected changes",
                exact: true,
              })
              .click();
          } else {
            await openGitBranches(page);
            const branches = page.getByRole("dialog", {
              name: "Branches",
              exact: true,
            });
            await branches
              .getByRole("combobox")
              .first()
              .selectOption("incoming");
            await branches
              .getByRole("button", { name: "Review merge", exact: true })
              .click();
            const review = page.getByRole("dialog", {
              name: "Review merge",
              exact: true,
            });
            await page
              .getByLabel("Working conflict choice " + fixture.requestId, {
                exact: true,
              })
              .selectOption("local");
            await review
              .getByRole("button", { name: "Review resolutions", exact: true })
              .click();
            await review
              .getByRole("button", { name: "Apply merge", exact: true })
              .click();
          }
        }
        await page
          .getByRole("dialog", { name: recoveryTitle, exact: true })
          .waitFor();
        await poll(
          async () =>
            http.cancelled === 1 && (await evidence()).phase === "recovery",
          `Production ${kind} drain and persistence recovery lock`,
        );
        const guards = await page.evaluate(() =>
          /** @type {any} */ (window).__nativeRecoveryGuards(),
        );
        assert.deepEqual(guards, {
          editable: false,
          saved: false,
          unchanged: true,
          running: 0,
          phase: "recovery",
        });
        assert.equal(
          http.held,
          1,
          "Blocked new Send must not reach native server",
        );
        const authoritative = await invoke("load_workspace");
        if (kind === "clone") {
          assert.ok(clonePlan && advance && network);
          const expected = structuredClone(clonePlan.next);
          const binding = authoritative.resources.find(
            (/** @type {any} */ row) =>
              row.nativeCloneOperationId === clonePlan?.receipt.operationId,
          );
          assert.ok(binding);
          expected.resources.find(
            (/** @type {any} */ row) =>
              row._type === "git_repository" &&
              row.nativeCloneOperationId === clonePlan?.receipt.operationId,
          )._id = binding._id;
          assert.ok(
            sameWorkspace(authoritative, expected),
            "Clone preserves full baseline and exact additive reviewed resources/binding",
          );
          const target = join(
            advance.directory,
            "git-v1",
            "repo-" + binding.nativeRepositoryId,
          );
          assert.equal(
            await fixtureGit(target, ["rev-parse", "HEAD"]),
            advance.newOid,
          );
          assert.equal(
            await fixtureGit(target, ["rev-parse", "HEAD^{tree}"]),
            await fixtureGit(advance.repo, [
              "rev-parse",
              advance.newOid + "^{tree}",
            ]),
          );
          assert.equal(
            await Bun.file(
              join(advance.directory, "git-clone-install-v1.json"),
            ).exists(),
            false,
          );
        } else if (advance) {
          assert.ok(
            sameWorkspace(authoritative, fixture.data),
            "Native local merge choice preserves exact full workspace",
          );
          assert.equal(
            await fixtureGit(advance.repo, ["rev-parse", "refs/heads/main"]),
            advance.newOid,
          );
          await assertAdvanceCleanup(advance);
        }
        assert.deepEqual(
          authoritative.history,
          fixture.data.history,
          "Cancelled held Send must not add history",
        );
        const retained = (await evidence()).retained;
        const expectedRetained = structuredClone(fixture.data);
        expectedRetained.resources.find(
          (/** @type {any} */ r) => r._id === fixture.requestId,
        ).description = "Unexpected retained native fixture edit";
        assert.ok(
          sameWorkspace(retained, expectedRetained),
          "Retained copy preserves the exact live pre-transition workspace plus the unexpected edit",
        );
        await Bun.write(
          join(output, "retained-before-picker.json"),
          JSON.stringify(retained),
        );
        assert.equal(sameWorkspace(authoritative, retained), false);
        const copy = page.getByRole("button", {
          name: "Save recovery copy",
          exact: true,
        });
        const load = page.getByRole("button", {
          name: "Load recovered workspace",
          exact: true,
        });
        const checkbox = page.getByRole("checkbox");
        await copy.click();
        const cancelled = await respondToOwnedSaveDialog(pid, output, null);
        await poll(
          () => copy.isEnabled(),
          "Picker cancellation releases busy state",
        );
        assert.equal(await checkbox.count(), 0);
        assert.equal(await load.isDisabled(), true);
        assert.ok(sameWorkspace(await invoke("load_workspace"), authoritative));
        // After the real picker grants the path, hold an OS handle denying writes
        // before its unchanged response reaches writeTextFile.
        const deniedPath = join(output, "write-denied-copy.json");
        const sentinel =
          "Recovery fixture sentinel; must survive native write refusal";
        /** @type {Awaited<ReturnType<typeof lockScenarioCopyWrite>>|undefined} */
        let lock;
        let refused;
        try {
          refused = await withIpcSuccessHook(
            page,
            "plugin:dialog|save",
            async () => {
              await Bun.write(deniedPath, sentinel);
              lock = await lockScenarioCopyWrite(output, deniedPath);
            },
            async () => {
              await copy.click();
              await respondToOwnedSaveDialog(pid, output, deniedPath);
              const writeError = page
                .getByRole("dialog", { name: recoveryTitle, exact: true })
                .getByRole("alert")
                .filter({ hasText: "os error 32" });
              await writeError.waitFor();
              await poll(
                () => copy.isEnabled(),
                "Native copy write refusal releases busy state",
              );
              assert.equal(await checkbox.count(), 0);
              assert.equal(await load.isDisabled(), true);
              assert.equal(await Bun.file(deniedPath).text(), sentinel);
              assert.ok(
                sameWorkspace(await invoke("load_workspace"), authoritative),
              );
              return await writeError.innerText();
            },
          );
          assert.equal(refused.hooks, 1);
          assert.equal(refused.calls, 1);
          assert.match(
            refused.value,
            /os error 32/i,
            "Require actual Windows sharing refusal",
          );
        } finally {
          lock?.release();
        }
        await copy.click();
        const path = join(output, "retained-workspace.json");
        const saved = await respondToOwnedSaveDialog(pid, output, path);
        await checkbox.waitFor();
        assert.ok(
          sameWorkspace(JSON.parse(await Bun.file(path).text()), retained),
          "OS-selected native write must preserve the exact retained snapshot",
        );
        assert.equal(await load.isDisabled(), true);
        await page.keyboard.press("Escape");
        assert.equal(
          await page
            .getByRole("dialog", { name: recoveryTitle, exact: true })
            .isVisible(),
          true,
        );
        await page.screenshot({
          path: join(output, "saved-native-copy-review.png"),
        });
        await checkbox.check();
        await load.click();
        await poll(async () => {
          const value = await evidence();
          return value.complete && !value.draining && value.phase === "idle";
        }, "Reviewed native authoritative recovery");
        assert.ok(sameWorkspace((await evidence()).current, authoritative));
        assert.ok(
          sameWorkspace(await invoke("load_workspace"), authoritative),
          "Recovery must not persist retained edits over restored workspace",
        );
        assert.equal((await evidence()).draining, false);
        assert.equal((await evidence()).phase, "idle");
        assert.equal(
          kind === "clone"
            ? (await evidence()).calls
            : (await evidence())[kind === "restore" ? "restores" : "merges"],
          1,
          "Recovery must not repeat the native transition",
        );
        assert.equal(
          (await evidence()).calls,
          1,
          "Recovery must not resubmit IPC",
        );
        if (kind === "clone") {
          assert.ok(network);
          assert.equal(
            network.state.gets + network.state.posts,
            cloneRequests,
            "Clone copy/review/recovery never downloads again",
          );
        } else if (advance) {
          assert.ok(
            sameWorkspace(authoritative, fixture.data),
            "Local merge choice must preserve full workspace",
          );
          assert.equal(
            await fixtureGit(advance.repo, ["rev-parse", "refs/heads/main"]),
            advance.newOid,
          );
          await assertAdvanceCleanup(advance);
        }
        assert.equal(
          await page
            .locator("[data-native-recovery-fixture] .app-shell")
            .getAttribute("inert"),
          null,
        );
        if (kind === "clone") {
          await page.getByRole("dialog", { name: "Clone repository", exact: true })
            .getByRole("button", { name: "Cancel Clone", exact: true }).click();
        }
        await page
          .getByRole("button", { name: "Collections", exact: true })
          .click();
        await page
          .locator("[data-native-recovery-fixture]")
          .getByLabel("Request URL", { exact: true })
          .fill(`http://127.0.0.1:${http.port}/fresh`);
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await poll(
          async () => http.echoes === 1,
          "New native Send admitted after reviewed recovery",
        );
        await poll(
          async () =>
            (await invoke("load_workspace")).history.some(
              (/** @type {any} */ response) =>
                response.requestId === fixture.requestId &&
                response.status === 200 &&
                !authoritative.history.some(
                  (/** @type {any} */ old) => old._id === response._id,
                ),
            ),
          "Fresh successful response persisted after recovery",
        );
        await Bun.write(
          join(output, "acceptance.json"),
          JSON.stringify(
            {
              kind,
              nativeTransitionCalls: (await evidence()).calls,
              advancedOid: advance?.newOid || null,
              cancelled,
              refused,
              saved,
              exactRetainedCopy: true,
              authoritativeRecovery: true,
              guards,
              drainedHeldRequests: http.cancelled,
              freshNativeSend: true,
              scope:
                "Full production App/workspace/drain/persistence and actual Windows picker/native file writes; unexpected edit injected only in saved fixture; other-platform/disk-full/crash gates remain pending",
            },
            null,
            2,
          ),
        );
        assert.deepEqual(
          errors,
          [],
          "Mounted production fixture must have no runtime errors",
        );
      },
    );
  } finally {
    network?.close();
    await http.close();
  }
}
