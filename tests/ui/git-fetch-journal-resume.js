import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { BaseDirectory } from "@tauri-apps/api/path";
import { withNativeApp, probeIdentifier } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { withIpcFailure } from "./helpers/ipc-failure.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-fetch-workspace-fence-ui-probe/build-state.json";

/** Git plumbing only prepares owned UI fixture objects, not product behavior.
 * @param {string[]} args @param {string} [input] */
async function git(args, input = "") {
  const env = { ...process.env };
  for (const name of Object.keys(env))
    if (name.startsWith("GIT_")) delete env[name];
  Object.assign(env, {
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "NUL",
    GIT_AUTHOR_NAME: "Recovery UI fixture",
    GIT_AUTHOR_EMAIL: "fixture@insomnium.invalid",
    GIT_COMMITTER_NAME: "Recovery UI fixture",
    GIT_COMMITTER_EMAIL: "fixture@insomnium.invalid",
  });
  return await new Promise((resolve, reject) => {
    const child = execFile(
      "git",
      args,
      { env, shell: false, windowsHide: true, maxBuffer: 1048576 },
      (error, stdout, stderr) =>
        error
          ? reject(new Error(stderr || String(error)))
          : resolve(stdout.trim()),
    );
    child.stdin?.end(input);
  });
}

for (const loseReply of [false, true]) {
  await withNativeApp(
    loseReply ? "git-fetch-resume-lost-reply" : "git-fetch-resume-success",
    async ({ page, invoke, output }) => {
      const f = await gitCollection({ page, invoke });
      const appData = resolve(
        await invoke("plugin:path|resolve_directory", {
          directory: BaseDirectory.AppData,
        }),
      );
      assert.equal(basename(appData), probeIdentifier);
      const data = await invoke("load_workspace");
      const binding = data.resources.find(
        /** @param {any} r */ (r) => r._id === f.repositoryId,
      );
      const operationId = crypto.randomUUID();
      let networkRequests = 0;
      const server = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        fetch() {
          networkRequests++;
          return new Response("Recovery must not download", { status: 500 });
        },
      });
      binding.uri = "http://127.0.0.1:" + server.port + "/repo";
      binding.credentials = null;
      binding.nativeFetchIntent = {
        version: 3,
        operationId,
        workspaceId: f.workspaceId,
        repositoryId: f.repositoryId,
        url: binding.uri,
        branch: "main",
        depth: 1,
      };
      await invoke("save_workspace", { data });
      const request = {
        requestId: operationId,
        workspaceId: f.workspaceId,
        repositoryId: f.repositoryId,
        expectedBinding: structuredClone(binding),
        branch: "main",
      };
      const gitDir = join(appData, "git-v1", "repo-" + f.repositoryId, ".git");
      const head = await readFile(join(gitDir, "HEAD"), "utf8");
      const stageName = "fetch-" + crypto.randomUUID(),
        stage = join(appData, "git-fetch-v1", stageName);
      const stageGit = join(stage, "repository");
      await mkdir(stageGit, { recursive: true });
      const owner =
        "insomnium-fetch-stage-v2\n" +
        crypto.randomUUID() +
        "\n" +
        process.pid +
        "\n";
      await writeFile(join(stage, ".insomnium-fetch-owner"), owner);
      await writeFile(join(stage, ".insomnium-fetch-lease"), "");
      const journalPath = join(gitDir, "insomnium-fetch-journal-v1.json");
      let ownsJournal = false;
      try {
        await git([
          "init",
          "--bare",
          "--object-format=sha1",
          "--template=",
          stageGit,
        ]);
        const blob = await git(
          ["--git-dir", stageGit, "hash-object", "-w", "--stdin"],
          "remote fixture content\n",
        );
        const tree = await git(
          ["--git-dir", stageGit, "mktree"],
          "100644 blob " + blob + "\tremote.txt\n",
        );
        // Missing parent is intentional: the v3 logical boundary must stop at tip.
        const tip = await git(
          [
            "--git-dir",
            stageGit,
            "hash-object",
            "-t",
            "commit",
            "-w",
            "--stdin",
          ],
          "tree " +
            tree +
            "\nparent " +
            "1".repeat(40) +
            "\nauthor Fixture <fixture@insomnium.invalid> 1700000000 +0000\ncommitter Fixture <fixture@insomnium.invalid> 1700000000 +0000\n\nShallow remote tip\n",
        );
        const endpointKey = Buffer.from(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(binding.uri),
          ),
        ).toString("hex");
        const manifest = {
          version: 3,
          endpointKey,
          operationId,
          branches: [{ name: "main", reference: "refs/heads/main", oid: tip }],
          defaultBranch: "main",
          selectedBranch: "main",
          requestedDepth: 1,
          histories: [{ name: "main", depth: 1, boundaries: [tip] }],
        };
        const manifestBlob = await git(
          ["--git-dir", stageGit, "hash-object", "-w", "--stdin"],
          JSON.stringify(manifest),
        );
        const snapshotTree = await git(
          ["--git-dir", stageGit, "mktree"],
          "100644 blob " + manifestBlob + "\tsnapshot.json\n",
        );
        const target = await git(
          ["--git-dir", stageGit, "commit-tree", snapshotTree, "-p", tip],
          "Recovery UI snapshot\n",
        );
        const journal = JSON.stringify({
          schemaVersion: 1,
          operationId,
          endpointKey,
          expectedSnapshot: null,
          targetSnapshot: target,
          stageName,
          stageOwner: owner,
          oldShallow: null,
          preparedShallow: tip + "\n",
          finalShallow: tip + "\n",
        });
        await writeFile(journalPath, journal, { flag: "wx" });
        ownsJournal = true;
        await assert.rejects(
          invoke("git_remote_fetch_recover", {
            request: { fetch: request, depth: 1, attemptId: operationId },
          }),
          /fresh attempt ID/,
        );
        const cancelledAttempt = crypto.randomUUID();
        await invoke("git_remote_cancel", { requestId: cancelledAttempt });
        await assert.rejects(
          invoke("git_remote_fetch_recover", {
            request: { fetch: request, depth: 1, attemptId: cancelledAttempt },
          }),
          /cancelled/,
        );
        assert.equal(await readFile(journalPath, "utf8"), journal);
        for (const changed of [
          { fetch: { ...request, branch: "other" }, depth: 1 },
          { fetch: request, depth: 2 },
        ]) {
          await assert.rejects(
            invoke("git_remote_fetch_recover", {
              request: { ...changed, attemptId: crypto.randomUUID() },
            }),
            /operation scope/,
          );
          assert.equal(await readFile(journalPath, "utf8"), journal);
          assert.equal(await Bun.file(join(gitDir, "shallow")).exists(), false);
        }
        await page.reload();
        await page.getByRole("button", { name: "Git", exact: true }).click();
        const panel = page.getByRole("region", {
          name: "Git remote",
          exact: true,
        });
        assert.equal(
          await panel
            .getByLabel("Fetch branch (optional)", { exact: true })
            .inputValue(),
          "main",
        );
        await panel
          .getByRole("button", { name: "Inspect pending fetch", exact: true })
          .click();
        await panel
          .getByRole("button", { name: "Resume pending fetch", exact: true })
          .waitFor();
        if (loseReply) {
          const counts = await withIpcFailure(
            page,
            "git_remote_fetch_recover",
            true,
            async () => {
              await panel
                .getByRole("button", {
                  name: "Resume pending fetch",
                  exact: true,
                })
                .click();
              await panel
                .getByRole("alert")
                .filter({ hasText: "Injected IPC failure" })
                .waitFor();
            },
          );
          assert.equal(counts.completed, 1);
          const saved = await invoke("load_workspace");
          assert.equal(
            saved.resources.find(
              /** @param {any} r */ (r) => r._id === f.repositoryId,
            ).nativeFetchIntent.operationId,
            operationId,
          );
          await page.reload();
          await page.getByRole("button", { name: "Git", exact: true }).click();
          await panel
            .getByRole("button", { name: "Inspect pending fetch", exact: true })
            .click();
        } else {
          await panel
            .getByRole("button", { name: "Resume pending fetch", exact: true })
            .click();
        }
        await panel
          .getByText("Previous fetch completed. Pending operation cleared.", {
            exact: true,
          })
          .waitFor();
        assert.equal(await Bun.file(journalPath).exists(), false);
        ownsJournal = false;
        assert.equal(
          await Bun.file(join(gitDir, "shallow.lock")).exists(),
          false,
        );
        assert.equal(
          await readFile(join(gitDir, "shallow"), "utf8"),
          tip + "\n",
        );
        assert.equal(await readFile(join(gitDir, "HEAD"), "utf8"), head);
        assert.equal(
          (
            await invoke("git_repository_info", {
              repositoryId: f.repositoryId,
            })
          ).headOid,
          f.oid,
        );
        const saved = await invoke("load_workspace");
        const savedBinding = saved.resources.find(
          /** @param {any} r */ (r) => r._id === f.repositoryId,
        );
        assert.equal(savedBinding.nativeFetchIntent, undefined);
        const expected = structuredClone(data.resources);
        delete expected.find(
          /** @param {any} r */ (r) => r._id === f.repositoryId,
        ).nativeFetchIntent;
        assert.deepEqual(saved.resources, expected);
        const observed = await invoke("git_remote_fetch_inspect", {
          request: { ...request, expectedBinding: savedBinding, depth: 1 },
        });
        assert.equal(observed.confirmedCurrent, true);
        assert.equal(observed.snapshot.oid, target);
        assert.deepEqual(observed.snapshot.manifest, manifest);
        assert.equal(
          (
            await invoke("git_remote_fetch_inspect", {
              request: { ...request, expectedBinding: savedBinding, depth: 2 },
            })
          ).confirmedCurrent,
          false,
        );
        assert.equal(networkRequests, 0);
        assert.equal(
          await readFile(join(stage, ".insomnium-fetch-owner"), "utf8"),
          owner,
        );
        await git(["--git-dir", gitDir, "fsck", "--full"]);
        await page
          .getByRole("button", { name: "Reload changes", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Commit selected changes", exact: true })
          .waitFor();
        assert.equal(
          await page
            .getByRole("button", { name: "Resume Git setup", exact: true })
            .count(),
          0,
        );

        await writeFile(
          join(output, "acceptance.json"),
          JSON.stringify(
            {
              status: "passed",
              operationId,
              snapshot: target,
              depth: 1,
              checks: [
                "Native recovery rejects changed branch/depth before writing",
                "Cancelled attempt cannot run; fresh attempt resumes the same durable operation",
                "UI restores v3 intent and explicitly resumes actual writer",
                "Candidate imported and exact shallow snapshot published",
                "Journal and owned shallow lock retired; stage retained",
                "HEAD and workspace resources preserved except acknowledged intent",
                "Depth-aware Inspect confirms exact receipt and rejects mismatched depth",
                "No remote network; final repository passes git fsck --full",
                loseReply
                  ? "Lost native success reply reconciled after reload without replay"
                  : "Successful receipt acknowledged and durable intent cleared",
              ],
              limits:
                "Prepared fixture journal and Git plumbing candidate, not interruption during live network/public Fetch or OS crash.",
            },
            null,
            2,
          ),
        );
      } finally {
        server.stop(true);
        if (ownsJournal) await rm(journalPath, { force: true });
        await rm(stage, { recursive: true, force: true });
      }
    },
  );
}
