import assert from "node:assert/strict";
import { heldHttp } from "./helpers/held-http.js";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { withIpcFailure } from "./helpers/ipc-failure.js";
import { snapshotGitCollection } from "../../src/lib/git-collection.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-restore-ui-probe/build-state.json";

const fixtureHttp = await heldHttp({ body: "fresh after restore" });
try {
  await withNativeApp("git-restore", async ({ page, invoke, output }) => {
    const errors = /** @type {string[]} */ ([]);
    page.on("pageerror", (error) => errors.push(error.message));
    const fixture = await gitCollection({ page, invoke });
    const data = await invoke("load_workspace");
    const find = (/** @type {any} */ value, /** @type {string} */ id) =>
      value.resources.find((/** @type {any} */ r) => r._id === id);
    const request = find(data, fixture.requestId);
    request.url = "https://example.invalid/baseline";
    const deletedId = fixture.requestId + "_deleted";
    const addedId = fixture.requestId + "_added";
    data.resources.push({
      ...structuredClone(request),
      _id: deletedId,
      name: "Deleted restore fixture",
    });
    await invoke("save_workspace", { data });
    const oid = await invoke("git_repository_commit", {
      repositoryId: fixture.repositoryId,
      input: {
        branch: "main",
        expectedHeadOid: fixture.oid,
        workspaceId: fixture.workspaceId,
        files: snapshotGitCollection(data.resources, fixture.workspaceId).files,
        authorName: fixture.author.name,
        authorEmail: fixture.author.email,
        message: "Restore baseline",
      },
    });
    request.url = "https://example.invalid/local-edit";
    data.resources = data.resources.filter(
      (/** @type {any} */ r) => r._id !== deletedId,
    );
    data.resources.push({
      ...structuredClone(request),
      _id: addedId,
      name: "Added restore fixture",
    });
    const environment = data.resources.find(
      (/** @type {any} */ r) =>
        r.parentId === fixture.workspaceId && r._type === "environment",
    );
    environment.data = { retained: "unselected local value" };
    const protectedResources = data.resources.filter(
      (/** @type {any} */ r) =>
        r._type === "workspace_meta" ||
        r._type === "git_repository" ||
        (r._id !== fixture.workspaceId && r.parentId !== fixture.workspaceId),
    );
    await invoke("save_workspace", { data });
    await page.reload();
    await page.getByRole("button", { name: "Git", exact: true }).click();
    const panel = page.getByRole("region", {
      name: "Source Control",
      exact: true,
    });
    const review = page.getByRole("dialog", {
      name: "Restore selected changes",
      exact: true,
    });
    const restoreRequest = panel.getByRole("button", {
      name: "Restore Preserved local request",
      exact: true,
    });
    await restoreRequest.waitFor();
    const before = await invoke("load_workspace");
    const after = structuredClone(before);
    find(after, fixture.requestId).url = "https://example.invalid/baseline";
    const input = {
      operationId: "pw_restore_" + crypto.randomUUID().replaceAll("-", ""),
      repositoryId: fixture.repositoryId,
      workspaceId: fixture.workspaceId,
      branch: "main",
      headOid: oid,
      selectedIds: [fixture.requestId],
      beforeWorkspace: before,
      afterWorkspace: after,
    };
    /** @param {Record<string,any>} candidate @param {RegExp} reason */
    async function refused(candidate, reason) {
      let error = "";
      try {
        await invoke("git_repository_restore", { input: candidate });
      } catch (cause) {
        error = String(cause);
      }
      assert.match(error, reason);
      assert.deepEqual(
        (await invoke("load_workspace")).resources,
        before.resources,
      );
    }
    await refused({ ...input, headOid: fixture.oid }, /HEAD changed/);
    const unselected = structuredClone(after);
    find(unselected, environment._id).data = { unexpected: true };
    await refused(
      { ...input, afterWorkspace: unselected },
      /unselected resource/,
    );
    const staleWorkspace = structuredClone(before);
    find(staleWorkspace, fixture.requestId).url =
      "https://example.invalid/stale";
    await refused(
      { ...input, beforeWorkspace: staleWorkspace },
      /Persisted workspace changed/,
    );
    await restoreRequest.click();
    await review.waitFor();
    assert.match(await review.innerText(), /Preserved local request/);
    assert.deepEqual(
      (await invoke("load_workspace")).resources,
      before.resources,
    );
    for (const theme of ["dark", "light"]) {
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
      }, theme);
      for (const width of [900, 760]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(
          await review.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
          true,
        );
        await page.screenshot({
          path: `${output}/${theme}-review-${width}.png`,
        });
      }
    }
    await review
      .getByRole("button", { name: "Cancel restore", exact: true })
      .click();
    await review.waitFor({ state: "hidden" });
    assert.deepEqual(
      (await invoke("load_workspace")).resources,
      before.resources,
    );
    await restoreRequest.click();
    await review
      .getByRole("button", { name: "Restore selected changes", exact: true })
      .click();
    await review.waitFor({ state: "hidden" });
    await panel
      .getByRole("status")
      .filter({ hasText: "Restored 1 selected changes" })
      .waitFor();
    let saved = await invoke("load_workspace");
    assert.equal(
      find(saved, fixture.requestId).url,
      "https://example.invalid/baseline",
    );
    assert.deepEqual(find(saved, environment._id).data, environment.data);
    assert.equal(find(saved, deletedId), undefined);
    assert.ok(find(saved, addedId));
    for (const name of ["Deleted restore fixture", "Added restore fixture"]) {
      await panel
        .getByRole("button", { name: "Stage " + name, exact: true })
        .click();
    }
    await panel
      .getByRole("button", { name: "Restore staged changes", exact: true })
      .click();
    await review.waitFor();
    assert.match(await review.innerText(), /Deleted restore fixture/);
    assert.match(await review.innerText(), /Added restore fixture/);
    await review
      .getByRole("button", { name: "Restore selected changes", exact: true })
      .click();
    await review.waitFor({ state: "hidden" });
    await panel
      .getByRole("status")
      .filter({ hasText: "Restored 2 selected changes" })
      .waitFor();
    saved = await invoke("load_workspace");
    assert.equal(find(saved, deletedId).name, "Deleted restore fixture");
    assert.equal(find(saved, addedId), undefined);
    assert.deepEqual(find(saved, environment._id).data, environment.data);
    for (const resource of protectedResources) {
      assert.deepEqual(find(saved, resource._id), resource);
    }
    assert.equal(
      (
        await invoke("git_repository_info", {
          repositoryId: fixture.repositoryId,
        })
      ).headOid,
      oid,
    );
    await page.reload();
    await poll(
      async () =>
        (await page
          .getByRole("textbox", { name: "Request URL", exact: true })
          .inputValue()) === "https://example.invalid/baseline",
      "Restored request survives reload",
    );
    saved = await invoke("load_workspace");
    find(saved, fixture.requestId).url = "https://example.invalid/lost-reply";
    await invoke("save_workspace", { data: saved });
    await page.reload();
    await page.getByRole("button", { name: "Git", exact: true }).click();
    await restoreRequest.click();
    await review.waitFor();
    const fault = await withIpcFailure(
      page,
      "git_repository_restore",
      true,
      async () => {
        await review
          .getByRole("button", {
            name: "Restore selected changes",
            exact: true,
          })
          .click();
        const recovery = page.getByRole("dialog", {
          name: "Recover restore",
          exact: true,
        });
        await recovery.waitFor();
        await page.keyboard.press("Escape");
        assert.equal(await recovery.isVisible(), true);
        assert.equal(
          find(await invoke("load_workspace"), fixture.requestId).url,
          "https://example.invalid/baseline",
        );
        await recovery
          .getByRole("button", { name: "Retry recovery", exact: true })
          .click();
        await recovery.waitFor({ state: "hidden" });
      },
    );
    assert.equal(fault.calls, 1, "uncertain success never resubmits restore");
    assert.equal(fault.completed, 1);
    saved = await invoke("load_workspace");
    const historyBeforeDrain = structuredClone(saved.history);
    find(saved, fixture.requestId).url =
      `http://127.0.0.1:${fixtureHttp.port}/held`;
    await invoke("save_workspace", { data: saved });
    await page.reload();
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await poll(
      async () => fixtureHttp.held === 1,
      "held native request reached server",
    );
    await page.getByRole("button", { name: "Git", exact: true }).click();
    await restoreRequest.click();
    await review
      .getByRole("button", { name: "Restore selected changes", exact: true })
      .click();
    await review.waitFor({ state: "hidden" });
    await panel
      .getByRole("status")
      .filter({ hasText: "Restored 1 selected changes" })
      .waitFor();
    await poll(
      async () => fixtureHttp.cancelled === 1,
      "restore drain closes active native HTTP connection",
    );
    saved = await invoke("load_workspace");
    assert.equal(
      find(saved, fixture.requestId).url,
      "https://example.invalid/baseline",
    );
    assert.deepEqual(
      saved.history,
      historyBeforeDrain,
      "cancelled send adds no history after restore",
    );
    await page.reload();
    await page
      .getByLabel("Request URL", { exact: true })
      .fill(`http://127.0.0.1:${fixtureHttp.port}/fresh`);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await poll(
      async () => fixtureHttp.echoes === 1,
      "fresh native send after restore",
    );
    await poll(
      async () =>
        (await invoke("load_workspace")).history.some(
          (/** @type {any} */ response) =>
            response.requestId === fixture.requestId &&
            response.status === 200 &&
            !historyBeforeDrain.some(
              (/** @type {any} */ previous) => previous._id === response._id,
            ),
        ),
      "fresh response persists after drain",
    );
    assert.equal(
      (
        await invoke("git_repository_info", {
          repositoryId: fixture.repositoryId,
        })
      ).headOid,
      oid,
    );
    assert.deepEqual(errors, []);
    await Bun.write(
      output + "/acceptance.json",
      JSON.stringify(
        {
          status: "passed",
          cases: [
            "native stale HEAD/unselected write/stale workspace refusal",
            "read-only review",
            "cancel",
            "selected modify preserves unselected",
            "selected delete/add batch",
            "protected resources",
            "HEAD unchanged",
            "reload",
            "lost-success reply recovery without resend",
            "active native HTTP drain closes connection without history",
            "fresh native send after restore drain",
            "dark/light review widths",
          ],
          limits:
            "Disk fault and retained-copy OS picker need separate acceptance.",
        },
        null,
        2,
      ),
    );
  });
} finally {
  await fixtureHttp.close();
}
