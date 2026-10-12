import assert from "node:assert/strict";
import {
  withNativeApp,
  poll,
  resourceCrudProbeIdentifier,
} from "./helpers/native-app.js";
import {
  withResourceProbePreserved,
  resourceSaved,
  manageResource,
  assertResourceCopy,
  registerResourceProbeCollection,
} from "./helpers/resource-manager-cases.js";
import { editName } from "./helpers/editable-name-cases.js";
import { descendants } from "../../src/lib/model.js";
import { orderedChildren } from "../../src/lib/resources.js";

assert.ok(
  process.env.INSOMNIUM_UI_BUILD_STATE,
  "Explicit proven-current native candidate required",
);
assert.ok(
  process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP,
  "Fixed isolated CRUD ownership proof required",
);
await withResourceProbePreserved(
  async (capture) => {
    let received = 0;
    let aborted = 0;
    let release = /** @type {(()=>void)|undefined} */ (undefined);
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        received++;
        request.signal.addEventListener("abort", () => aborted++, {
          once: true,
        });
        await new Promise((resolve) => {
          release = () => resolve(undefined);
        });
        return new Response("owned held response");
      },
    });
    try {
      await withNativeApp(
        "resource-manager-native",
        async ({ page, invoke, output }) => {
          await resourceSaved(page);
          assert.equal(
            await page
              .getByLabel("Collection", { exact: true })
              .locator("option")
              .count(),
            1,
            "Cold owned native profile starts with exactly one collection",
          );
          await page
            .getByRole("button", { name: "Manage collection", exact: true })
            .click();
          const lastDialog = page.getByRole("dialog");
          const lastDelete = lastDialog.getByRole("button", {
            name: "Delete…",
            exact: true,
          });
          assert.equal(await lastDelete.isDisabled(), true);
          assert.equal(
            await lastDelete.getAttribute("title"),
            "Keep at least one collection",
          );
          await lastDialog
            .getByRole("button", { name: "New folder", exact: true })
            .focus();
          await page.keyboard.press("Tab");
          assert.equal(
            await lastDialog
              .getByRole("button", { name: "Cancel", exact: true })
              .evaluate((el) => el === document.activeElement),
            true,
            "Actual native keyboard skips last collection delete",
          );
          await lastDialog
            .getByRole("button", { name: "Save changes", exact: true })
            .click();
          await lastDialog.waitFor({ state: "detached" });
          await resourceSaved(page);
          await capture();
          const original =
            /** @type {ReturnType<import('../../src/lib/model.js').initialData>} */ (
              await invoke("load_workspace")
            );
          const tag = "CRUD " + Date.now();
          const workspaceId = "wrk_crud_" + crypto.randomUUID(),
            destinationId = "wrk_crud_" + crypto.randomUUID();
          const seed = structuredClone(original);
          for (const [id, name] of [
            [workspaceId, tag + " source"],
            [destinationId, tag + " destination"],
          ]) {
            seed.resources.push({
              _id: id,
              _type: "workspace",
              parentId: null,
              name,
              scope: "collection",
              metaSortKey: 999999,
            });
            seed.resources.push({
              _id: "env_" + crypto.randomUUID(),
              _type: "environment",
              parentId: id,
              name: "Base Environment",
              data: {},
            });
          }
          seed.activeWorkspaceId = workspaceId;
          seed.activeRequestId = "";
          seed.activeEnvironmentId = "";
          seed.openTabs = [];
          await invoke("save_workspace", { data: seed });
          const actualSeed = await invoke("load_workspace");
          for (const id of [workspaceId, destinationId]) {
            const actual = actualSeed.resources.find(
              (/** @type {Record<string,any>} */ item) => item._id === id,
            );
            assert.ok(actual && actual._type === "workspace");
            registerResourceProbeCollection(id, actual.name);
          }
          await page.reload();
          const rows = [
            "actual cold native last-collection disabled/title/keyboard guard",
          ];
          /** @returns {Promise<ReturnType<import('../../src/lib/model.js').initialData>>} */
          const load = () => invoke("load_workspace");
          const resource = async (/** @type {string} */ name) => {
            const found = (await load()).resources.find(
              (item) => item.name === name,
            );
            assert.ok(found, "Owned resource exists: " + name);
            return found;
          };
          const reload = async () => {
            await page.reload();
            await page.getByLabel("Collection", { exact: true }).waitFor();
            await resourceSaved(page);
          };
          const close = async (
            /** @type {import('playwright-core').Locator} */ dialog,
          ) => {
            await dialog
              .getByRole("button", { name: "Cancel", exact: true })
              .click();
            await dialog.waitFor({ state: "detached" });
          };
          const save = async (
            /** @type {import('playwright-core').Locator} */ dialog,
          ) => {
            await dialog
              .getByRole("button", { name: "Save changes", exact: true })
              .click();
            await dialog.waitFor({ state: "detached" });
            await resourceSaved(page);
          };
          await page
            .getByRole("button", { name: "New folder", exact: true })
            .click();
          let dialog = page.getByRole("dialog");
          await dialog.getByLabel("Name", { exact: true }).fill(tag + " outer");
          await dialog
            .getByRole("button", { name: "Create", exact: true })
            .click();
          await dialog.waitFor({ state: "detached" });
          await resourceSaved(page);
          const outer = await resource(tag + " outer");
          assert.equal(outer.parentId, workspaceId);
          dialog = await manageResource(page, outer.name);
          await dialog
            .getByRole("button", { name: "New folder", exact: true })
            .click();
          dialog = page.getByRole("dialog");
          await dialog.getByLabel("Name", { exact: true }).fill(tag + " inner");
          await dialog
            .getByRole("button", { name: "Create", exact: true })
            .click();
          await dialog.waitFor({ state: "detached" });
          await resourceSaved(page);
          const inner = await resource(tag + " inner");
          assert.equal(inner.parentId, outer._id);
          dialog = await manageResource(page, inner.name);
          await dialog
            .getByRole("button", { name: "New request", exact: true })
            .click();
          await dialog.waitFor({ state: "detached" });
          await resourceSaved(page);
          await editName(
            page,
            { id: "owned-create", draft: tag + " request", finish: "Enter" },
            page.getByRole("textbox", { name: "Request URL", exact: true }),
          );
          await resourceSaved(page);
          const request = await resource(tag + " request");
          assert.equal(request.parentId, inner._id);
          rows.push("actual nested folder/request creation and rename");
          const enriched = await load();
          const own = enriched.resources.filter((item) =>
            [outer._id, inner._id, request._id].includes(item._id),
          );
          own.forEach((item, index) => {
            item.crudMarker = tag + ":" + index;
            item.created = item.modified = 1;
          });
          const sourceRequest = own.find((item) => item._id === request._id);
          assert.ok(sourceRequest);
          sourceRequest.url = `http://127.0.0.1:${server.port}/held`;
          sourceRequest.body = {
            mimeType: "text/plain",
            text: "payload keeps " + inner._id,
            params: [],
          };
          sourceRequest.headers = [{ name: "X-Owned", value: outer._id }];
          sourceRequest.sourceSpecId = "spc_foreign_not_copied";
          const payloadId = "ws-payload_" + crypto.randomUUID();
          sourceRequest.activePayloadId = payloadId;
          enriched.resources.push({
            _id: payloadId,
            _type: "websocket_payload",
            parentId: request._id,
            requestId: request._id,
            name: "Owned retained payload",
            value: outer._id,
            mode: "text/plain",
            crudMarker: tag + ":payload",
            created: 1,
            modified: 1,
          });
          for (const type of [
            "oauth2_token",
            "unit_test_result",
            "workspace_meta",
          ])
            enriched.resources.push({
              _id: type + "_" + crypto.randomUUID(),
              _type: type,
              parentId: inner._id,
              name: tag + " private " + type,
            });
          enriched.history.push({
            _id: "res_" + crypto.randomUUID(),
            requestId: request._id,
            status: 200,
            body: "owned history stays original",
          });
          await invoke("save_workspace", { data: enriched });
          await reload();
          const beforeCopy = await load(),
            sourceIds = descendants(beforeCopy.resources, outer._id);
          const copiedSources = beforeCopy.resources.filter(
            (item) =>
              sourceIds.has(item._id) &&
              !["oauth2_token", "unit_test_result", "workspace_meta"].includes(
                item._type,
              ),
          );
          dialog = await manageResource(page, outer.name);
          await dialog
            .getByLabel("Folder variables (JSON)", { exact: true })
            .fill("[]");
          await dialog
            .getByRole("button", { name: "Save changes", exact: true })
            .click();
          await dialog
            .getByRole("alert")
            .filter({ hasText: "Folder variables must be a JSON object" })
            .waitFor();
          assert.deepEqual(
            (await load()).resources,
            beforeCopy.resources,
            "Invalid folder variables do not mutate resources",
          );
          await dialog
            .getByLabel("Folder variables (JSON)", { exact: true })
            .fill("{}");
          const locations = await dialog
            .getByLabel("Location", { exact: true })
            .locator("option")
            .evaluateAll((options) =>
              options.map(
                (option) => /** @type {HTMLOptionElement} */ (option).value,
              ),
            );
          assert.ok(
            !locations.includes(outer._id) && !locations.includes(inner._id),
            "Self/child cycles excluded before selection",
          );
          assert.ok(
            locations.includes(destinationId),
            "Valid foreign collection remains selectable",
          );
          await dialog
            .getByRole("button", { name: "Duplicate", exact: true })
            .click();
          await dialog.waitFor({ state: "detached" });
          await resourceSaved(page);
          const afterCopy = await load(),
            copyRoot = afterCopy.resources.find(
              (item) => item.name === outer.name + " (copy)",
            );
          assert.ok(copyRoot);
          const copyIds = descendants(afterCopy.resources, copyRoot._id);
          const copies = afterCopy.resources.filter((item) =>
            copyIds.has(item._id),
          );
          assertResourceCopy(copiedSources, copies, outer._id, copyRoot._id);
          assert.deepEqual(
            afterCopy.history,
            beforeCopy.history,
            "No response/history duplicated",
          );
          assert.deepEqual(
            afterCopy.resources.filter((item) => sourceIds.has(item._id)),
            beforeCopy.resources.filter((item) => sourceIds.has(item._id)),
            "Original subtree/private state untouched",
          );
          assert.equal(
            copies.some((item) =>
              ["oauth2_token", "unit_test_result", "workspace_meta"].includes(
                item._type,
              ),
            ),
            false,
          );
          await reload();
          assert.deepEqual(
            (await load()).resources.filter((item) => copyIds.has(item._id)),
            copies,
          );
          rows.push(
            "subtree duplicate exact IDs/parents/reference remapping and literal payloads/private/history/reload",
          );
          dialog = await manageResource(page, copyRoot.name);
          assert.equal(
            await dialog
              .getByRole("button", { name: "Move down", exact: true })
              .isDisabled(),
            true,
          );
          await dialog
            .getByRole("button", { name: "Move up", exact: true })
            .click();
          await resourceSaved(page);
          assert.deepEqual(
            orderedChildren((await load()).resources, workspaceId).map(
              (item) => item._id,
            ),
            [copyRoot._id, outer._id],
          );
          await close(dialog);
          await reload();
          const preservedCopies = (await load()).resources.filter((item) =>
            copyIds.has(item._id),
          );
          await page
            .getByRole("textbox", { name: "Filter requests", exact: true })
            .fill(tag + " request");
          assert.equal(
            await page.locator(".tree-request").count(),
            2,
            "Search finds source and duplicate under nested folders",
          );
          await page
            .getByRole("textbox", { name: "Filter requests", exact: true })
            .fill("missing-owned-needle");
          assert.equal(await page.locator(".tree-request").count(), 0);
          await page
            .getByRole("textbox", { name: "Filter requests", exact: true })
            .fill("");
          rows.push(
            "persisted sibling reorder/bounds and nested request search/reset",
          );
          await page
            .locator(".tree-request")
            .filter({ hasText: tag + " request" })
            .last()
            .click();
          await resourceSaved(page);
          assert.equal(
            (await load()).activeRequestId,
            request._id,
            "Held Send belongs to original subtree",
          );
          await page.getByRole("button", { name: "Send", exact: true }).click();
          await poll(
            async () => received === 1,
            "Owned held native Send entered",
          );
          dialog = await manageResource(page, outer.name);
          await dialog
            .getByLabel("Location", { exact: true })
            .selectOption(destinationId);
          await dialog
            .getByRole("button", { name: "Save changes", exact: true })
            .click();
          await dialog
            .getByRole("alert")
            .filter({ hasText: "Cancel running requests before moving" })
            .waitFor();
          assert.equal((await resource(outer.name)).parentId, workspaceId);
          await close(dialog);
          await page
            .getByRole("button", { name: "Cancel", exact: true })
            .click();
          await poll(
            async () => aborted === 1,
            "Held transport aborted before fixture release",
          );
          release?.();
          await resourceSaved(page);
          dialog = await manageResource(page, outer.name);
          await dialog
            .getByLabel("Location", { exact: true })
            .selectOption(destinationId);
          await save(dialog);
          assert.equal((await resource(outer.name)).parentId, destinationId);
          assert.equal((await resource(inner.name)).parentId, outer._id);
          await page
            .getByLabel("Collection", { exact: true })
            .selectOption(destinationId);
          await resourceSaved(page);
          await reload();
          assert.equal(
            await page
              .getByRole("button", {
                name: "Manage " + outer.name,
                exact: true,
              })
              .count(),
            1,
          );
          rows.push(
            "running cross-collection move refusal, actual native Cancel, valid foreign move/switch/reload",
          );
          const beforeDelete = await load();
          dialog = await manageResource(page, outer.name);
          await dialog
            .getByRole("button", { name: "Delete…", exact: true })
            .click();
          assert.match(await dialog.innerText(), /Saved responses.*removed/);
          await dialog
            .getByRole("button", { name: "Back", exact: true })
            .click();
          await close(dialog);
          assert.deepEqual(
            (await load()).resources,
            beforeDelete.resources,
            "Cancelled delete has no resource mutation",
          );
          dialog = await manageResource(page, outer.name);
          await dialog
            .getByRole("button", { name: "Delete…", exact: true })
            .click();
          await dialog
            .getByRole("button", { name: "Delete", exact: true })
            .click();
          await dialog.waitFor({ state: "detached" });
          await resourceSaved(page);
          const afterDelete = await load();
          assert.deepEqual(
            afterDelete.resources,
            beforeDelete.resources.filter((item) => !sourceIds.has(item._id)),
          );
          assert.deepEqual(
            afterDelete.history,
            beforeDelete.history.filter(
              (item) => !sourceIds.has(item.requestId),
            ),
          );
          assert.deepEqual(
            afterDelete.openTabs,
            beforeDelete.openTabs.filter((id) => !sourceIds.has(id)),
          );
          assert.deepEqual(
            afterDelete.resources.filter((item) => copyIds.has(item._id)),
            preservedCopies,
          );
          await reload();
          assert.deepEqual((await load()).resources, afterDelete.resources);
          rows.push(
            "cancelled delete then subtree/private/history/tab deletion, duplicate retained, reload",
          );
          assert.deepEqual(
            (await load()).resources.filter((item) =>
              original.resources.some((prior) => prior._id === item._id),
            ),
            original.resources,
            "All original probe resources untouched",
          );
          assert.equal(received, 1, "No unexpected network dispatch");
          await Bun.write(
            output + "/acceptance.json",
            JSON.stringify(
              {
                passed: true,
                rows,
                received,
                aborted,
                lastCollectionNative:
                  "passed actual cold owned profile before fixture insertion",
                fixtureOnly: true,
              },
              null,
              2,
            ),
          );
        },
        {
          expectedIdentifier: resourceCrudProbeIdentifier,
          profileOwnershipPath: process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP,
        },
      );
    } finally {
      release?.();
      server.stop(true);
    }
  },
  {
    expectedIdentifier: resourceCrudProbeIdentifier,
    profileOwnershipPath: process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP,
    lazyCapture: true,
  },
);
