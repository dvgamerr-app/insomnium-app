import assert from "node:assert/strict";
import {
  readFile,
  readdir,
  writeFile,
  rename,
  rm,
  realpath,
  stat,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { withIpcSuccessHook } from "./helpers/ipc-success-hook.js";
import { gateProbeWorkspaceReplacement } from "./helpers/windows-workspace-oplock.js";
import { holdProbeRestoreLease } from "./helpers/windows-workspace-lock.js";
import { createGitClient } from "../../src/lib/git-client.js";
import { encodeGitResource } from "../../src/lib/git-resources.js";
import {
  checkoutWorkspace,
  sameWorkspace,
} from "../../src/lib/git-workspace.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
/** @type {any} */ let handoff;
await withNativeApp(
  "git-restore-pre-replace-parent",
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
    await page.getByRole("button", { name: "Git", exact: true }).click();
    await page
      .getByRole("region", { name: "Source Control", exact: true })
      .getByRole("button", {
        name: "Restore Preserved local request",
        exact: true,
      })
      .click();
    /** @type {Awaited<ReturnType<typeof gateProbeWorkspaceReplacement>>|undefined} */ let gate;
    try {
      await withIpcSuccessHook(
        page,
        "save_workspace",
        async () => {
          gate = await gateProbeWorkspaceReplacement();
        },
        async () => {
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
          await poll(
            async () => !!gate,
            "Baseline save and native oplock acquisition",
          );
          assert.ok(gate);
          const path = gate.path;
          await poll(
            async () => !!gate?.breakState(),
            "Actual atomic-replace oplock break",
          );
          const breakState = gate.breakState();
          assert.ok(
            breakState?.acknowledgementRequired,
            "Rename must wait for acknowledgement",
          );
          const bytes = await readFile(path);
          assert.ok(
            sameWorkspace(JSON.parse(bytes.toString()), before),
            "Original file must remain intact before replace",
          );
          const root = dirname(path);
          const candidates = [];
          for (const name of await readdir(root)) {
            if (!/^\.workspace-v1\.json\.[A-Za-z0-9]{6}$/.test(name)) continue;
            const candidate = await readFile(join(root, name));
            if (sameWorkspace(JSON.parse(candidate.toString()), after))
              candidates.push(name);
          }
          assert.equal(
            candidates.length,
            1,
            "Actual native candidate temp must be complete while replacement is blocked",
          );
          assert.notEqual(
            await page.locator(".app-shell").getAttribute("inert"),
            null,
          );
          const termination = await terminateParent();
          gate.release();
          gate = undefined;
          handoff = {
            fixture,
            before,
            after,
            path,
            bytes,
            candidates,
            breakState,
            termination,
          };
          await Bun.write(
            join(output, "acceptance.json"),
            JSON.stringify(
              {
                breakState,
                candidates,
                termination,
                originalPreserved: true,
                candidateCompleteBeforeReplace: true,
                limits:
                  "Windows process interruption after candidate write/flush before atomic replacement; not partial-byte write, power loss or disk full",
              },
              null,
              2,
            ),
          );
        },
        { allowPageClosure: true },
      );
    } finally {
      gate?.release();
    }
  },
  { allowParentTermination: true },
);
assert.ok(handoff);
await withNativeApp(
  "git-restore-pre-replace-restart",
  async ({ page, invoke, output }) => {
    assert.deepEqual(await readFile(handoff.path), handoff.bytes);
    assert.ok(sameWorkspace(await invoke("load_workspace"), handoff.before));
    const gitRoot = join(
      dirname(handoff.path),
      "git-v1",
      "repo-" + handoff.fixture.repositoryId,
      ".git",
    );
    const ownershipPath = join(gitRoot, "insomnium-restore-ref-locks-v1.json");
    const ownership = await readFile(ownershipPath);
    const headLock = join(gitRoot, "HEAD.lock");
    const branchLock = join(gitRoot, "refs", "heads", "main.lock");
    const headBytes = await readFile(headLock);
    const branchBytes = await readFile(branchLock);
    const lease = await holdProbeRestoreLease(handoff.fixture.repositoryId);
    try {
      await assert.rejects(
        () =>
          invoke("git_repository_info", {
            repositoryId: handoff.fixture.repositoryId,
          }),
        /owner is still active/,
      );
      assert.deepEqual(await readFile(headLock), headBytes);
      assert.deepEqual(await readFile(branchLock), branchBytes);
      assert.deepEqual(await readFile(ownershipPath), ownership);
    } finally {
      lease.release();
    }
    // Changed lease identity must preserve every ref file and the marker.
    const changed = JSON.parse(ownership.toString());
    changed.lease_identity += "-unknown";
    const changedBytes = Buffer.from(JSON.stringify(changed));
    await writeFile(ownershipPath, changedBytes);
    try {
      await assert.rejects(
        () =>
          invoke("git_repository_info", {
            repositoryId: handoff.fixture.repositoryId,
          }),
        /lease identity changed/,
      );
      assert.deepEqual(await readFile(headLock), headBytes);
      assert.deepEqual(await readFile(branchLock), branchBytes);
      assert.deepEqual(await readFile(ownershipPath), changedBytes);
    } finally {
      await writeFile(ownershipPath, ownership);
    }
    // Replace the recorded ref lock with a new unowned file. Its identity and
    // contents must be refused without deleting either it or the other lock.
    assert.equal(
      (await realpath(gitRoot)).toLowerCase(),
      resolve(gitRoot).toLowerCase(),
    );
    // Rename within the same directory/volume to preserve the owned FileID.
    const retainedHead = join(
      gitRoot,
      "insomnium-scenario-owned-HEAD-" + Date.now() + ".retained",
    );
    await assert.rejects(() => stat(retainedHead), { code: "ENOENT" });
    const unowned = Buffer.from(
      "Scenario-owned replacement; native recovery must preserve it",
    );
    await rename(headLock, retainedHead);
    try {
      await writeFile(headLock, unowned, { flag: "wx" });
      await assert.rejects(
        () =>
          invoke("git_repository_info", {
            repositoryId: handoff.fixture.repositoryId,
          }),
        /ref lock changed/,
      );
      assert.deepEqual(await readFile(headLock), unowned);
      assert.deepEqual(await readFile(branchLock), branchBytes);
      assert.deepEqual(await readFile(ownershipPath), ownership);
    } finally {
      assert.deepEqual(
        await readFile(headLock),
        unowned,
        "Remove only this scenario's exact replacement",
      );
      await rm(headLock);
      await rename(retainedHead, headLock);
    }
    assert.equal(
      (
        await invoke("git_repository_info", {
          repositoryId: handoff.fixture.repositoryId,
        })
      ).headOid,
      handoff.fixture.oid,
    );
    for (const path of [headLock, branchLock, ownershipPath]) {
      await assert.rejects(() => stat(path), { code: "ENOENT" });
    }
    assert.deepEqual(await readFile(handoff.path), handoff.bytes);
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
    await page
      .getByRole("dialog", { name: "Restore selected changes", exact: true })
      .getByRole("button", { name: "Restore selected changes", exact: true })
      .click();
    await panel
      .getByRole("status")
      .filter({ hasText: "Restored 1 selected changes" })
      .waitFor();
    assert.ok(
      sameWorkspace(await invoke("load_workspace"), handoff.after),
      "Fresh native restore must work after interrupted replacement",
    );
    for (const path of [headLock, branchLock, ownershipPath]) {
      await assert.rejects(() => stat(path), { code: "ENOENT" });
    }
    await Bun.write(
      join(output, "acceptance.json"),
      JSON.stringify(
        {
          originalExactBytes: true,
          fullWorkspaceLoaded: true,
          headUnchanged: true,
          freshRestore: true,
          liveOwnerRefused: true,
          unknownLeaseIdentityPreserved: true,
          replacedRefLockPreserved: true,
          ownedLocksAndMarkerRemoved: true,
        },
        null,
        2,
      ),
    );
  },
);
