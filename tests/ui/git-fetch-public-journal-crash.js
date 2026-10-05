import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { BaseDirectory } from "@tauri-apps/api/path";
import { withNativeApp, probeIdentifier } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { gitPackFixture } from "./helpers/git-pack-fixture.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-journaled-fetch-ui-probe/build-state.json";
const fixture = gitPackFixture({ advance: true, shallow: true });
const packet = (/** @type {string} */ s) =>
  (Buffer.byteLength(s) + 4).toString(16).padStart(4, "0") + s;
let requests = 0;
/** @type {any} */ let context;
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    requests++;
    if (request.method === "POST") {
      const body = await request.text();
      const prefix = packet("shallow " + fixture.oid) + "0000";
      return new Response(
        body.includes("done")
          ? Buffer.concat([Buffer.from(prefix + "0008NAK\n"), fixture.pack])
          : Buffer.from(prefix),
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
  await withNativeApp(
    "git-fetch-public-journal-termination",
    async ({ page, invoke, output, terminateParent }) => {
      const f = await gitCollection({ page, invoke });
      const appData = resolve(
        await invoke("plugin:path|resolve_directory", {
          directory: BaseDirectory.AppData,
        }),
      );
      assert.equal(basename(appData), probeIdentifier);
      const gitDir = join(appData, "git-v1", "repo-" + f.repositoryId, ".git");
      const lock = join(gitDir, "shallow.lock"),
        journal = join(gitDir, "insomnium-fetch-journal-v1.json");
      const marker = "owned-ui-fixture-" + crypto.randomUUID() + "\n";
      const data = await invoke("load_workspace");
      const binding = data.resources.find(
        /** @param {any} r */ (r) => r._id === f.repositoryId,
      );
      binding.uri = "http://127.0.0.1:" + server.port + "/repo";
      binding.credentials = null;
      await invoke("save_workspace", { data });
      const head = await readFile(join(gitDir, "HEAD"), "utf8");
      // The fixture owns this foreign lock, not the application. Never overwrite a pre-existing lock.
      await writeFile(lock, marker, { flag: "wx" });
      context = { f, gitDir, lock, journal, marker, head };
      await page.reload();
      await page.getByRole("button", { name: "Git", exact: true }).click();
      const panel = page.getByRole("region", {
        name: "Git remote",
        exact: true,
      });
      await panel
        .getByLabel("Fetch branch (optional)", { exact: true })
        .fill("main");
      await panel
        .getByLabel("Fetch depth (optional)", { exact: true })
        .fill("1");
      await panel
        .getByRole("button", { name: "Fetch remote branches", exact: true })
        .click();
      await panel
        .getByRole("alert")
        .filter({ hasText: "Unowned Git shallow lock exists" })
        .waitFor();
      const saved = await invoke("load_workspace");
      const savedBinding = saved.resources.find(
        /** @param {any} r */ (r) => r._id === f.repositoryId,
      );
      assert.equal(savedBinding.nativeFetchIntent.depth, 1);
      const bytes = await readFile(journal, "utf8");
      assert.ok(bytes.includes(savedBinding.nativeFetchIntent.operationId));
      assert.equal(await readFile(lock, "utf8"), marker);
      assert.equal(await readFile(join(gitDir, "HEAD"), "utf8"), head);
      assert.ok(requests >= 2);
      Object.assign(context, { saved, savedBinding, bytes, count: requests });
      const termination = await terminateParent();
      context.termination = termination;
      await writeFile(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            status: "passed",
            termination,
            checks: [
              "Public native Fetch downloaded shallow pack and created its own durable journal",
              "Foreign shallow.lock refused without overwrite",
              "Saved depth intent and HEAD preserved",
              "Owned parent terminated after journaled publication failure",
            ],
            limits:
              "Termination after explicit lock failure, not mid-write or power loss.",
          },
          null,
          2,
        ),
      );
    },
    { allowParentTermination: true },
  );
  await withNativeApp(
    "git-fetch-public-journal-restart",
    async ({ page, invoke, output }) => {
      const {
        f,
        gitDir,
        lock,
        journal,
        marker,
        head,
        saved,
        savedBinding,
        bytes,
        count,
        termination,
      } = context;
      assert.deepEqual(await invoke("load_workspace"), saved);
      assert.equal(await readFile(journal, "utf8"), bytes);
      assert.equal(await readFile(lock, "utf8"), marker);
      await page.getByRole("button", { name: "Git", exact: true }).click();
      const panel = page.getByRole("region", {
        name: "Git remote",
        exact: true,
      });
      await panel
        .getByRole("button", { name: "Inspect pending fetch", exact: true })
        .click();
      const resume = panel.getByRole("button", {
        name: "Resume pending fetch",
        exact: true,
      });
      await resume.waitFor();
      await resume.click();
      await panel
        .getByRole("alert")
        .filter({ hasText: "Unowned Git shallow lock exists" })
        .waitFor();
      assert.equal(await readFile(journal, "utf8"), bytes);
      assert.equal(await readFile(lock, "utf8"), marker);
      assert.equal(requests, count);
      // Simulate the external lock owner completing: remove only our exact fixture marker.
      assert.equal(await readFile(lock, "utf8"), marker);
      await unlink(lock);
      await resume.click();
      await panel
        .getByText("Previous fetch completed. Pending operation cleared.", {
          exact: true,
        })
        .waitFor();
      assert.equal(await Bun.file(journal).exists(), false);
      assert.equal(await Bun.file(lock).exists(), false);
      assert.equal(await readFile(join(gitDir, "HEAD"), "utf8"), head);
      assert.equal(
        await readFile(join(gitDir, "shallow"), "utf8"),
        fixture.oid + "\n",
      );
      assert.equal(requests, count, "Recovery must not download again");
      const final = await invoke("load_workspace");
      const finalBinding = final.resources.find(
        /** @param {any} r */ (r) => r._id === f.repositoryId,
      );
      assert.equal(finalBinding.nativeFetchIntent, undefined);
      const expected = structuredClone(saved);
      delete expected.resources.find(
        /** @param {any} r */ (r) => r._id === f.repositoryId,
      ).nativeFetchIntent;
      assert.deepEqual(final.resources, expected.resources);
      const result = await invoke("git_remote_fetch_inspect", {
        request: {
          requestId: savedBinding.nativeFetchIntent.operationId,
          workspaceId: f.workspaceId,
          repositoryId: f.repositoryId,
          expectedBinding: finalBinding,
          branch: "main",
          depth: 1,
        },
      });
      assert.equal(result.confirmedCurrent, true);
      assert.equal(result.snapshot.manifest.requestedDepth, 1);
      assert.deepEqual(result.snapshot.manifest.histories, [
        { name: "main", depth: 1, boundaries: [fixture.oid] },
      ]);
      await writeFile(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            status: "passed",
            termination,
            operationId: savedBinding.nativeFetchIntent.operationId,
            checks: [
              "Restart loads real public Fetch journal and durable depth intent",
              "Resume retains foreign lock and journal on repeated refusal",
              "After external fixture lock owner releases, same-operation Resume succeeds",
              "No recovery network, unchanged HEAD/resources, exact depth receipt, journal retired",
            ],
            limits:
              "Controlled upload-pack fixture; process restart after lock refusal, not power loss or mid-ref interruption.",
          },
          null,
          2,
        ),
      );
    },
  );
} finally {
  server.stop(true);
  if (
    context &&
    (await Bun.file(context.lock).exists()) &&
    (await readFile(context.lock, "utf8")) === context.marker
  )
    await unlink(context.lock);
}
