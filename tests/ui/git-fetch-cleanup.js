import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { BaseDirectory } from "@tauri-apps/api/path";
import { withNativeApp, poll, probeIdentifier } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { gitPackFixture } from "./helpers/git-pack-fixture.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-fetch-journal-ui-probe/build-state.json";
const fixture = gitPackFixture();
/** @type {(()=>void)|undefined} */
let release;
let requests = 0;
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  idleTimeout: 0,
  async fetch(request) {
    requests++;
    if (request.method === "GET" && !release)
      await new Promise((resolve) => {
        release = () => resolve(undefined);
      });
    if (request.method === "POST") {
      await request.arrayBuffer();
      return new Response(
        Buffer.concat([Buffer.from("0008NAK\n"), fixture.pack]),
        { headers: { "Content-Type": "application/x-git-upload-pack-result" } },
      );
    }
    return new Response(fixture.advertisement, {
      headers: {
        "Content-Type": "application/x-git-upload-pack-advertisement",
      },
    });
  },
});
try {
  await withNativeApp("git-fetch-cleanup", async ({ page, output, invoke }) => {
    const f = await gitCollection({ page, invoke });
    const appData = resolve(
      await invoke("plugin:path|resolve_directory", {
        directory: BaseDirectory.AppData,
      }),
    );
    assert.equal(
      basename(appData),
      probeIdentifier,
      "Filesystem fixtures must belong to isolated probe",
    );
    const root = join(appData, "git-fetch-v1");
    await mkdir(root, { recursive: true });
    const baseline = await invoke("git_remote_cleanup_staging");
    assert.equal(baseline.active, 0, "No other native fetch may be running");
    assert.equal(baseline.limited, false);
    /** @type {string[]} */
    const owned = [];
    /** @param {string} header @param {boolean} [unknown] */
    async function seed(header, unknown = false) {
      const directory = join(
        root,
        (unknown ? "unknown-" : "fetch-") + crypto.randomUUID(),
      );
      await mkdir(directory);
      owned.push(directory);
      await writeFile(join(directory, ".insomnium-fetch-lease"), "");
      await writeFile(
        join(directory, ".insomnium-fetch-owner"),
        header + "\n" + crypto.randomUUID() + "\n" + process.pid + "\n",
      );
      await mkdir(join(directory, "repository"));
      await writeFile(
        join(directory, "repository", "fixture.txt"),
        "owned cleanup fixture",
      );
      return directory;
    }
    /** @type {Promise<any>|undefined} */
    let pending;
    const journalPath = join(
      appData,
      "git-v1",
      "repo-" + f.repositoryId,
      ".git",
      "insomnium-fetch-journal-v1.json",
    );
    let ownsJournal = false;
    try {
      const idle = await seed("insomnium-fetch-stage-v2");
      const legacy = await seed("insomnium-fetch-stage-v1");
      const malformed = await seed("invalid-owner");
      const unknown = await seed("insomnium-fetch-stage-v2", true);
      const retained = baseline.retained + 3;
      const data = await invoke("load_workspace");
      const binding = data.resources.find(
        /** @param {any} r */ (r) => r._id === f.repositoryId,
      );
      binding.uri = "http://127.0.0.1:" + server.port + "/repo";
      binding.credentials = null;
      await invoke("save_workspace", { data });
      await page.reload();
      await page.getByRole("button", { name: "Git", exact: true }).click();
      const panel = page.getByRole("region", {
        name: "Git remote",
        exact: true,
      });
      const clean = panel.getByRole("button", {
        name: "Clean unused fetch files",
        exact: true,
      });
      await clean.click();
      await panel
        .getByText(
          "Fetch file cleanup: 1 removed, 0 active, " + retained + " retained.",
          { exact: true },
        )
        .waitFor();
      assert.equal(
        await Bun.file(join(idle, "repository", "fixture.txt")).exists(),
        false,
      );
      for (const path of [legacy, malformed, unknown])
        assert.equal(
          await readFile(join(path, "repository", "fixture.txt"), "utf8"),
          "owned cleanup fixture",
        );
      assert.deepEqual(
        await invoke("load_workspace"),
        data,
        "Cleanup preserves saved resources",
      );

      const before = new Set(await readdir(root));
      const operationId = crypto.randomUUID();
      binding.nativeFetchIntent = {
        version: 3,
        operationId,
        workspaceId: f.workspaceId,
        repositoryId: f.repositoryId,
        url: binding.uri,
        branch: null,
        depth: null,
      };
      await invoke("save_workspace", { data });
      const request = {
        requestId: operationId,
        workspaceId: f.workspaceId,
        repositoryId: f.repositoryId,
        expectedBinding: structuredClone(binding),
      };
      pending = invoke("git_remote_fetch", { request }).then(
        (value) => ({ value }),
        (error) => ({ error: String(error) }),
      );
      await poll(
        async () => !!release,
        "Real Fetch worker reaches controlled server",
      );
      const activeNames = (await readdir(root)).filter(
        (name) => !before.has(name),
      );
      assert.equal(
        activeNames.length,
        1,
        "One actual native staging container",
      );
      const activePath = join(root, activeNames[0]);
      const owner = await readFile(
        join(activePath, ".insomnium-fetch-owner"),
        "utf8",
      );
      assert.ok(owner.startsWith("insomnium-fetch-stage-v2\n"));
      await clean.click();
      await panel
        .getByText(
          "Fetch file cleanup: 0 removed, 1 active, " + retained + " retained.",
          { exact: true },
        )
        .waitFor();
      assert.equal(
        await readFile(join(activePath, ".insomnium-fetch-owner"), "utf8"),
        owner,
      );
      assert.deepEqual(await invoke("load_workspace"), data);
      assert.ok(release);
      release();
      const outcome = await pending;
      assert.ok("value" in outcome, JSON.stringify(outcome));
      assert.equal(
        outcome.value.snapshot.manifest.operationId,
        request.requestId,
      );
      assert.equal(
        await Bun.file(join(activePath, ".insomnium-fetch-owner")).exists(),
        false,
      );
      const count = requests;
      await clean.click();
      await panel
        .getByText(
          "Fetch file cleanup: 0 removed, 0 active, " + retained + " retained.",
          { exact: true },
        )
        .waitFor();
      const inspected = await invoke("git_remote_fetch_inspect", { request });
      assert.equal(inspected.confirmedCurrent, true);
      assert.deepEqual(inspected.snapshot, outcome.value.snapshot);
      assert.equal(
        requests,
        count,
        "Cleanup and inspection do not contact remote",
      );
      assert.equal(
        (await invoke("git_repository_info", { repositoryId: f.repositoryId }))
          .headOid,
        f.oid,
      );
      assert.deepEqual(await invoke("load_workspace"), data);

      const protectedStage = await seed("insomnium-fetch-stage-v2");
      const extraIdle = await seed("insomnium-fetch-stage-v2");
      assert.equal(await Bun.file(journalPath).exists(), false);
      const journalBytes = JSON.stringify({
        schemaVersion: 1,
        operationId: crypto.randomUUID(),
        endpointKey: outcome.value.snapshot.manifest.endpointKey,
        expectedSnapshot: outcome.value.snapshot.oid,
        targetSnapshot: f.oid,
        stageName: basename(protectedStage),
        stageOwner: await readFile(
          join(protectedStage, ".insomnium-fetch-owner"),
          "utf8",
        ),
        oldShallow: null,
        preparedShallow: "",
        finalShallow: "",
      });
      await writeFile(journalPath, journalBytes);
      ownsJournal = true;
      await clean.click();
      await panel
        .getByText(
          "Fetch file cleanup: 1 removed, 0 active, " +
            (retained + 1) +
            " retained.",
          { exact: true },
        )
        .waitFor();
      assert.equal(
        await Bun.file(join(extraIdle, "repository", "fixture.txt")).exists(),
        false,
      );
      assert.equal(
        await readFile(
          join(protectedStage, "repository", "fixture.txt"),
          "utf8",
        ),
        "owned cleanup fixture",
      );
      await assert.rejects(
        invoke("git_repository_info", { repositoryId: f.repositoryId }),
        /Git fetch recovery required/,
      );
      await assert.rejects(
        invoke("git_remote_fetch_inspect", { request }),
        /Git fetch recovery required/,
      );
      assert.equal(await readFile(journalPath, "utf8"), journalBytes);
      assert.equal(requests, count);
      assert.deepEqual(await invoke("load_workspace"), data);

      const retainedAfterError = await seed("insomnium-fetch-stage-v2");
      await writeFile(journalPath, "{");
      await clean.click();
      await panel.getByText(/Invalid fetch publication journal/).waitFor();
      assert.equal(
        await readFile(
          join(retainedAfterError, "repository", "fixture.txt"),
          "utf8",
        ),
        "owned cleanup fixture",
      );
      assert.equal(
        await readFile(
          join(protectedStage, "repository", "fixture.txt"),
          "utf8",
        ),
        "owned cleanup fixture",
      );
      assert.equal(await readFile(journalPath, "utf8"), "{");
      await writeFile(journalPath, journalBytes);
      await clean.click();
      await panel
        .getByText(
          "Fetch file cleanup: 1 removed, 0 active, " +
            (retained + 1) +
            " retained.",
          { exact: true },
        )
        .waitFor();
      // Remove only this synthetic fixture journal; this is not recovery acceptance.
      await rm(journalPath);
      ownsJournal = false;
      await clean.click();
      await panel
        .getByText(
          "Fetch file cleanup: 1 removed, 0 active, " + retained + " retained.",
          { exact: true },
        )
        .waitFor();
      assert.equal(
        await Bun.file(
          join(protectedStage, "repository", "fixture.txt"),
        ).exists(),
        false,
      );
      assert.equal(
        (await invoke("git_repository_info", { repositoryId: f.repositoryId }))
          .headOid,
        f.oid,
      );
      assert.deepEqual(await invoke("load_workspace"), data);

      await writeFile(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            status: "passed",
            checks: [
              "UI cleanup removes idle valid v2 stage",
              "Legacy, malformed and unknown stages retain exact payload",
              "Real in-flight native Fetch stage reports active and retains ownership",
              "Fetch completes and publishes snapshot after concurrent cleanup",
              "Repeated cleanup preserves committed snapshot and performs no network",
              "Local HEAD and saved workspace resources unchanged",
              "Journal-owned idle stage retained while unrelated idle stage is removed",
              "Native repository and inspection refuse pending journal without mutation or network",
              "Malformed journal aborts cleanup before deleting any stage",
              "After removing only the synthetic fixture journal, its stage becomes eligible",
            ],
            limits:
              "Controlled live worker and synthetic journal retention; not production journal creation/recovery, parent-crash, orphan-worker, OS disk fault or OS-close acceptance",
          },
          null,
          2,
        ),
      );
    } finally {
      release?.();
      await pending;
      if (ownsJournal) await rm(journalPath);
      for (const path of owned)
        await rm(path, { recursive: true, force: true });
    }
  });
} finally {
  release?.();
  server.stop(true);
}
