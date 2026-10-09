import assert from "node:assert/strict";
import { poll } from "./native-app.js";

/** Actual owned collection import and API Design worker generation.
 * @param {Pick<import('./native-app.js').ScenarioContext,'page'|'invoke'>} context
 * @param {Record<string,any>} document @param {number} count @param {string} label */
export async function generateOwnedOpenApi(
  { page, invoke },
  document,
  count,
  label,
) {
  const ownedName = label + " " + Date.now();
  await page
    .getByRole("button", { name: "Import collection", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Import collection or cURL commands", { exact: true })
    .fill(
      JSON.stringify({
        resources: [
          {
            _id: "wrk_owned_openapi",
            _type: "workspace",
            parentId: null,
            name: ownedName,
            scope: "collection",
          },
        ],
      }),
    );
  await dialog
    .getByRole("button", { name: "Review import", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Import", exact: true })
    .click({ timeout: 60000 });
  await dialog.waitFor({ state: "detached", timeout: 60000 });
  let workspaceId = "";
  await poll(
    async () => {
      const data = await invoke("load_workspace");
      const owned = data.resources.find(
        (/** @type {any} */ r) =>
          r._type === "workspace" && r.name === ownedName,
      );
      if (!owned || data.activeWorkspaceId !== owned._id) return false;
      workspaceId = owned._id;
      return true;
    },
    "Owned collection import persisted",
    60000,
  );
  assert.ok(workspaceId);
  await page.getByRole("button", { name: "API Design", exact: true }).click();
  const design = page.getByRole("region", { name: "API Design", exact: true });
  await design
    .getByRole("button", { name: "New document", exact: true })
    .click();
  const text = JSON.stringify(document, null, 2);
  await design
    .locator(".CodeMirror")
    .first()
    .evaluate((el, value) => {
      /** @type {any} */ (el).CodeMirror.setValue(value);
    }, text);
  await poll(
    async () =>
      (await invoke("load_workspace")).resources.some(
        (/** @type {any} */ r) =>
          r._type === "api_spec" &&
          r.parentId === workspaceId &&
          r.contents === text,
      ),
    "Owned OpenAPI source persisted",
  );
  const spec = (await invoke("load_workspace")).resources.find(
    (/** @type {any} */ r) =>
      r._type === "api_spec" &&
      r.parentId === workspaceId &&
      r.contents === text,
  );
  assert.ok(spec);
  await design
    .getByRole("button", { name: "Validate & preview", exact: true })
    .click();
  const generate = design.getByRole("button", {
    name: `Generate ${count} requests`,
    exact: true,
  });
  await generate.waitFor();
  await generate.click();
  await poll(
    async () =>
      (await invoke("load_workspace")).resources.filter(
        (/** @type {any} */ r) =>
          r._type === "request" && r.sourceSpecId === spec._id,
      ).length === count,
    "Actual worker generated requests",
    60000,
  );
  await page.getByRole("button", { name: "Collections", exact: true }).click();
  return spec._id;
}
