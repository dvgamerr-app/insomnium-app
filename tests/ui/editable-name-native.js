import assert from "node:assert/strict";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { withIpcAudit } from "./helpers/ipc-audit.js";
import { renameCases, editName } from "./helpers/editable-name-cases.js";
import { newRequest } from "../../src/lib/model.js";
import { snapshotGitCollection } from "../../src/lib/git-collection.js";

await withNativeApp(
  "editable-name-native",
  async ({ page, invoke, output }) => {
    let received = 0;
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch() {
        received++;
        return new Response("Unexpected request", { status: 500 });
      },
    });
    try {
      const fixture = await gitCollection({ page, invoke });
      const cases = [];
      for (const protocol of ["http", "graphql", "sse", "websocket"]) {
        const resource = newRequest(fixture.workspaceId, {
          _type: protocol === "websocket" ? "websocket_request" : "request",
          url: `${protocol === "websocket" ? "ws" : "http"}://127.0.0.1:${server.port}/${protocol}`,
          ...(protocol === "sse" ? { responseMode: "sse" } : {}),
          ...(protocol === "graphql"
            ? {
                body: {
                  mimeType: "application/graphql",
                  text: JSON.stringify({
                    query: "query { __typename }",
                    variables: "{}",
                  }),
                  params: [],
                },
              }
            : {}),
        });
        const seed = await invoke("load_workspace");
        seed.resources.push(resource);
        await invoke("save_workspace", { data: seed });
        for (const row of renameCases) {
          const initial = row.initial ?? "Owned name",
            expectedName = row.expected ?? initial;
          const data = await invoke("load_workspace"),
            current = data.resources.find(
              (/** @type {any} */ r) => r._id === resource._id,
            );
          current.name = initial;
          current.modified = 1;
          data.activeRequestId = resource._id;
          data.openTabs = [resource._id];
          await invoke("save_workspace", { data });
          await page.reload();
          await page
            .getByRole("button", { name: "Edit request name", exact: true })
            .waitFor();
          await poll(
            async () =>
              (await page.locator(".status-save").innerText()).includes(
                "Local workspace",
              ),
            "Fixture ready",
          );
          const before = await invoke("load_workspace"),
            beforeGit = snapshotGitCollection(
              before.resources,
              fixture.workspaceId,
            );
          const audit = await withIpcAudit(page, "save_workspace", async () => {
            await editName(
              page,
              row,
              page.getByRole("textbox", { name: "Request URL", exact: true }),
            );
            await poll(
              async () =>
                (await page.locator(".status-save").innerText()).includes(
                  "Local workspace",
                ),
              "Rename save complete",
            );
            return invoke("load_workspace");
          });
          assert.equal(
            audit.calls,
            row.changed ? 1 : 0,
            protocol + " " + row.id + " save calls",
          );
          assert.equal(audit.completed, audit.calls);
          const after = audit.value,
            changed = after.resources.find(
              (/** @type {any} */ r) => r._id === resource._id,
            );
          const expected = structuredClone(before),
            target = expected.resources.find(
              (/** @type {any} */ r) => r._id === resource._id,
            );
          if (row.changed) {
            assert.ok(changed.modified > 1);
            target.name = expectedName;
            target.modified = changed.modified;
          }
          assert.deepEqual(
            after,
            expected,
            protocol + " " + row.id + " exact full workspace",
          );
          assert.equal(changed.name, expectedName);
          assert.equal(
            await page
              .getByRole("button", { name: "Edit request name", exact: true })
              .textContent(),
            expectedName || "Untitled Request",
          );
          const afterGit = snapshotGitCollection(
            after.resources,
            fixture.workspaceId,
          );
          if (row.changed) assert.notDeepEqual(afterGit.files, beforeGit.files);
          else
            assert.deepEqual(
              afterGit,
              beforeGit,
              "No-op leaves exact Git snapshot unchanged",
            );
          await page.reload();
          await page
            .getByRole("button", { name: "Edit request name", exact: true })
            .waitFor();
          assert.deepEqual(
            await invoke("load_workspace"),
            after,
            "Reload retains exact state/timestamps",
          );
          assert.equal(received, 0, "Renaming must not dispatch requests");
          cases.push({
            protocol,
            id: row.id,
            name: changed.name,
            saveCalls: audit.calls,
            modified: changed.modified,
          });
        }
      }
      assert.equal(cases.length, 60);
      assert.equal(
        (
          await invoke("git_repository_info", {
            repositoryId: fixture.repositoryId,
          })
        ).headOid,
        fixture.oid,
      );
      await Bun.write(
        output + "/acceptance.json",
        JSON.stringify(
          {
            passed: true,
            count: cases.length,
            network: received,
            gitHeadUnchanged: true,
            cases,
          },
          null,
          2,
        ),
      );
    } finally {
      server.stop(true);
    }
  },
);
