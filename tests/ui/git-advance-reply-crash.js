import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { withIpcSuccessHook } from "./helpers/ipc-success-hook.js";
import {
  advanceFixture,
  fixtureGit,
  assertAdvanceCleanup,
} from "./helpers/git-advance-fixture.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
/** @type {Awaited<ReturnType<typeof advanceFixture>>|undefined} */ let fixture;
/** @type {Buffer|undefined} */ let durableBytes;
await withNativeApp(
  "git-advance-parent-lost-success",
  async (context) => {
    const x = await advanceFixture(context);
    fixture = x;
    let reached = false;
    /** @type {()=>void} */ let release = () => {};
    const gate = new Promise((resolve) => {
      release = () => resolve(undefined);
    });
    try {
      await withIpcSuccessHook(
        context.page,
        "git_repository_advance",
        async () => {
          reached = true;
          await gate;
        },
        async () => {
          const reply = context
            .invoke("git_repository_advance", { input: x.input })
            .then(
              (value) => ({ value }),
              (error) => ({ error: String(error) }),
            );
          await poll(
            async () => reached,
            "Actual successful advancement reply withheld",
          );
          const counts = await context.page.evaluate(() => {
            const state = /** @type {any} */ (window).__ipcSuccessFixture;
            return { calls: state.calls, hooks: state.hooks };
          });
          assert.deepEqual(counts, { calls: 1, hooks: 1 });
          durableBytes = await readFile(x.workspace);
          assert.deepEqual(JSON.parse(durableBytes.toString()), x.after);
          assert.equal(
            await fixtureGit(x.repo, ["rev-parse", "refs/heads/main"]),
            x.newOid,
          );
          await assertAdvanceCleanup(x);
          const termination = await context.terminateParent();
          release();
          assert.ok("error" in (await reply));
          await Bun.write(
            join(context.output, "acceptance.json"),
            JSON.stringify(
              {
                passed: true,
                counts,
                termination,
                scope:
                  "Owned Windows parent termination after successful native advance, before unchanged reply reaches caller; no power-loss/mid-write/network claim.",
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
assert.ok(fixture && durableBytes);
const x = fixture;
const bytes = durableBytes;
await withNativeApp(
  "git-advance-restart-lost-success",
  async ({ page, invoke, output }) => {
    assert.deepEqual(await readFile(x.workspace), bytes);
    assert.deepEqual(await invoke("load_workspace"), x.after);
    assert.equal(
      (await invoke("git_repository_info", { repositoryId: x.f.repositoryId }))
        .headOid,
      x.newOid,
    );
    await assert.rejects(
      () => invoke("git_repository_advance", { input: x.input }),
      /Persisted workspace changed/,
    );
    assert.deepEqual(await readFile(x.workspace), bytes);
    assert.equal(
      await fixtureGit(x.repo, ["rev-parse", "refs/heads/main"]),
      x.newOid,
    );
    await assertAdvanceCleanup(x);
    await invoke("save_workspace", { data: x.after });
    assert.deepEqual(await invoke("load_workspace"), x.after);
    assert.equal(
      await page.getByLabel("Request URL", { exact: true }).inputValue(),
      "https://example.invalid/advance-writer",
    );
    await Bun.write(
      join(output, "acceptance.json"),
      JSON.stringify(
        {
          passed: true,
          checks: [
            "exact-completed-bytes-on-startup",
            "authoritative-new-tip-and-workspace",
            "stale-second-advance-refused",
            "ordinary-save-admission-and-cleanup",
          ],
          scope:
            "Fresh Windows native process after successful-command lost reply; no second automatic advance.",
        },
        null,
        2,
      ),
    );
  },
);
