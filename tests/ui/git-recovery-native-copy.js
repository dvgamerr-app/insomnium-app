import assert from "node:assert/strict";
import { join } from "node:path";
import { buildComponentFixture } from "./helpers/component-fixture.js";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { respondToOwnedSaveDialog } from "./helpers/windows-save-dialog.js";
import { sameWorkspace } from "../../src/lib/git-workspace.js";
import { withIpcSuccessHook } from "./helpers/ipc-success-hook.js";
import { lockScenarioCopyWrite } from "./helpers/windows-workspace-lock.js";
import { heldHttp } from "./helpers/held-http.js";

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
try {
  await withNativeApp(
    "git-recovery-native-copy",
    async ({ page, pid, invoke, output }) => {
      const errors = /** @type {string[]} */ ([]);
      page.on("pageerror", (error) => errors.push(error.message));
      const fixture = await gitCollection({ page, invoke });
      fixture.data.resources.find(
        (/** @type {any} */ r) => r._id === fixture.requestId,
      ).url = `http://127.0.0.1:${http.port}/held`;
      await invoke("save_workspace", { data: fixture.data });
      await page.evaluate((seed) => {
        /** @type {any} */ (window).__recoveryNativeSeed = seed;
      }, fixture);
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
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(
        async () => http.held === 1,
        "Real held native request before restore",
      );
      await page.getByRole("button", { name: "Git", exact: true }).click();
      await page
        .getByRole("region", { name: "Source Control", exact: true })
        .getByRole("button", {
          name: "Restore Preserved local request",
          exact: true,
        })
        .click();
      await page
        .getByRole("dialog", { name: "Restore selected changes", exact: true })
        .getByRole("button", { name: "Restore selected changes", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "Recover restore", exact: true })
        .waitFor();
      await poll(
        async () =>
          http.cancelled === 1 && (await evidence()).phase === "recovery",
        "Production restore drain and persistence recovery lock",
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
      assert.deepEqual(
        authoritative.history,
        fixture.data.history,
        "Cancelled held Send must not add history",
      );
      const retained = (await evidence()).retained;
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
              .getByRole("dialog", { name: "Recover restore", exact: true })
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
          .getByRole("dialog", { name: "Recover restore", exact: true })
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
        (await evidence()).restores,
        1,
        "Recovery must not resubmit restore",
      );
      assert.equal(
        await page
          .locator("[data-native-recovery-fixture] .app-shell")
          .getAttribute("inert"),
        null,
      );
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
  await http.close();
}
