import assert from "node:assert/strict";
import { join } from "node:path";
import { buildComponentFixture } from "./helpers/component-fixture.js";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { respondToOwnedSaveDialog } from "./helpers/windows-save-dialog.js";
import { sameWorkspace } from "../../src/lib/git-workspace.js";
import { withIpcSuccessHook } from "./helpers/ipc-success-hook.js";
import { lockScenarioCopyWrite } from "./helpers/windows-workspace-lock.js";

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
await withNativeApp(
  "git-recovery-native-copy",
  async ({ page, pid, invoke, output }) => {
    const fixture = await gitCollection({ page, invoke });
    await page.evaluate((seed) => {
      /** @type {any} */ (window).__recoveryNativeSeed = seed;
    }, fixture);
    await page.addScriptTag({
      url: new URL("/__saved-recovery-fixture.js", page.url()).href,
      type: "module",
    });
    const evidence = async () =>
      JSON.parse(
        (await page
          .getByLabel("Native recovery fixture evidence")
          .textContent()) || "",
      );
    await poll(async () => {
      const value = await evidence();
      if (value.failure) throw new Error(value.failure);
      return value.ready;
    }, "Retained native coordinator snapshot");
    const authoritative = await invoke("load_workspace");
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
          await page.getByRole("alert").waitFor();
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
          return await page.getByRole("alert").innerText();
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
    await poll(
      async () => (await evidence()).complete,
      "Reviewed native authoritative recovery",
    );
    assert.ok(sameWorkspace((await evidence()).current, authoritative));
    assert.ok(
      sameWorkspace(await invoke("load_workspace"), authoritative),
      "Recovery must not persist retained edits over restored workspace",
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
          scope:
            "Actual Windows picker/native file write and real restore coordinator with isolated fixture mutation; full app unexpected-edit admission and other platforms remain pending",
        },
        null,
        2,
      ),
    );
  },
);
