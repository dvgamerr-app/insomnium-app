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
                validationRows,
                correctionRows,
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
