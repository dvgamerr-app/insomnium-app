import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { initialData } from "../../src/lib/model.js";
import { readGitCollection } from "../../src/lib/git-collection.js";
import { encodeGitResource } from "../../src/lib/git-resources.js";
import { planGitClone } from "../../src/lib/git-clone.js";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { advanceFixture, fixtureGit } from "./helpers/git-advance-fixture.js";
import { gitRepositoryPack, gitEmptyRepositoryAdvertisement } from "./helpers/git-repository-pack.js";
import { serveGitPack } from "./helpers/git-smart-http.js";
import { withIpcFailure } from "./helpers/ipc-failure.js";
import { withIpcSuccessHook } from "./helpers/ipc-success-hook.js";
import { lockProbeWorkspaceReplacement } from "./helpers/windows-workspace-lock.js";
import { heldHttp } from "./helpers/held-http.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||= "artifacts/native-recovery-copy-probe/build-state.json";
const http = await heldHttp();
const mode = process.env.INSOMNIUM_CLONE_CASE || "normal";
assert.ok(["normal", "multiple", "collision", "install-uncertain", "write-refusal", "design", "empty", "invalid-parent", "truncated", "stop", "parent-stop", "admission"].includes(mode));
/** @type {{directory:string,destination:string,headOid:string,tree:string,after:any}|undefined} */
let restart;
try {
  await withNativeApp(mode === "normal" ? "git-clone" : "git-clone-" + mode, async context => {
    const { page, invoke, output } = context;
    const x = await advanceFixture(context);
    const blob = await fixtureGit(x.repo, ["hash-object", "-w", "--stdin"], "External Clone content\n");
    const tree = await fixtureGit(x.repo, ["mktree"],
      (mode === "design" ? "" : await fixtureGit(x.repo, ["ls-tree", x.newOid + "^{tree}"]) + "\n") + `100755 blob ${blob}\tclone-external.txt\n`);
    let incoming = await fixtureGit(x.repo, ["commit-tree", tree, "-p", x.newOid], "Clone complete root\n");
    if (mode === "invalid-parent") {
      const committed = await invoke("git_repository_read_commit", { repositoryId: x.f.repositoryId, commitOid: incoming });
      const source = readGitCollection(committed.files);
      const request = source.resources.find(row => row._id === x.f.requestId);
      const environment = source.resources.find(row => row._type === "environment");
      assert.ok(request && environment);
      request.parentId = environment._id;
      const file = encodeGitResource(request);
      const blob = await fixtureGit(x.repo, ["hash-object", "-w", "--stdin"], file.content);
      const requests = await fixtureGit(x.repo, ["mktree"], (await fixtureGit(x.repo, ["ls-tree", incoming + ":.insomnium/Request"]))
        .split("\n").map(line => line.endsWith("\t" + file.path.split("/").pop()) ? `100644 blob ${blob}\t${file.path.split("/").pop()}` : line).join("\n") + "\n");
      const managed = await fixtureGit(x.repo, ["mktree"], (await fixtureGit(x.repo, ["ls-tree", incoming + ":.insomnium"]))
        .replace(/^040000 tree [a-f0-9]{40}\tRequest$/m, `040000 tree ${requests}\tRequest`) + "\n");
      const root = await fixtureGit(x.repo, ["mktree"], (await fixtureGit(x.repo, ["ls-tree", incoming + "^{tree}"]))
        .replace(/^040000 tree [a-f0-9]{40}\t\.insomnium$/m, `040000 tree ${managed}\t.insomnium`) + "\n");
      incoming = await fixtureGit(x.repo, ["commit-tree", root, "-p", incoming], "Invalid typed Clone request parent\n");
    }
    if (mode === "multiple") {
      const second = encodeGitResource({ _id: "wrk_second_" + Date.now(), _type: "workspace", parentId: null,
        name: "Second remote workspace", scope: "collection" });
      const secondBlob = await fixtureGit(x.repo, ["hash-object", "-w", "--stdin"], second.content);
      const roots = await fixtureGit(x.repo, ["mktree"], await fixtureGit(x.repo, ["ls-tree", incoming + ":.insomnium/Workspace"])
        + `\n100644 blob ${secondBlob}\t${second.path.split("/").pop()}\n`);
      const managed = await fixtureGit(x.repo, ["mktree"], (await fixtureGit(x.repo, ["ls-tree", incoming + ":.insomnium"]))
        .replace(/^040000 tree [a-f0-9]{40}\tWorkspace$/m, `040000 tree ${roots}\tWorkspace`) + "\n");
      const root = await fixtureGit(x.repo, ["mktree"], (await fixtureGit(x.repo, ["ls-tree", incoming + "^{tree}"]))
        .replace(/^040000 tree [a-f0-9]{40}\t\.insomnium$/m, `040000 tree ${managed}\t.insomnium`) + "\n");
      incoming = await fixtureGit(x.repo, ["commit-tree", root, "-p", incoming], "Two Clone workspaces\n");
    }
    let pack;
    if (mode === "empty") {
      const emptyId = "empty_" + crypto.randomUUID();
      const repo = join(x.directory, "git-v1", "repo-" + emptyId);
      await invoke("git_repository_init", { repositoryId: emptyId });
      pack = await gitEmptyRepositoryAdvertisement(emptyId, repo);
    } else pack = await gitRepositoryPack(x, incoming);
    const network = serveGitPack(pack);
    const commands = /** @type {string[]} */ ([]);
    const errors = /** @type {string[]} */ ([]);
    const checks = /** @type {string[]} */ ([]);
    page.on("pageerror", cause => errors.push(cause.message));
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.hostname === "ipc.localhost") commands.push(decodeURIComponent(url.pathname.slice(1)));
    });
    try {
      const data = initialData();
      const held = data.resources.find(row => row._id === data.activeRequestId);
      assert.ok(held);
      if (mode === "collision") {
        held._id = x.f.requestId; data.activeRequestId = held._id; data.openTabs = [held._id];
      }
      held.isPrivate = true; held.url = `http://127.0.0.1:${http.port}/held`; held.name = "Retained private Send";
      Object.assign(data.settings, { clonePreservation: { unknown: "kept" } });
      await invoke("save_workspace", { data });
      await page.reload();
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(async () => http.held === 1, "Held private native Send before Clone");
      await page.keyboard.press("Control+s");
      await poll(async () => (await invoke("load_workspace")).resources.some((/** @type {any} */ row) =>
        row._type === "workspace_meta" && row.parentId === data.activeWorkspaceId), "Explicit UI save of initial selection metadata before read-only Clone baseline");
      await page.getByRole("button", { name: "Clone repository", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Clone repository", exact: true });
      await dialog.getByLabel("Clone repository URL", { exact: true }).fill(`http://127.0.0.1:${network.server.port}/repo`);
      if (process.env.INSOMNIUM_CLONE_EXPLICIT_BRANCH === "1")
        await dialog.getByLabel("Clone branch (optional)", { exact: true }).fill("main");
      await dialog.getByLabel("Clone author name", { exact: true }).fill("Clone owner");
      await dialog.getByLabel("Clone author email", { exact: true }).fill("clone@example.invalid");
      const before = await invoke("load_workspace");
      const bytes = await readFile(x.workspace);
      if (mode === "normal") {
        const authorName = dialog.getByLabel("Clone author name", { exact: true });
        const authorEmail = dialog.getByLabel("Clone author email", { exact: true });
        const download = dialog.getByRole("button", { name: "Download Clone for review", exact: true });
        assert.equal(await authorName.evaluate(element => /** @type {HTMLInputElement} */ (element).required), true);
        assert.equal(await authorEmail.getAttribute("type"), "email");
        assert.equal(await authorEmail.evaluate(element => /** @type {HTMLInputElement} */ (element).required), true);
        await authorName.fill("");
        assert.equal(await download.isDisabled(), true);
        assert.equal(await authorName.evaluate(element => /** @type {HTMLInputElement} */ (element).validity.valueMissing), true);
        await authorName.fill("Clone owner");
        await authorEmail.fill("invalid-email");
        assert.equal(await authorEmail.evaluate(element => /** @type {HTMLInputElement} */ (element).validity.typeMismatch), true);
        const rejected = await withIpcFailure(page, "git_clone_stage", false, async () => { await download.click(); });
        assert.equal(rejected.calls, 0, "Native form validation blocks Clone staging");
        assert.equal(network.state.gets + network.state.posts, 0);
        assert.deepEqual(await invoke("load_workspace"), before);
        assert.deepEqual(await readFile(x.workspace), bytes);
        await authorEmail.fill("clone@example.invalid");
        checks.push("required-author-and-malformed-email-refuse-before-stage-network-or-workspace-write");
      }
      if (mode === "truncated" || mode === "stop") {
        network.state.truncateNextPack = mode === "truncated";
        network.state.holdNextPack = mode === "stop";
        await dialog.getByRole("button", { name: "Download Clone for review", exact: true }).click();
        if (mode === "stop") {
          await poll(async () => network.state.packGated, "Actual Clone upload-pack held before Stop");
          await dialog.getByRole("button", { name: "Stop Clone download", exact: true }).click();
        }
        await dialog.getByRole("alert").waitFor();
        await dialog.getByRole("button", { name: "Download Clone for review", exact: true }).waitFor();
        const failedOperation = (await dialog.getByRole("alert").innerText()).match(/Operation: ([a-f0-9-]{36})/);
        assert.ok(failedOperation);
        const failed = (await invoke("git_clone_list")).find((/** @type {any} */ row) => row.operationId === failedOperation[1]);
        assert.equal(failed?.phase, "failed");
        assert.deepEqual(await invoke("load_workspace"), before);
        assert.deepEqual(await readFile(x.workspace), bytes);
        assert.equal(http.cancelled, 0);
        assert.equal(commands.includes("git_clone_install"), false);
        const failedRequests = network.state.gets + network.state.posts;
        await assert.rejects(invoke("git_clone_stage", { input: { operationId: failed.operationId,
          remote: { url: failed.url, credentials: { kind: "anonymous" } }, branch: null } }), /incomplete or unconfirmed/);
        assert.equal(network.state.gets + network.state.posts, failedRequests);
        await dialog.getByRole("button", { name: "Inspect Clone " + failed.operationId, exact: true }).click();
        await dialog.getByRole("alert").filter({ hasText: "incomplete or unconfirmed" }).waitFor();
        assert.equal(network.state.gets + network.state.posts, failedRequests);
        await page.reload();
        await page.getByRole("button", { name: "Clone repository", exact: true }).click();
        await dialog.getByLabel("Clone author name", { exact: true }).fill("Clone owner");
        await dialog.getByLabel("Clone author email", { exact: true }).fill("clone@example.invalid");
        await dialog.getByRole("button", { name: "Inspect Clone " + failed.operationId, exact: true }).click();
        await dialog.getByRole("alert").filter({ hasText: "incomplete or unconfirmed" }).waitFor();
        assert.deepEqual(await invoke("load_workspace"), before);
        assert.deepEqual(await readFile(x.workspace), bytes);
        assert.equal(http.cancelled, 0);
        assert.equal(network.state.gets + network.state.posts, failedRequests);
        if (mode === "stop") {
          await poll(async () => network.state.packAborted > 0, "Stopped Clone pack connection aborted");
          network.state.releasePack?.();
        }
        await dialog.getByLabel("Clone author name", { exact: true }).fill("Clone owner");
        await dialog.getByLabel("Clone author email", { exact: true }).fill("clone@example.invalid");
        await dialog.getByRole("button", { name: "Download Clone for review", exact: true }).click();
        await dialog.getByRole("region", { name: "Clone review", exact: true }).waitFor();
        const ready = (await invoke("git_clone_list")).find((/** @type {any} */ row) => row.url === failed.url && row.phase === "ready" && row.operationId !== failed.operationId);
        assert.ok(ready);
        assert.equal(ready.headOid, incoming);
        await dialog.getByRole("button", { name: "Cancel Clone review", exact: true }).click();
        assert.deepEqual(await invoke("load_workspace"), before);
        assert.deepEqual(await readFile(x.workspace), bytes);
        assert.equal(commands.includes("git_clone_install"), false);
        assert.deepEqual(errors, []);
        await Bun.write(join(output, "acceptance.json"), JSON.stringify({ checks: [
          mode + "-actual-network-failure-no-install-full-state-held-Send-preserved",
          "failed-operation-inspect-and-same-operation-no-network-no-implicit-retry",
          "reload-retains-failed-stage-explicit-new-operation-complete-download-review-cancel",
        ], commands, network: network.state }, null, 2));
        return;
      }
      const fault = await withIpcFailure(page, "git_clone_stage", true, async () => {
        await dialog.getByRole("button", { name: "Download Clone for review", exact: true }).click();
        await dialog.getByRole("alert").filter({ hasText: "Injected IPC failure" }).waitFor();
      });
      assert.equal(fault.calls, 1); assert.equal(fault.completed, 1);
      const stages = await invoke("git_clone_list");
      const operation = (await dialog.getByRole("alert").innerText()).match(/Operation: ([a-f0-9-]{36})/);
      assert.ok(operation);
      const stage = stages.find((/** @type {any} */ row) => row.operationId === operation[1]);
      assert.ok(stage); assert.equal(stage.phase, "ready"); assert.equal(stage.headOid, mode === "empty" ? null : incoming);
      assert.deepEqual(await invoke("load_workspace"), before);
      assert.deepEqual(await readFile(x.workspace), bytes);
      assert.equal(http.cancelled, 0);
      assert.equal(commands.includes("git_clone_install"), false);
      const requests = network.state.gets + network.state.posts;
      if (mode === "normal") {
        await dialog.getByLabel("Clone author email", { exact: true }).fill("invalid-email");
        const rejected = await withIpcFailure(page, "git_clone_inspect", false, async () => {
          await dialog.getByRole("button", { name: "Inspect Clone " + stage.operationId, exact: true }).click();
        });
        assert.equal(rejected.calls, 0, "Retained Clone inspection validates author before IPC");
        assert.equal(network.state.gets + network.state.posts, requests);
        assert.deepEqual(await invoke("load_workspace"), before);
        assert.deepEqual(await readFile(x.workspace), bytes);
        await dialog.getByLabel("Clone author email", { exact: true }).fill("clone@example.invalid");
        checks.push("malformed-author-refuses-retained-inspection-without-network-or-workspace-write");
      }
      await dialog.getByRole("button", { name: "Inspect Clone " + stage.operationId, exact: true }).click();
      if (mode === "collision" || mode === "multiple" || mode === "invalid-parent") {
        await dialog.getByRole("alert").filter({ hasText: mode === "collision" ? "collide" : mode === "multiple" ? "Multiple collection workspaces" : "Invalid or missing parent" }).waitFor();
        if (mode === "invalid-parent") {
          const source = readGitCollection((await invoke("git_clone_inspect", { operationId: stage.operationId })).collection.files);
          const after = structuredClone(before);
          after.resources.push(...source.resources, { _id: "git_invalid_" + crypto.randomUUID(), _type: "git_repository",
            parentId: source.workspaceId, nativeBindingVersion: 1, nativeRepositoryId: stage.repositoryId,
            nativeCloneOperationId: stage.operationId, uri: stage.url, credentials: null,
            author: { name: "Clone owner", email: "clone@example.invalid" } });
          await assert.rejects(invoke("git_clone_install", { input: { expectedReceipt: stage, workspaceId: source.workspaceId,
            beforeWorkspace: before, afterWorkspace: after } }), /Invalid typed parent/);
          assert.equal(commands.filter(command => command === "git_clone_install").length, 1);
        }
        assert.deepEqual(await invoke("load_workspace"), before);
        assert.deepEqual(await readFile(x.workspace), bytes);
        assert.equal(await fixtureGit(x.repo, ["rev-parse", "HEAD"]), x.f.oid);
        assert.equal(http.cancelled, 0);
        assert.equal(network.state.gets + network.state.posts, requests);
        if (mode !== "invalid-parent") assert.equal(commands.includes("git_clone_install"), false);
        assert.equal(await Bun.file(join(x.directory, "git-clone-install-v1.json")).exists(), false);
        assert.deepEqual(errors, []);
        await page.screenshot({ path: join(output, "blocked-clone-review.png") });
        await Bun.write(join(output, "acceptance.json"), JSON.stringify({ checks: [mode + "-actual-full-pack-refuses-review-no-install-or-overwrite-full-workspace-bytes-source-HEAD-held-Send-preserved"], commands, network: network.state, fault }, null, 2));
        return;
      }
      const review = dialog.getByRole("region", { name: "Clone review", exact: true });
      await review.waitFor();
      assert.ok((await review.innerText()).includes(mode === "empty" ? "Empty repository" : incoming));
      assert.equal(network.state.gets + network.state.posts, requests);
      await page.screenshot({ path: join(output, "clone-review.png") });
      await review.getByRole("button", { name: "Cancel Clone review", exact: true }).click();
      assert.deepEqual(await invoke("load_workspace"), before);
      assert.equal(http.cancelled, 0);
      checks.push("real-full-pack-lost-stage-success-inspect-without-network-and-read-only-review-cancel-preserve-full-state-held-Send");

      if (mode === "admission") {
        const candidate = await invoke("git_clone_inspect", { operationId: stage.operationId });
        const plan = planGitClone(before, candidate, { remote: { url: stage.url, credentials: { kind: "anonymous" } },
          author: { name: "Clone owner", email: "clone@example.invalid" } });
        const input = { expectedReceipt: stage, workspaceId: plan.workspaceId, beforeWorkspace: before, afterWorkspace: plan.next };
        const changedReceipt = structuredClone(input);
        changedReceipt.expectedReceipt.headOid = x.f.oid;
        await assert.rejects(invoke("git_clone_install", { input: changedReceipt }), /receipt|candidate|changed/i);
        const stale = structuredClone(input);
        stale.beforeWorkspace.settings.cloneReviewStale = true;
        stale.afterWorkspace.settings.cloneReviewStale = true;
        await assert.rejects(invoke("git_clone_install", { input: stale }), /Workspace changed since Clone review/);
        const source = join(x.directory, "git-clone-v1", "clone-" + stage.operationId, "candidate");
        await fixtureGit(source, ["update-ref", "refs/heads/main", x.f.oid]);
        try { await assert.rejects(invoke("git_clone_install", { input }), /changed|receipt|HEAD/i); }
        finally { await fixtureGit(source, ["update-ref", "refs/heads/main", incoming, x.f.oid]); }
        const destination = join(x.directory, "git-v1", "repo-" + stage.repositoryId);
        const foreign = "Foreign destination must be retained\n";
        await writeFile(destination, foreign, { flag: "wx" });
        try {
          await assert.rejects(invoke("git_clone_install", { input }), /destination already exists/);
          assert.equal(await readFile(destination, "utf8"), foreign);
        } finally { await unlink(destination); }
        assert.deepEqual(await invoke("load_workspace"), before);
        assert.deepEqual(await readFile(x.workspace), bytes);
        assert.equal(await fixtureGit(source, ["rev-parse", "HEAD"]), incoming);
        assert.equal(await fixtureGit(x.repo, ["rev-parse", "HEAD"]), x.f.oid);
        assert.equal(http.cancelled, 0);
        assert.equal(network.state.gets + network.state.posts, requests);
        assert.equal(await Bun.file(join(x.directory, "git-clone-install-v1.json")).exists(), false);
        assert.deepEqual(errors, []);
        await Bun.write(join(output, "acceptance.json"), JSON.stringify({ checks: [
          ...checks, "changed-ready-receipt-stale-full-baseline-changed-source-HEAD-and-foreign-destination-refuse-before-journal-or-install",
        ], commands, network: network.state }, null, 2));
        return;
      }

      await dialog.getByRole("button", { name: "Inspect Clone " + stage.operationId, exact: true }).click();
      if (mode === "install-uncertain" || mode === "write-refusal" || mode === "parent-stop") {
        const recovery = page.getByRole("dialog", { name: "Recover clone", exact: true });
        let lock = /** @type {Awaited<ReturnType<typeof lockProbeWorkspaceReplacement>>|null} */ (null);
        try {
          if (mode === "install-uncertain") {
            const installFault = await withIpcFailure(page, "git_clone_install", true, async () => {
              await review.getByRole("button", { name: "Install cloned collection", exact: true }).click();
              await recovery.waitFor();
            });
            assert.equal(installFault.calls, 1); assert.equal(installFault.completed, 1);
            assert.equal(await Bun.file(join(x.directory, "git-clone-install-v1.json")).exists(), false);
          } else {
            await withIpcSuccessHook(page, "save_workspace", async () => {
              if (!lock) lock = await lockProbeWorkspaceReplacement();
            }, async () => {
              await review.getByRole("button", { name: "Install cloned collection", exact: true }).click();
              await recovery.waitFor();
            });
            assert.ok(lock);
            const pending = await Bun.file(join(x.directory, "git-clone-install-v1.json")).json();
            assert.deepEqual(pending.input.beforeWorkspace, before);
            assert.deepEqual(await readFile(x.workspace), bytes);
            await assert.rejects(invoke("save_workspace", { data: before }), /Clone installation recovery/);
            const target = join(x.directory, "git-v1", "repo-" + stage.repositoryId);
            assert.equal(await fixtureGit(target, ["rev-parse", "HEAD"]), incoming);
            assert.equal(await fixtureGit(target, ["rev-parse", "HEAD^{tree}"]), tree);
            if (mode === "parent-stop") {
              restart = { directory: x.directory, destination: target, headOid: incoming, tree, after: pending.input.afterWorkspace };
              const stopped = await context.terminateParent();
              assert.deepEqual(await readFile(x.workspace), bytes);
              assert.deepEqual(await Bun.file(join(x.directory, "git-clone-install-v1.json")).json(), pending);
              await Bun.write(join(output, "acceptance.json"), JSON.stringify({ stopped, checks: [
                "owned-parent-terminated-after-real-workspace-write-refusal-full-journal-original-bytes-complete-published-repository-preserved",
              ], scope: "Known durable pending Clone install boundary; not midwrite or power-loss acceptance" }, null, 2));
              return;
            }
            lock.release(); lock = null;
          }
          await recovery.getByRole("button", { name: "Retry recovery", exact: true }).click();
          await recovery.waitFor({ state: "hidden" });
          assert.equal(await Bun.file(join(x.directory, "git-clone-install-v1.json")).exists(), false);
          assert.equal(commands.filter(command => command === "git_clone_install").length, 1);
          assert.equal(network.state.gets + network.state.posts, requests);
          const recovered = await invoke("load_workspace");
          assert.equal(recovered.activeWorkspaceId, before.activeWorkspaceId);
          assert.deepEqual(recovered.resources.slice(0, before.resources.length), before.resources);
          await dialog.getByLabel("Clone author name", { exact: true }).fill("Clone owner");
          await dialog.getByLabel("Clone author email", { exact: true }).fill("clone@example.invalid");
          await dialog.getByRole("button", { name: "Inspect Clone " + stage.operationId, exact: true }).click();
          await review.getByRole("button", { name: "Open existing collection", exact: true }).click();
          checks.push(mode + "-authoritative-recovery-full-original-state-one-native-install-no-network-or-resubmission");
        } finally { if (lock) lock.release(); }
      } else await review.getByRole("button", { name: "Install cloned collection", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
      await poll(async () => http.cancelled === 1, "Only confirmed Clone installation drains held Send");
      const after = await invoke("load_workspace");
      const binding = after.resources.find((/** @type {any} */ row) => row._type === "git_repository" && row.nativeCloneOperationId === stage.operationId);
      assert.ok(binding);
      const preview = await invoke("git_clone_inspect", { operationId: stage.operationId });
      const newSpec = after.resources.find((/** @type {any} */ row) => row._type === "api_spec" && row.parentId === binding.parentId);
      const parsed = mode === "empty" || mode === "design" ? { workspaceId: binding.parentId, resources: [
        { _id: binding.parentId, _type: "workspace", parentId: null, name: "repo", scope: "design", description: "Insomnium Workspace for " + stage.url },
        { _id: newSpec?._id, _type: "api_spec", parentId: binding.parentId, contents: "", contentType: "yaml", fileName: "swagger.yml" },
      ] } : readGitCollection(preview.collection.files);
      assert.equal(binding.parentId, parsed.workspaceId);
      const expected = structuredClone(before);
      const expectedBinding = { _id: binding._id, _type: "git_repository", parentId: parsed.workspaceId,
        nativeBindingVersion: 1, nativeRepositoryId: stage.repositoryId,
        author: { name: "Clone owner", email: "clone@example.invalid" }, uri: stage.url, credentials: null,
        nativeCloneOperationId: stage.operationId,
        nativeRemoteBranches: [{ localBranch: "main", remoteBranch: "main", url: stage.url,
          createdOid: mode === "empty" ? null : incoming, cloneOperationId: stage.operationId }] };
      assert.deepEqual(binding, expectedBinding);
      expected.resources.push(...parsed.resources, expectedBinding);
      expected.activeWorkspaceId = parsed.workspaceId;
      expected.activeRequestId = mode === "empty" || mode === "design" ? "" : x.f.requestId;
      expected.activeEnvironmentId = "";
      expected.openTabs = mode === "empty" || mode === "design" ? before.openTabs : [...before.openTabs, x.f.requestId];
      assert.deepEqual(after, expected);
      assert.equal(after.resources.some((/** @type {any} */ row) => row._id === held._id && row.isPrivate), true);
      const destination = join(x.directory, "git-v1", "repo-" + binding.nativeRepositoryId);
      if (mode === "empty") assert.equal((await invoke("git_repository_info", { repositoryId: stage.repositoryId })).headOid, null);
      else assert.equal(await fixtureGit(destination, ["rev-parse", "HEAD"]), incoming);
      assert.equal(await fixtureGit(destination, ["symbolic-ref", "HEAD"]), "refs/heads/main");
      if (mode !== "empty") {
        assert.equal(await fixtureGit(destination, ["ls-tree", incoming, "--", "clone-external.txt"]), `100755 blob ${blob}\tclone-external.txt`);
        assert.equal(await fixtureGit(destination, ["rev-parse", "HEAD^{tree}"]), tree);
      } else assert.equal(network.state.posts, 0, "Empty repository never receives a synthetic successful pack");
      assert.equal(await Bun.file(join(x.directory, "git-clone-install-v1.json")).exists(), false);
      assert.equal(commands.filter(command => command === "git_clone_install").length, 1);
      assert.equal(network.state.gets + network.state.posts, requests);
      checks.push("explicit-one-install-complete-external-tree-modes-history-original-resources-private-data-settings-and-journal-cleanup");

      await page.getByRole("button", { name: "Clone repository", exact: true }).click();
      await dialog.getByLabel("Clone author name", { exact: true }).fill("Clone owner");
      await dialog.getByLabel("Clone author email", { exact: true }).fill("clone@example.invalid");
      await dialog.getByRole("button", { name: "Inspect Clone " + stage.operationId, exact: true }).click();
      await review.getByRole("button", { name: "Open existing collection", exact: true }).waitFor();
      const existing = await invoke("load_workspace");
      await review.getByRole("button", { name: "Open existing collection", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
      assert.deepEqual(await invoke("load_workspace"), existing);
      assert.equal(commands.filter(command => command === "git_clone_install").length, 1);
      assert.equal(network.state.gets + network.state.posts, requests);
      checks.push("existing-ID-opens-local-collection-no-overwrite-rebinding-reinstall-or-network");
      if (mode === "empty" || mode === "design") {
        assert.deepEqual(errors, []);
        await Bun.write(join(output, "acceptance.json"), JSON.stringify({ checks, commands, fault, network: network.state,
          scope: mode + " production new design workspace/ApiSpec/exact original full data/one native install/operation-based reinspection without duplicates" }, null, 2));
        return;
      }
      await page.getByLabel("Request URL", { exact: true }).fill(`http://127.0.0.1:${http.port}/fresh`);
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(async () => http.echoes === 1, "Fresh native Send after Clone installation");
      await poll(async () => (await invoke("load_workspace")).history.some((/** @type {any} */ row) => row.requestId === x.f.requestId && row.status === 200), "Cloned request response persisted");
      await page.reload();
      await page.getByRole("button", { name: "Clone repository", exact: true }).waitFor();
      const reloaded = await invoke("load_workspace");
      assert.equal(reloaded.resources.find((/** @type {any} */ row) => row._id === binding._id).nativeRepositoryId, stage.repositoryId);
      assert.equal(await fixtureGit(destination, ["rev-parse", "HEAD"]), incoming);
      checks.push("fresh-native200-persisted-and-reload-keeps-installed-binding-and-remote-complete-HEAD");
      assert.deepEqual(errors, []);
      await Bun.write(join(output, "acceptance.json"), JSON.stringify({ checks, commands, fault, network: network.state,
        scope: "Windows mounted production Clone stage/review/install/existing navigation; other required Clone cases and faults remain open" }, null, 2));
    } finally { network.close(); }
  }, { allowParentTermination: mode === "parent-stop" });
  if (mode === "parent-stop") await withNativeApp("git-clone-parent-reopen", async ({ page, invoke, output }) => {
    assert.ok(restart);
    assert.deepEqual(await invoke("load_workspace"), restart.after);
    assert.equal(await fixtureGit(restart.destination, ["rev-parse", "HEAD"]), restart.headOid);
    assert.equal(await fixtureGit(restart.destination, ["rev-parse", "HEAD^{tree}"]), restart.tree);
    assert.equal(await Bun.file(join(restart.directory, "git-clone-install-v1.json")).exists(), false);
    assert.equal(await page.getByRole("dialog", { name: "Recover clone", exact: true }).count(), 0);
    await page.getByLabel("Request URL", { exact: true }).fill(`http://127.0.0.1:${http.port}/fresh`);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await poll(async () => http.echoes === 1, "Fresh native Send after pending Clone startup recovery");
    await poll(async () => (await invoke("load_workspace")).history.some((/** @type {any} */ row) =>
      row.requestId === restart?.after.activeRequestId && row.status === 200), "Fresh200 persists after Clone startup recovery");
    await Bun.write(join(output, "acceptance.json"), JSON.stringify({ checks: [
      "startup-recovers-exact-full-reviewed-workspace-complete-repository-and-retires-journal",
      "fresh-native200-persists-after-startup-without-install-or-download-resubmission",
    ] }, null, 2));
  });
} finally { await http.close(); }
