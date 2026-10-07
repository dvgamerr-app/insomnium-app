import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { withNativeApp, poll, probeIdentifier } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { withIpcSuccessHook } from "./helpers/ipc-success-hook.js";
import { createGitClient } from "../../src/lib/git-client.js";
import { encodeGitResource } from "../../src/lib/git-resources.js";
import {
  checkoutWorkspace,
  sameWorkspace,
} from "../../src/lib/git-workspace.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
assert.ok(process.env.APPDATA);
const workspacePath = resolve(
  process.env.APPDATA,
  probeIdentifier,
  "workspace-v1.json",
);

for (const boundary of ["baseline-save", "native-restore"]) {
  /** @type {any} */
  let handoff;
  await withNativeApp(
    "git-restore-parent-" + boundary,
    async ({ page, invoke, output, terminateParent }) => {
      const fixture = await gitCollection({ page, invoke });
      const before = await invoke("load_workspace");
      const client = createGitClient({ call: invoke });
      const session = await client.open(
        () => before.resources,
        fixture.workspaceId,
      );
      let after;
      try {
        const request = before.resources.find(
          (/** @type {any} */ r) => r._id === fixture.requestId,
        );
        const prepared = await client.prepareRestore(
          session,
          () => before.resources,
          [encodeGitResource(request).path],
        );
        assert.ok(prepared.plan.resources);
        after = checkoutWorkspace(before, prepared.plan.resources);
      } finally {
        client.close(session);
      }
      const expected = boundary === "baseline-save" ? before : after;
      await page.getByRole("button", { name: "Git", exact: true }).click();
      const panel = page.getByRole("region", {
        name: "Source Control",
        exact: true,
      });
      await panel
        .getByRole("button", {
          name: "Restore Preserved local request",
          exact: true,
        })
        .click();
      const review = page.getByRole("dialog", {
        name: "Restore selected changes",
        exact: true,
      });
      await review.waitFor();
      let reached = false;
      /** @type {()=>void} */
      let release = () => {};
      const gate = new Promise((resolve) => {
        release = () => resolve(undefined);
      });
      try {
        await withIpcSuccessHook(
          page,
          boundary === "baseline-save"
            ? "save_workspace"
            : "git_repository_restore",
          async () => {
            reached = true;
            await gate;
          },
          async () => {
            await review
              .getByRole("button", {
                name: "Restore selected changes",
                exact: true,
              })
              .click();
            await poll(
              async () => reached,
              "Actual successful native boundary before UI reply",
            );
            const counts = await page.evaluate(() => {
              const state = /** @type {any} */ (window).__ipcSuccessFixture;
              return { calls: state.calls, hooks: state.hooks };
            });
            assert.deepEqual(counts, { calls: 1, hooks: 1 });
            assert.notEqual(
              await page.locator(".app-shell").getAttribute("inert"),
              null,
              "UI must remain locked with native reply withheld",
            );
            assert.equal(
              await panel
                .getByRole("status")
                .filter({ hasText: "Restored 1 selected changes" })
                .count(),
              0,
            );
            const durable = await invoke("load_workspace");
            assert.ok(
              sameWorkspace(durable, expected),
              "Native disk state must match this exact boundary",
            );
            const info = await invoke("git_repository_info", {
              repositoryId: fixture.repositoryId,
            });
            assert.equal(info.headOid, fixture.oid);
            const bytes = await readFile(workspacePath);
            await page.screenshot({
              path: join(output, "before-parent-termination.png"),
            });
            const termination = await terminateParent();
            // Parent is confirmed terminal before allowing the held native reply.
            release();
            handoff = { fixture, expected, bytes, termination, counts };
            await Bun.write(
              join(output, "acceptance.json"),
              JSON.stringify(
                {
                  boundary,
                  termination,
                  counts,
                  exactDurableWorkspace: true,
                  unchangedHead: true,
                  limits:
                    "Owned Windows parent termination after completed native command, before UI delivery; not power loss, mid-write crash or other platforms",
                },
                null,
                2,
              ),
            );
          },
          { allowPageClosure: true },
        );
      } finally {
        release();
      }
    },
    { allowParentTermination: true },
  );
  assert.ok(handoff, "Termination must record a verified native boundary");
  await withNativeApp(
    "git-restore-restart-" + boundary,
    async ({ page, invoke, output }) => {
      const { fixture, expected, bytes, termination } = handoff;
      assert.deepEqual(
        await readFile(workspacePath),
        bytes,
        "Fresh process startup must preserve exact durable bytes",
      );
      assert.ok(
        sameWorkspace(await invoke("load_workspace"), expected),
        "Restart must load the full durable workspace, including protected/unselected records",
      );
      await poll(
        async () =>
          (await page
            .getByLabel("Collection", { exact: true })
            .inputValue()) === fixture.workspaceId,
        "Restarted App loaded authoritative selection",
      );
      const url = page.getByLabel("Request URL", { exact: true });
      const expectedUrl = expected.resources.find(
        (/** @type {any} */ r) => r._id === fixture.requestId,
      ).url;
      assert.equal(await url.inputValue(), expectedUrl);
      assert.equal(
        await page.locator(".app-shell").getAttribute("inert"),
        null,
      );
      assert.equal(
        await page
          .getByRole("dialog", { name: "Recover restore", exact: true })
          .count(),
        0,
      );
      assert.equal(
        (
          await invoke("git_repository_info", {
            repositoryId: fixture.repositoryId,
          })
        ).headOid,
        fixture.oid,
      );
      const editedUrl = "https://example.invalid/reopened-" + boundary;
      await url.fill(editedUrl);
      await poll(
        async () =>
          (await invoke("load_workspace")).resources.find(
            (/** @type {any} */ r) => r._id === fixture.requestId,
          ).url === editedUrl,
        "Ordinary save is admitted after parent restart",
      );
      await Bun.write(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            boundary,
            previousTermination: termination,
            exactBytesPreserved: true,
            fullWorkspaceLoaded: true,
            unchangedHead: true,
            ordinarySaveAdmitted: true,
            limits:
              "Fresh owned Windows process after deliberate parent termination; not mid-write/power-loss/other-platform acceptance",
          },
          null,
          2,
        ),
      );
    },
  );
}
