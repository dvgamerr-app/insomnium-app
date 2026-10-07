import assert from "node:assert/strict";
import { readFile, writeFile, rename, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
import {
  advanceFixture,
  fixtureGit,
  assertAdvanceCleanup,
} from "./helpers/git-advance-fixture.js";
import { gateProbeMainRefReplacement } from "./helpers/windows-workspace-oplock.js";
import { holdProbeAdvanceLease } from "./helpers/windows-workspace-lock.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
/** @type {Awaited<ReturnType<typeof advanceFixture>>|undefined} */ let x;
/** @type {Buffer|undefined} */ let beforeBytes;
/** @type {string|undefined} */ let markerBytes;
await withNativeApp(
  "git-advance-parent-ref-replace",
  async (context) => {
    x = await advanceFixture(context);
    const fixture = x;
    beforeBytes = await readFile(fixture.workspace);
    const gate = await gateProbeMainRefReplacement(fixture.f.repositoryId);
    const completion = context
      .invoke("git_repository_advance", { input: fixture.input })
      .then(
        (value) => ({ value }),
        (error) => ({ error: String(error) }),
      );
    try {
      await poll(
        async () => !!gate.breakState(),
        "Actual branch replacement oplock break",
      );
      assert.equal(gate.breakState()?.acknowledgementRequired, true);
      assert.equal(await readFile(gate.path, "utf8"), fixture.f.oid + "\n");
      assert.equal(
        await readFile(fixture.branchLock, "utf8"),
        fixture.newOid + "\n",
      );
      assert.deepEqual(await readFile(fixture.workspace), beforeBytes);
      assert.deepEqual(
        JSON.parse(await readFile(fixture.journalPath, "utf8")),
        fixture.journal,
      );
      markerBytes = await readFile(fixture.marker, "utf8");
      const marker = JSON.parse(markerBytes);
      assert.equal(marker.operation, fixture.journal.operationId);
      assert.equal(marker.old_oid, fixture.f.oid);
      assert.equal(marker.new_oid, fixture.newOid);
      assert.deepEqual(
        marker.locks.map((/** @type {any} */ lock) => lock.name),
        ["HEAD", "refs/heads/main"],
      );
      await Bun.write(
        join(context.output, "ownership-before-crash.json"),
        markerBytes,
      );
      const termination = await context.terminateParent();
      await Bun.write(
        join(context.output, "acceptance.json"),
        JSON.stringify(
          {
            passed: true,
            termination,
            breakState: gate.breakState(),
            fullBranchCandidate: fixture.newOid,
            exactOriginalWorkspace: true,
            scope:
              "Owned Windows parent interruption after branch lock write, before actual ref rename; no power-loss/partial-byte claim.",
          },
          null,
          2,
        ),
      );
    } finally {
      gate.release();
    }
    const result = await completion;
    assert.ok("error" in result, "Terminated parent cannot deliver success");
  },
  { allowParentTermination: true },
);
assert.ok(x && beforeBytes && markerBytes);
const fixture = x;
const original = beforeBytes;
const ownership = markerBytes;
const liveLease = await holdProbeAdvanceLease(fixture.f.repositoryId);
try {
  await withNativeApp(
    "git-advance-restart-ref-replace",
    async ({ page, invoke, output }) => {
      await assert.rejects(
        () => invoke("load_workspace"),
        /owner is still active/,
      );
      assert.equal(await readFile(fixture.marker, "utf8"), ownership);
      assert.equal(
        await readFile(fixture.branchLock, "utf8"),
        fixture.newOid + "\n",
      );
      assert.deepEqual(await readFile(fixture.workspace), original);
      liveLease.release();

      const changed = JSON.parse(ownership);
      changed.lease_identity += "_changed";
      await writeFile(fixture.marker, JSON.stringify(changed));
      try {
        await assert.rejects(
          () => invoke("load_workspace"),
          /lease identity changed/,
        );
        assert.equal(
          await readFile(fixture.marker, "utf8"),
          JSON.stringify(changed),
        );
        assert.equal(
          await readFile(fixture.branchLock, "utf8"),
          fixture.newOid + "\n",
        );
        assert.deepEqual(await readFile(fixture.workspace), original);
      } finally {
        await writeFile(fixture.marker, ownership);
      }

      const retained = join(
        dirname(fixture.branchLock),
        "main.lock.saved-" + crypto.randomUUID(),
      );
      await assert.rejects(() => stat(retained), { code: "ENOENT" });
      await rename(fixture.branchLock, retained);
      const sentinel = "Foreign branch lock must survive\n";
      await writeFile(fixture.branchLock, sentinel, { flag: "wx" });
      try {
        await assert.rejects(
          () => invoke("load_workspace"),
          /Owned advance ref lock changed/,
        );
        assert.equal(await readFile(fixture.branchLock, "utf8"), sentinel);
        assert.equal(await readFile(fixture.marker, "utf8"), ownership);
        assert.deepEqual(await readFile(fixture.workspace), original);
      } finally {
        assert.equal(await readFile(fixture.branchLock, "utf8"), sentinel);
        await rm(fixture.branchLock);
        await rename(retained, fixture.branchLock);
      }
      assert.deepEqual(await invoke("load_workspace"), fixture.before);
      assert.deepEqual(await readFile(fixture.workspace), original);
      assert.equal(
        await fixtureGit(fixture.repo, ["rev-parse", "refs/heads/main"]),
        fixture.f.oid,
      );
      await assertAdvanceCleanup(fixture);
      const result = await invoke("git_repository_advance", {
        input: fixture.input,
      });
      assert.deepEqual(result.workspace, fixture.after);
      assert.equal(result.headOid, fixture.newOid);
      await assertAdvanceCleanup(fixture);
      await page.reload();
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
              "live-lease-refusal",
              "changed-lease-refusal",
              "replaced-ref-file-preservation",
              "matching-full-OID-orphan-recovery",
              "exact-old-before-abort",
              "fresh-native-advance-and-cleanup",
            ],
            scope:
              "Actual native advancement interruption/restart at Windows ref replacement; not network pull/merge, power loss, partial bytes or other platforms.",
          },
          null,
          2,
        ),
      );
    },
  );
} finally {
  liveLease.release();
}
