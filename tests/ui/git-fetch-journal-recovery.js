import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { BaseDirectory } from "@tauri-apps/api/path";
import { withNativeApp, probeIdentifier } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-fetch-workspace-fence-ui-probe/build-state.json";

// Deliberately incomplete stage: status must be observational, while Resume
// must reject unavailable candidate objects and retain the recovery evidence.
await withNativeApp(
  "git-fetch-journal-recovery",
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
    binding.uri = "https://example.invalid/recovery-fixture";
    binding.credentials = null;
    binding.nativeFetchIntent = {
      version: 1,
      operationId,
      workspaceId: f.workspaceId,
      repositoryId: f.repositoryId,
      url: binding.uri,
    };
    await invoke("save_workspace", { data });
    const request = {
      requestId: operationId,
      workspaceId: f.workspaceId,
      repositoryId: f.repositoryId,
      expectedBinding: structuredClone(binding),
    };
    assert.equal(
      await invoke("git_remote_fetch_recovery_status", { request }),
      null,
    );
    const gitDir = join(appData, "git-v1", "repo-" + f.repositoryId, ".git");
    const stageName = "fetch-" + crypto.randomUUID();
    const stage = join(appData, "git-fetch-v1", stageName);
    await mkdir(join(stage, "repository", ".git", "objects"), {
      recursive: true,
    });
    const owner =
      "insomnium-fetch-stage-v2\n" +
      crypto.randomUUID() +
      "\n" +
      process.pid +
      "\n";
    await writeFile(join(stage, ".insomnium-fetch-owner"), owner);
    await writeFile(join(stage, ".insomnium-fetch-lease"), "");
    const endpointKey = Buffer.from(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(binding.uri),
      ),
    ).toString("hex");
    const journalPath = join(gitDir, "insomnium-fetch-journal-v1.json");
    assert.equal(await Bun.file(journalPath).exists(), false);
    const bytes = JSON.stringify({
      schemaVersion: 1,
      operationId,
      endpointKey,
      expectedSnapshot: null,
      targetSnapshot: f.oid,
      stageName,
      stageOwner: owner,
      oldShallow: null,
      preparedShallow: "",
      finalShallow: "",
    });
    const head = await readFile(join(gitDir, "HEAD"), "utf8");
    await writeFile(journalPath, bytes, { flag: "wx" });
    try {
      // Reproduce the inter-command gap: status was null before fixture journal
      // creation, but a later workspace save must recheck under native locks.
      const abandon = structuredClone(data);
      delete abandon.resources.find(
        /** @param {any} r */ (r) => r._id === f.repositoryId,
      ).nativeFetchIntent;
      await assert.rejects(
        invoke("save_workspace", { data: abandon }),
        /protects its saved binding/,
      );
      assert.deepEqual(
        (await invoke("load_workspace")).resources,
        data.resources,
      );
      const unrelated = structuredClone(data);
      unrelated.resources.find(
        /** @param {any} r */ (r) => r._id === f.requestId,
      ).url = "https://allowed-edit.invalid";
      await invoke("save_workspace", { data: unrelated });
      assert.deepEqual(
        (await invoke("load_workspace")).resources,
        unrelated.resources,
      );
      await invoke("save_workspace", { data });
      const observed = await invoke("git_remote_fetch_recovery_status", {
        request,
      });
      assert.deepEqual(observed, {
        operationId,
        targetSnapshot: f.oid,
        state: "before snapshot publication",
      });
      await assert.rejects(
        invoke("git_remote_fetch_recovery_status", {
          request: { ...request, requestId: crypto.randomUUID() },
        }),
        /different endpoint or operation/,
      );
      await assert.rejects(
        invoke("git_remote_fetch_recovery_status", {
          request: {
            ...request,
            expectedBinding: { ...binding, uri: binding.uri + "-changed" },
          },
        }),
        /binding or saved settings changed/,
      );
      await assert.rejects(
        invoke("git_repository_info", { repositoryId: f.repositoryId }),
        /recovery required/,
      );
      await page.reload();
      await page.getByRole("button", { name: "Git", exact: true }).click();
      const panel = page.getByRole("region", {
        name: "Git remote",
        exact: true,
      });
      await panel.waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Resume Git setup", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Commit selected changes", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Switch branch", exact: true })
          .count(),
        0,
      );
      // Even before Inspect makes the Resume button available, retirement must
      // query native metadata and preserve this operation.
      await panel
        .getByRole("button", {
          name: "Stop tracking pending fetch",
          exact: true,
        })
        .click();
      await panel
        .getByRole("alert")
        .filter({ hasText: "Fetch publication needs recovery" })
        .waitFor();
      await panel
        .getByRole("button", { name: "Inspect pending fetch", exact: true })
        .click();
      await panel
        .getByText(
          "Fetch publication was interrupted. Resume the saved fetch to complete it without downloading again.",
          { exact: true },
        )
        .waitFor();
      assert.equal(
        await panel
          .getByRole("button", {
            name: "Stop tracking pending fetch",
            exact: true,
          })
          .isDisabled(),
        true,
      );
      await panel
        .getByRole("button", { name: "Resume pending fetch", exact: true })
        .click();
      await panel.getByRole("alert").waitFor();
      assert.equal(await readFile(journalPath, "utf8"), bytes);
      assert.equal(
        await readFile(join(stage, ".insomnium-fetch-owner"), "utf8"),
        owner,
      );
      assert.equal(await readFile(join(gitDir, "HEAD"), "utf8"), head);
      assert.equal(
        await Bun.file(join(gitDir, "shallow.lock")).exists(),
        false,
      );
      assert.deepEqual(
        (await invoke("load_workspace")).resources,
        data.resources,
      );
      assert.equal(
        await panel
          .getByRole("button", { name: "Fetch remote branches", exact: true })
          .isDisabled(),
        true,
      );
      await writeFile(journalPath, "{");
      await assert.rejects(
        invoke("save_workspace", { data: abandon }),
        /protects its saved binding/,
      );
      await panel
        .getByRole("button", { name: "Inspect pending fetch", exact: true })
        .click();
      await panel
        .getByRole("alert")
        .filter({ hasText: "Invalid fetch publication journal" })
        .waitFor();
      assert.equal(await readFile(journalPath, "utf8"), "{");
      assert.deepEqual(
        (await invoke("load_workspace")).resources,
        data.resources,
      );
      await writeFile(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            status: "passed",
            checks: [
              "No-journal status is null",
              "Journal created after status still prevents native save from removing intent",
              "Unrelated request saves allowed; partial journal still protects binding",
              "Native status observes same endpoint/operation without candidate objects",
              "Wrong operation and changed saved binding rejected",
              "Normal repository admission still blocked",
              "Retirement before Inspect preserves pending journal intent",
              "UI Inspect offers explicit Resume and disables retirement",
              "Resume rejects missing candidate while retaining journal/stage/HEAD/intent",
              "Malformed journal remains unchanged and visible as error",
            ],
            limits:
              "Synthetic incomplete candidate exercises admission/error retention only; successful writer restart is covered separately by native probes, not this UI scenario.",
          },
          null,
          2,
        ),
      );
    } finally {
      await rm(journalPath, { force: true });
      await rm(stage, { recursive: true, force: true });
    }
  },
);
