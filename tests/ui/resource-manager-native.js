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
const nonduplicable = ["git_repository", "grpc_request_meta", "oauth2_token", "plugin_data",
  "project", "request_group_meta", "request_meta", "request_version", "response", "settings",
  "stats", "unit_test_result", "websocket_response", "workspace_meta"];

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
        async ({ page, invoke, output, pid }) => {
          const ownership = await Bun.file(
            /** @type {string} */ (process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP),
          ).json();
          assert.equal(ownership.identifier, resourceCrudProbeIdentifier);
          assert.equal(ownership.state, "owned");
          const launch = ownership.launches.at(-1);
          assert.equal(launch?.pid, pid, "Capture belongs to the exact bound native host");
          assert.equal(typeof launch.directoryAbsentAtBind, "boolean");
          assert.equal(launch.profileBinding, launch.directoryAbsentAtBind
            ? "native-path-first-absence" : "native-path-directory");
          if (launch.directoryAbsentAtBind) {
            assert.equal(ownership.initiallyAbsent, true);
            assert.equal(ownership.launches.length, 1);
          } else {
            await capture();
          }
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
          await Bun.write(output + "/cold-last-collection.json", JSON.stringify({passed:true,collections:1,deleteDisabled:true,title:"Keep at least one collection",keyboard:"Tab skips disabled Delete",beforeFixtures:true},null,2));
          if (launch.directoryAbsentAtBind) await capture();
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
          const locationControl = async () => {
            const control=page.getByRole("dialog").getByLabel("Location",{exact:false});
            await control.waitFor();
            assert.equal(await control.count(),1);
            assert.equal(await control.evaluate(el=>{const label=/** @type {HTMLSelectElement} */(el).labels?.[0];return label?Array.from(label.childNodes).filter(node=>node.nodeType===Node.TEXT_NODE).map(node=>node.textContent).join("").trim():"";}),"Location","Location label's own text exact; nested option text is not field name");
            return control;
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
          const validationRows = [];
          const correctionRows = [];
          const validationBaseline = await load();
          const originalFolder = validationBaseline.resources.find(
            (item) => item._id === outer._id,
          );
          assert.ok(originalFolder);
          const originalTheme = await page
            .locator("html")
            .getAttribute("data-theme");
          const originalViewport = page.viewportSize();
          const validationFailures = /** @type {unknown[]} */ ([]);
          try {
            for (const theme of ["dark", "light"])
              for (const width of [1440, 900, 760]) {
                await page.setViewportSize({ width, height: 600 });
                await page
                  .locator("html")
                  .evaluate(
                    (el, theme) => el.setAttribute("data-theme", theme),
                    theme,
                  );
                const before = await load();
                const folder = before.resources.find(
                  (item) => item._id === outer._id,
                );
                assert.ok(folder);
                dialog = await manageResource(page, outer.name);
                const name = dialog.getByRole("textbox", {
                  name: "Name",
                  exact: true,
                });
                const variables = dialog.getByRole("textbox", {
                  name: "Folder variables (JSON)",
                  exact: true,
                });
                const submit = dialog.getByRole("button", {
                  name: "Save changes",
                  exact: true,
                });
                const nameId = await name.getAttribute("id");
                const variablesId = await variables.getAttribute("id");
                assert.ok(nameId && variablesId && nameId !== variablesId);
                for (const [label, control] of [
                  ["Name", name],
                  ["Folder variables (JSON)", variables],
                ]) {
                  await dialog
                    .getByText(/** @type {string} */ (label), { exact: true })
                    .click({ position: { x: 2, y: 2 } });
                  assert.equal(
                    await /** @type {import('playwright-core').Locator} */ (
                      control
                    ).evaluate((el) => el === document.activeElement),
                    true,
                  );
                }
                for (const [kind, value] of [
                  ["name", "   "],
                  ["json", "{"],
                  ["json", "[]"],
                  ["json", "null"],
                ]) {
                  await name.fill(outer.name);
                  await variables.fill(
                    JSON.stringify(folder.environment ?? {}),
                  );
                  const field = kind === "name" ? name : variables;
                  const id = /** @type {string} */ (
                    kind === "name" ? nameId : variablesId
                  );
                  await field.fill(value);
                  await submit.focus();
                  await submit.press("Enter");
                  const feedback = dialog.locator('[id="' + id + '-error"]');
                  await feedback.waitFor();
                  assert.equal(
                    await field.getAttribute("aria-invalid"),
                    "true",
                  );
                  assert.equal(
                    await field.getAttribute("aria-describedby"),
                    id + "-error",
                  );
                  assert.equal(await feedback.getAttribute("role"), "alert");
                  assert.equal(await dialog.getByRole("alert").count(), 1);
                  assert.ok((await feedback.innerText()).length > 0);
                  assert.equal(await name.count(), 1);
                  assert.equal(await variables.count(), 1);
                  assert.equal(
                    await submit.evaluate(
                      (el) => el === document.activeElement,
                    ),
                    true,
                  );
                  const refused = await load();
                  assert.deepEqual(refused.resources, before.resources);
                  assert.deepEqual(refused.history, before.history);
                  await field.focus();
                  await field.hover();
                  await page.waitForFunction(({ fieldId, errorId }) => {
                    const control = document.getElementById(fieldId);
                    const error = document.getElementById(errorId);
                    if (!control || !error) return false;
                    return getComputedStyle(control).borderTopColor === getComputedStyle(error).color &&
                      !control.getAnimations().some(animation => animation instanceof CSSTransition &&
                        /^border(?:-(?:top|right|bottom|left))?-color$/.test(animation.transitionProperty) &&
                        (animation.playState === "running" || animation.pending));
                  }, { fieldId: id, errorId: id + "-error" }, { timeout: 1500 });
                  const presentation = await field.evaluate((el) => {
                    const s = getComputedStyle(el);
                    return {
                      border: s.borderTopColor,
                      outline: s.outlineStyle,
                      shadow: s.boxShadow,
                      focus: el === document.activeElement,
                    };
                  });
                  assert.equal(
                    presentation.border,
                    await feedback.evaluate((el) => getComputedStyle(el).color),
                  );
                  assert.equal(presentation.outline, "none");
                  assert.equal(presentation.shadow, "none");
                  assert.equal(presentation.focus, true);
                  validationRows.push({
                    theme,
                    width,
                    kind,
                    value,
                    id,
                    description: id + "-error",
                    singleAlert: true,
                    resourcesUnchanged: true,
                    historyUnchanged: true,
                    presentation,
                  });
                }
                const correctedEnvironment = { corrected: true, retained: tag };
                await name.fill(" " + outer.name + " ");
                await variables.fill(JSON.stringify(correctedEnvironment));
                for (const field of [name, variables]) {
                  assert.equal(await field.getAttribute("aria-invalid"), null);
                  assert.equal(
                    await field.getAttribute("aria-describedby"),
                    null,
                  );
                }
                assert.equal(await dialog.getByRole("alert").count(), 0);
                await submit.focus();
                await submit.press("Enter");
                await dialog.waitFor({ state: "detached" });
                let corrected = before;
                await poll(
                  async () => {
                    corrected = await load();
                    const current = corrected.resources.find(
                      (item) => item._id === outer._id,
                    );
                    return (
                      !!current &&
                      current.name === outer.name &&
                      JSON.stringify(current.environment) ===
                        JSON.stringify(correctedEnvironment)
                    );
                  },
                  "Durable trimmed ResourceManager correction",
                  60000,
                );
                const current = corrected.resources.find(
                  (item) => item._id === outer._id,
                );
                assert.ok(current && Number.isFinite(current.modified));
                assert.ok(current.modified >= folder.modified);
                assert.deepEqual(
                  corrected.resources,
                  before.resources.map((item) =>
                    item._id === outer._id
                      ? {
                          ...item,
                          name: outer.name,
                          description: item.description ?? "",
                          environment: correctedEnvironment,
                          environmentPropertyOrder: { $: ["corrected", "retained"] },
                          modified: current.modified,
                        }
                      : item,
                  ),
                );
                assert.deepEqual(corrected.history, before.history);
                await reload();
                const reloaded = await load();
                assert.deepEqual(reloaded.resources, corrected.resources);
                assert.deepEqual(reloaded.history, corrected.history);
                correctionRows.push({
                  theme,
                  width,
                  trimmedName: outer.name,
                  environment: correctedEnvironment,
                  environmentPropertyOrder: { $: ["corrected", "retained"] },
                  unknownFieldsPreserved: true,
                  durable: true,
                  reload: true,
                });
              }
          } catch (error) {
            validationFailures.push(error);
          } finally {
            try {
              if (validationFailures.length === 0) {
                dialog = await manageResource(page, outer.name);
                await dialog
                  .getByRole("textbox", {
                    name: "Folder variables (JSON)",
                    exact: true,
                  })
                  .fill(JSON.stringify(originalFolder.environment ?? {}));
                await save(dialog);
                await poll(
                  async () =>
                    JSON.stringify(
                      (await load()).resources.find(
                        (item) => item._id === outer._id,
                      )?.environment,
                    ) === JSON.stringify(originalFolder.environment ?? {}),
                  "Original owned folder environment restored",
                  60000,
                );
              }
              if (originalViewport)
                await page.setViewportSize(originalViewport);
              await page.locator("html").evaluate((el, theme) => {
                if (theme === null) el.removeAttribute("data-theme");
                else el.setAttribute("data-theme", theme);
              }, originalTheme);
            } catch (error) {
              validationFailures.push(error);
            }
          }
          if (validationFailures.length)
            throw new AggregateError(
              validationFailures,
              "Native ResourceManager field and UI restoration failures retained",
            );
          assert.equal(validationRows.length, 24);
          assert.equal(correctionRows.length, 6);
          await Bun.write(
            output + "/resource-field-validation.json",
            JSON.stringify(
              {
                validationRows,
                correctionRows,
                scope:
                  "Native saved folder fields; CSS viewport profiles; no callback shim or drain-refusal claim",
              },
              null,
              2,
            ),
          );
          const beforeCopy = await load(),
            sourceIds = descendants(beforeCopy.resources, outer._id);
          const copiedSources = beforeCopy.resources.filter(
            (item) =>
              sourceIds.has(item._id) &&
              !nonduplicable.includes(item._type),
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
          await Bun.write(output+"/location-label-dom.json",JSON.stringify(await dialog.locator("select").evaluateAll(els=>els.map(el=>({html:el.outerHTML,labels:Array.from(/** @type {HTMLSelectElement} */(el).labels??[]).map(label=>label.textContent)}))),null,2));
          const location = await locationControl();
          await poll(async()=>await location.locator("option").count()===3,"All original/source/foreign destination options rendered");
          const locationEvidence = await location
            .locator("option")
            .evaluateAll((options) =>
              options.map(
                (option) => ({value:/** @type {HTMLOptionElement} */ (option).value,logicalValue:/** @type {any} */(option).__value,label:option.textContent}),
              ),
            );
          await Bun.write(output + "/location-options.json",JSON.stringify({destinationId,sourceId:workspaceId,outerId:outer._id,innerId:inner._id,options:locationEvidence},null,2));
          const locations = locationEvidence.map(option=>option.value);
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
          await (await locationControl()).selectOption(destinationId);
          assert.equal(await (await locationControl()).inputValue(),destinationId);
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
          await (await locationControl()).selectOption(destinationId);
          assert.equal(await (await locationControl()).inputValue(),destinationId);
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
          const remainingResources = beforeDelete.resources
            .filter((item) => !sourceIds.has(item._id))
            .map((item) => {
              if (item._type !== "workspace_meta") return item;
              const retiredFields = ["activeRequestId", "activeEnvironmentId", "activeUnitTestSuiteId"]
                .filter((field) => sourceIds.has(item[field]));
              if (!retiredFields.length) return item;
              const actual = afterDelete.resources.find((row) => row._id === item._id);
              assert.ok(actual);
              assert.ok(Number.isFinite(actual.modified) && actual.modified >= item.modified && actual.modified <= Date.now());
              return { ...item, ...Object.fromEntries(retiredFields.map((field) => [field, ""])), modified: actual.modified };
            });
          assert.deepEqual(
            afterDelete.resources,
            remainingResources,
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
          const collectionRows = [];
          const collectionSelect = page.getByLabel("Collection", { exact: true });
          const selectCollection = async (/** @type {string} */ id) => {
            await collectionSelect.selectOption(id);
            await resourceSaved(page);
            await poll(async () => (await load()).activeWorkspaceId === id,
              "Durable collection selection", 60000);
            assert.equal(await collectionSelect.inputValue(), id);
          };
          const rootOrder = async () => {
            const current = await load();
            const order = orderedChildren(current.resources, null).map((item) => item._id);
            assert.deepEqual(await collectionSelect.locator("option").evaluateAll(
              (options) => options.map((option) => /** @type {HTMLOptionElement} */ (option).value)), order);
            return order;
          };
          const allBeforeCollections = await load();
          const originalFallback = original.resources.find((item) => item._type === "workspace");
          assert.ok(originalFallback);
          const originalSelectionMeta = original.resources.find((item) =>
            item._type === "workspace_meta" && item.parentId === originalFallback._id);
          assert.ok(originalSelectionMeta, "Original fallback has its captured persisted selection metadata");
          assert.equal(originalSelectionMeta.activeEnvironmentId, original.activeEnvironmentId);
          const previousIds = new Set(allBeforeCollections.resources.map((item) => item._id));
          const createdName = tag + " UI collection";
          await page.getByRole("button", { name: "New collection", exact: true }).click();
          dialog = page.getByRole("dialog");
          await dialog.getByLabel("Name", { exact: true }).fill(createdName);
          await dialog.getByRole("button", { name: "Create", exact: true }).press("Enter");
          await dialog.waitFor({ state: "detached" });
          let createdState = allBeforeCollections;
          await poll(async () => {
            createdState = await load();
            const created = createdState.resources.find((item) => item._type === "workspace" &&
              item.name === createdName && !previousIds.has(item._id));
            const request = createdState.resources.find((item) => item._type === "request" && item.parentId === created?._id);
            const environment = createdState.resources.find((item) => item._type === "environment" && item.parentId === created?._id);
            return !!created && !!request && !!environment &&
              createdState.activeWorkspaceId === created._id && createdState.activeRequestId === request._id;
          }, "Actual UI-created collection persisted", 60000);
          const createdRoots = createdState.resources.filter((item) =>
            item._type === "workspace" && !previousIds.has(item._id));
          assert.equal(createdRoots.length, 1);
          const createdCollection = createdRoots[0];
          registerResourceProbeCollection(createdCollection._id, createdCollection.name);
          const createdRequest = createdState.resources.find((item) =>
            item._type === "request" && item.parentId === createdCollection._id);
          const createdEnvironment = createdState.resources.find((item) =>
            item._type === "environment" && item.parentId === createdCollection._id);
          assert.ok(createdRequest && createdEnvironment);
          assert.equal(createdEnvironment.name, "Base Environment");
          assert.equal(createdState.activeWorkspaceId, createdCollection._id);
          assert.equal(createdState.activeRequestId, createdRequest._id);
          assert.deepEqual(createdState.history, allBeforeCollections.history);
          await reload();
          assert.deepEqual(await rootOrder(), [...orderedChildren(allBeforeCollections.resources, null)
            .map((item) => item._id), createdCollection._id]);
          collectionRows.push({ kind: "UI-create", id: createdCollection._id,
            name: createdName, requestId: createdRequest._id, environmentId: createdEnvironment._id,
            registered: true, reload: true });

          const renamedName = createdName + " renamed";
          await page.getByRole("button", { name: "Manage collection", exact: true }).click();
          dialog = page.getByRole("dialog");
          await dialog.getByRole("textbox", { name: "Name", exact: true }).fill(" " + renamedName + " ");
          await dialog.getByRole("button", { name: "Save changes", exact: true }).press("Enter");
          await dialog.waitFor({ state: "detached" });
          await poll(async () => (await load()).resources.some((item) =>
            item._id === createdCollection._id && item.name === renamedName), "Durable collection rename", 60000);
          registerResourceProbeCollection(createdCollection._id, renamedName);
          await reload();
          await selectCollection(destinationId);
          await selectCollection(createdCollection._id);
          await reload();
          assert.equal((await load()).activeWorkspaceId, createdCollection._id);
          assert.equal(await collectionSelect.locator('option:checked').innerText(), renamedName);
          collectionRows.push({ kind: "UI-rename-switch", id: createdCollection._id,
            name: renamedName, trimmed: true, registered: true, reload: true });

          const collectionFixture = await load();
          const referenceProbeId = "probe_" + crypto.randomUUID();
          const referencedTypes = ["proto_directory", "proto_file", "unit_test_suite", "unit_test", "websocket_payload", "api_spec", "cookie_jar"];
          const referenced = Object.fromEntries(referencedTypes.map((type) => [type, type + "_" + crypto.randomUUID()]));
          for (const type of referencedTypes) collectionFixture.resources.push({
            _id: referenced[type], _type: type, parentId: createdCollection._id,
            name: tag + " copied " + type, created: 1, modified: 1,
            data: { literal: createdCollection._id }, cookies: [],
          });
          const localReferences = {
            requestId: createdRequest._id, environmentId: createdEnvironment._id,
            activeEnvironmentId: createdEnvironment._id, activeRequestId: createdRequest._id,
            activeUnitTestSuiteId: referenced.unit_test_suite, workspaceId: createdCollection._id,
            cookieJarId: referenced.cookie_jar, protoFileId: referenced.proto_file,
            protoDirectoryId: referenced.proto_directory, unitTestSuiteId: referenced.unit_test_suite,
            unitTestId: referenced.unit_test, activePayloadId: referenced.websocket_payload,
            sourceSpecId: referenced.api_spec,
          };
          collectionFixture.resources.push({ _id: referenceProbeId, _type: "unknown_retained_probe",
            parentId: createdCollection._id, name: tag + " unknown retained", ...localReferences,
            literal: JSON.stringify(localReferences), nested: { ...localReferences }, created: 1, modified: 1 });
          collectionFixture.resources.push({ _id: "probe_" + crypto.randomUUID(), _type: "unknown_foreign_probe",
            parentId: createdCollection._id, name: tag + " foreign retained",
            ...Object.fromEntries(Object.keys(localReferences).map((key) => [key, "uncopied_" + key])),
            literal: createdCollection._id, created: 1, modified: 1 });
          const excludedIds = new Set();
          for (const type of nonduplicable) {
            const privateId = type + "_" + crypto.randomUUID(), childId = "excluded_child_" + crypto.randomUUID();
            excludedIds.add(privateId); excludedIds.add(childId);
            collectionFixture.resources.push({ _id: privateId, _type: type, parentId: createdCollection._id,
              name: tag + " excluded " + type, activeEnvironmentId: "", created: 1, modified: 1 });
            collectionFixture.resources.push({ _id: childId, _type: "unknown_excluded_child",
              parentId: privateId, name: tag + " excluded child " + type, created: 1, modified: 1 });
          }
          const collectionHistory = { _id: "res_" + crypto.randomUUID(), requestId: createdRequest._id,
            created: Date.now(), status: 200, body: "owned collection history boundary", bodyBase64: Buffer.from("owned collection history boundary").toString("base64") };
          collectionFixture.history.push(collectionHistory);
          await invoke("save_workspace", { data: collectionFixture });
          await reload();
          const beforeCollectionCopy = await load();
          const sourceCollectionIds = descendants(beforeCollectionCopy.resources, createdCollection._id);
          const copyableSources = beforeCollectionCopy.resources.filter((item) =>
            sourceCollectionIds.has(item._id) && !excludedIds.has(item._id) && !nonduplicable.includes(item._type));
          await page.getByRole("button", { name: "Manage collection", exact: true }).click();
          dialog = page.getByRole("dialog");
          const collectionCopyStarted = Date.now();
          await dialog.getByRole("button", { name: "Duplicate", exact: true }).click();
          await dialog.waitFor({ state: "detached" });
          let collectionCopied = beforeCollectionCopy;
          await poll(async () => {
            collectionCopied = await load();
            return collectionCopied.resources.some((item) => item._type === "workspace" &&
              item.name === renamedName + " (copy)" && !beforeCollectionCopy.resources.some((old) => old._id === item._id));
          }, "Actual duplicated collection persisted", 60000);
          const duplicatedRoots = collectionCopied.resources.filter((item) => item._type === "workspace" &&
            !beforeCollectionCopy.resources.some((old) => old._id === item._id));
          assert.equal(duplicatedRoots.length, 1);
          const duplicateCollection = duplicatedRoots[0];
          registerResourceProbeCollection(duplicateCollection._id, duplicateCollection.name);
          const duplicateIds = descendants(collectionCopied.resources, duplicateCollection._id);
          const duplicateResources = collectionCopied.resources.filter((item) => duplicateIds.has(item._id));
          const selectionMetadata = duplicateResources.filter((item) => item._type === "workspace_meta");
          assert.equal(selectionMetadata.length, 1, "Selecting the duplicate creates one fresh local metadata record");
          const initialCopyMeta = selectionMetadata[0];
          assert.deepEqual(Object.keys(initialCopyMeta).sort(),
            ["_id", "_type", "parentId", "activeRequestId", "created", "modified"].sort());
          assert.ok(initialCopyMeta.created >= collectionCopyStarted && initialCopyMeta.modified >= initialCopyMeta.created);
          const collectionCopies = duplicateResources.filter((item) => item._type !== "workspace_meta");
          assert.equal(collectionCopies.length, copyableSources.length);
          assert.deepEqual(collectionCopied.resources.filter((item) =>
            beforeCollectionCopy.resources.some((prior) => prior._id === item._id)), beforeCollectionCopy.resources,
            "Duplicate leaves every source/original resource unchanged");
          assert.deepEqual(collectionCopied.resources.filter((item) =>
            !beforeCollectionCopy.resources.some((prior) => prior._id === item._id)), duplicateResources,
            "All newly duplicated IDs belong to the actual copied subtree");
          const mapping = new Map();
          for (const source of copyableSources) {
            const matches = collectionCopies.filter((item) => item._type === source._type &&
              item.name === (source._id === createdCollection._id ? source.name + " (copy)" : source.name));
            assert.equal(matches.length, 1);
            assert.ok(!beforeCollectionCopy.resources.some((item) => item._id === matches[0]._id));
            mapping.set(source._id, matches[0]._id);
          }
          const collectionReferenceKeys = ["_id", "parentId", "requestId", "environmentId", "activeEnvironmentId",
            "activeRequestId", "activeUnitTestSuiteId", "workspaceId", "cookieJarId", "protoFileId",
            "protoDirectoryId", "unitTestSuiteId", "unitTestId", "activePayloadId", "sourceSpecId"];
          for (const source of copyableSources) {
            const copy = collectionCopies.find((item) => item._id === mapping.get(source._id));
            assert.ok(copy && copy.created > 1 && copy.modified >= copy.created);
            const expected = structuredClone(source);
            for (const key of collectionReferenceKeys) if (mapping.has(expected[key])) expected[key] = mapping.get(expected[key]);
            if (source._type === "request") {
              assert.equal(Object.hasOwn(source, "_importRequestIds"), false, "Owned fixture starts without imported script aliases");
              expected._importRequestIds = [source._id];
            }
            expected.created = copy.created; expected.modified = copy.modified;
            if (source._id === createdCollection._id) {
              expected.name = source.name + " (copy)"; expected.metaSortKey = copy.metaSortKey;
            }
            assert.deepEqual(copy, expected, "Exact independent full-reference copy; payload literals unchanged");
          }
          assert.equal(collectionCopies.some((item) => nonduplicable.includes(item._type) || item._type === "unknown_excluded_child"), false);
          assert.equal(initialCopyMeta.activeRequestId, mapping.get(createdRequest._id));
          assert.deepEqual(collectionCopied.history, beforeCollectionCopy.history);
          assert.equal(collectionCopied.activeWorkspaceId, duplicateCollection._id);
          assert.equal(collectionCopied.activeEnvironmentId, "", "Duplicate starts without retained environment selection");
          await reload();
          assert.deepEqual(await rootOrder(), [...orderedChildren(beforeCollectionCopy.resources, null)
            .map((item) => item._id), duplicateCollection._id]);
          // Loading normalizes the fresh local selection metadata. Persist through
          // the actual owned collection form before using it as the reorder baseline.
          await page.getByRole("button", { name: "Manage collection", exact: true }).click();
          dialog = page.getByRole("dialog");
          await save(dialog);
          let normalizedCopy = collectionCopied;
          await poll(async () => {
            normalizedCopy = await load();
            return normalizedCopy.resources.some((item) => item._type === "workspace_meta" &&
              item.parentId === duplicateCollection._id);
          }, "Fresh duplicated selection metadata persisted", 60000);
          const freshCopyMetadata = normalizedCopy.resources.filter((item) =>
            !collectionCopied.resources.some((prior) => prior._id === item._id));
          assert.equal(freshCopyMetadata.length, 0, "Reload normalizes the same metadata instead of creating another record");
          const freshMeta = normalizedCopy.resources.find((item) => item._id === initialCopyMeta._id);
          assert.ok(freshMeta);
          assert.deepEqual(Object.keys(freshMeta).sort(),
            ["_id", "_type", "parentId", "activeRequestId", "activeEnvironmentId", "created", "modified"].sort());
          assert.equal(freshMeta._type, "workspace_meta");
          assert.equal(freshMeta.parentId, duplicateCollection._id);
          assert.equal(freshMeta.activeEnvironmentId, "");
          assert.equal(freshMeta.activeRequestId, mapping.get(createdRequest._id));
          assert.equal(freshMeta.created, initialCopyMeta.created);
          assert.ok(freshMeta.modified >= initialCopyMeta.modified && freshMeta.modified <= Date.now());
          const normalizedRoot = normalizedCopy.resources.find((item) => item._id === duplicateCollection._id);
          assert.ok(normalizedRoot && Number.isFinite(normalizedRoot.modified));
          assert.deepEqual(normalizedCopy.resources, collectionCopied.resources.map((item) =>
            item._id === duplicateCollection._id ? { ...item, modified: normalizedRoot.modified }
              : item._id === initialCopyMeta._id ? freshMeta : item));
          assert.deepEqual(normalizedCopy.history, collectionCopied.history);
          collectionRows.push({ kind: "UI-duplicate", sourceId: createdCollection._id, duplicateId: duplicateCollection._id,
            registered: true, excludedTypes: nonduplicable, excludedDescendants: nonduplicable.length,
            referenceKeys: collectionReferenceKeys, unknownRetention: "current compatibility policy", historyCopied: false,
            freshSelectionMetadataId: freshMeta._id, reload: true });

          const beforeRootReorder = await load();
          const rootIdsBefore = orderedChildren(beforeRootReorder.resources, null).map((item) => item._id);
          let expectedRootOrder = [...rootIdsBefore];
          for (const [button, direction] of [["Move up", -1], ["Move down", 1]]) {
            const prior = await load(), lower = Date.now();
            await page.getByRole("button", { name: "Manage collection", exact: true }).click();
            dialog = page.getByRole("dialog");
            await dialog.getByRole("button", { name: /** @type {string} */ (button), exact: true }).click();
            const index = expectedRootOrder.indexOf(duplicateCollection._id), target = index + Number(direction);
            [expectedRootOrder[index], expectedRootOrder[target]] = [expectedRootOrder[target], expectedRootOrder[index]];
            let moved = prior;
            await poll(async () => {
              moved = await load();
              return JSON.stringify(orderedChildren(moved.resources, null).map((item) => item._id)) === JSON.stringify(expectedRootOrder);
            }, "Durable real collection reorder", 60000);
            const upper = Date.now();
            assert.deepEqual(moved.history, prior.history);
            assert.deepEqual(moved.resources, prior.resources.map((item) => {
              if (item._type !== "workspace") return item;
              const actual = moved.resources.find((row) => row._id === item._id);
              assert.ok(actual && actual.modified >= lower && actual.modified <= upper);
              return { ...item, metaSortKey: (expectedRootOrder.indexOf(item._id) + 1) * 100, modified: actual.modified };
            }), "Only authorized root sort keys/time changed, every other field/resource retained");
            await close(dialog);
            await reload();
            assert.deepEqual(await rootOrder(), expectedRootOrder);
          }
          const restoredRootOrder = await load();
          for (const item of restoredRootOrder.resources.filter((row) => row._type === "workspace")) {
            const prior = beforeRootReorder.resources.find((row) => row._id === item._id);
            assert.ok(prior);
            for (const key of ["metaSortKey", "modified"]) {
              if (Object.hasOwn(prior, key)) item[key] = prior[key]; else delete item[key];
            }
          }
          await invoke("save_workspace", { data: restoredRootOrder });
          await reload();
          assert.deepEqual((await load()).resources, beforeRootReorder.resources);
          assert.deepEqual((await load()).history, beforeRootReorder.history);
          assert.deepEqual(await rootOrder(), rootIdsBefore);
          collectionRows.push({ kind: "UI-root-reorder", up: true, down: true,
            allowedFields: ["metaSortKey", "modified"], timestampBounds: true, originalRootFieldsRestored: true, reload: true });

          await selectCollection(createdCollection._id);
          const beforeCancelCollectionDelete = await load();
          await page.getByRole("button", { name: "Manage collection", exact: true }).click();
          dialog = page.getByRole("dialog");
          await dialog.getByRole("button", { name: "Delete…", exact: true }).click();
          await dialog.getByRole("button", { name: "Back", exact: true }).click();
          await close(dialog);
          assert.deepEqual(await load(), beforeCancelCollectionDelete);
          await reload();
          assert.deepEqual((await load()).resources, beforeCancelCollectionDelete.resources);
          assert.deepEqual((await load()).history, beforeCancelCollectionDelete.history);
          collectionRows.push({ kind: "UI-cancel-delete", id: createdCollection._id, completeModelUnchanged: true, reload: true });
          for (const id of [createdCollection._id, duplicateCollection._id]) {
            await selectCollection(id);
            const prior = await load(), removed = descendants(prior.resources, id);
            const expectedFallback = prior.resources.find((item) => item._type === "workspace" && item._id !== id);
            assert.ok(expectedFallback && original.resources.some((item) => item._id === expectedFallback._id));
            await page.getByRole("button", { name: "Manage collection", exact: true }).click();
            dialog = page.getByRole("dialog");
            await dialog.getByRole("button", { name: "Delete…", exact: true }).click();
            await dialog.getByRole("button", { name: "Delete", exact: true }).click();
            await dialog.waitFor({ state: "detached" });
            let deleted = prior;
            await poll(async () => {
              deleted = await load();
              return !deleted.resources.some((item) => item._id === id) && deleted.activeWorkspaceId === expectedFallback._id;
            }, "Durable collection deletion and fallback", 60000);
            assert.deepEqual(deleted.resources, prior.resources.filter((item) => !removed.has(item._id)));
            assert.deepEqual(deleted.history, prior.history.filter((item) => !removed.has(item.requestId)));
            const fallbackRequest = deleted.resources.find((item) => item._type === "request" && item.parentId === expectedFallback._id);
            assert.ok(fallbackRequest);
            assert.equal(deleted.activeRequestId, fallbackRequest._id);
            const expectedTabs = prior.openTabs.filter((tab) => !removed.has(tab));
            if (!expectedTabs.includes(fallbackRequest._id)) expectedTabs.push(fallbackRequest._id);
            assert.deepEqual(deleted.openTabs, expectedTabs);
            await reload();
            assert.equal(await collectionSelect.inputValue(), expectedFallback._id);
            assert.deepEqual((await load()).resources, deleted.resources);
            assert.deepEqual((await load()).history, deleted.history);
          }
          collectionRows.push({ kind: "UI-confirm-delete", removed: [createdCollection._id, duplicateCollection._id],
            subtreePrivateHistoryTabsRemoved: true, fallbackOriginalSelected: true, reload: true, extraSends: 0 });
          assert.equal(collectionRows.length, 6);
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
                validationRows,
                correctionRows,
                collectionRows,
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
