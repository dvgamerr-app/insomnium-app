import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { initialData, historyLimit } from "../../../src/lib/model.js";
import {
  withNativeApp,
  poll,
  resourceCrudProbeIdentifier,
} from "./native-app.js";
import {
  withResourceProbePreserved,
  registerResourceProbeCollection,
  resourceSaved,
} from "./resource-manager-cases.js";
import { createManualHttpFixture, manualReply } from "./http-manual-fixture.js";
import { measureEnvironmentName } from "./environment-name.js";
import { exerciseNativeEnvironmentDependencies } from "./environment-native-dependencies.js";

const layoutKeys = [
  "nocturne:split:workspace-left",
  "nocturne:split:request-response",
  "nocturne:split:design",
  "insomnium:split:workspace-left",
  "insomnium:split:request-response",
];

/** SAME environment preview entry's explicit, separately preserved native route. */
export async function runNativeEnvironmentCases() {
  assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE);
  assert.ok(process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP);
  const options = {
    expectedIdentifier: resourceCrudProbeIdentifier,
    profileOwnershipPath: process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP,
  };
  await withResourceProbePreserved(
    async (capture) => {
      const fixture = await createManualHttpFixture({
        reply: (record) => ({
          body: record.token.startsWith("env-dependency-")
            ? Buffer.from(
                JSON.stringify({
                  token: new URL(record.path, "http://owned").searchParams.get(
                    "scope",
                  ),
                }),
              )
            : manualReply(record.token, record.status),
          contentType: record.token.startsWith("env-dependency-")
            ? "application/json"
            : "text/plain; charset=utf-8",
        }),
      });
      const failures = /** @type {unknown[]} */ ([]);
      let output = "";
      try {
        await withNativeApp(
          "template-tag-environment-native",
          async (context) => {
            output = context.output;
            const marker = await Bun.file(
              /** @type {string} */ (options.profileOwnershipPath),
            ).json();
            assert.equal(marker.identifier, resourceCrudProbeIdentifier);
            assert.equal(marker.state, "owned");
            const launch = marker.launches.at(-1);
            assert.equal(launch?.pid, context.pid);
            assert.equal(launch.directoryAbsentAtBind, false);
            assert.equal(launch.profileBinding, "native-path-directory");
            await capture();
            await exerciseNativeEnvironmentCases(context, fixture);
          },
          options,
        );
      } catch (error) {
        failures.push(error);
      }
      try {
        const retirement = await fixture.closeAfterHostExit();
        if (output)
          await Bun.write(
            output + "/environment-socket-retirement.json",
            JSON.stringify(retirement, null, 2),
          );
      } catch (error) {
        if (output)
          await Bun.write(
            output + "/environment-socket-retirement-failure.json",
            JSON.stringify(
              {
                passed: false,
                afterNativeAppSettlement: true,
                records: fixture.records,
                sockets: fixture.socketRecords,
                liveSockets: fixture.liveSockets,
                pending: fixture.pending,
                error: String(error),
              },
              null,
              2,
            ),
          );
        failures.push(error);
      }
      if (failures.length)
        throw new AggregateError(
          failures,
          "Native environment/owned socket failures retained",
        );
    },
    { ...options, lazyCapture: true },
  );
}

/** @param {import('./native-app.js').ScenarioContext} context
 * @param {Awaited<ReturnType<typeof createManualHttpFixture>>} fixture */
async function exerciseNativeEnvironmentCases(context, fixture) {
  const { page, invoke, output } = context;
  const load = () => invoke("load_workspace");
  const until = (
    /** @type {()=>Promise<boolean>} */ read,
    /** @type {string} */ label,
  ) => poll(read, label, 60000);
  const original = await load();
  assert.equal(
    original.history.length,
    0,
    "Reviewed fixed profile original history remains intact",
  );
  const viewport = page.viewportSize();
  const layout = await page.evaluate(
    (keys) =>
      Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])),
    layoutKeys,
  );
  const checks = /** @type {Record<string,any>[]} */ ([]);
  const errors = /** @type {string[]} */ ([]);
  page.on("pageerror", (error) => errors.push(error.message));
  const progress = () =>
    Bun.write(
      output + "/environment-native-progress.json",
      JSON.stringify({ checks, wires: fixture.records }, null, 2),
    );
  const checkpoint = async (/** @type {Record<string,any>} */ row) => {
    checks.push(row);
    await progress();
  };
  const caller = initialData(),
    target = initialData();
  const collection = (/** @type {ReturnType<typeof initialData>} */ data) => {
    const row = data.resources.find((row) => row._type === "workspace");
    assert.ok(row);
    return row;
  };
  const callerCollection = collection(caller),
    targetCollection = collection(target);
  callerCollection.name = "Native environments " + crypto.randomUUID();
  targetCollection.name = "Native foreign environments " + crypto.randomUUID();
  registerResourceProbeCollection(callerCollection._id, callerCollection.name);
  registerResourceProbeCollection(targetCollection._id, targetCollection.name);
  const base = caller.resources.find((row) => row._type === "environment");
  assert.ok(base);
  const request = caller.resources.find(
    (row) => row._id === caller.activeRequestId,
  );
  assert.ok(request);
  request.name = "Environment wire " + crypto.randomUUID();
  request.method = "POST";
  const seed = {
    ...original,
    settings: {
      ...original.settings,
      maxHistory: Math.max(historyLimit(original.settings.maxHistory), 40),
    },
    resources: [
      ...original.resources,
      ...caller.resources,
      ...target.resources,
    ],
    activeWorkspaceId: callerCollection._id,
    activeRequestId: request._id,
    activeEnvironmentId: "",
    openTabs: [...original.openTabs, request._id],
  };
  await invoke("save_workspace", { data: seed });
  for (const owned of [callerCollection, targetCollection])
    assert.deepEqual(
      (await load()).resources.find(
        (/** @type {any} */ r) => r._id === owned._id,
      ),
      owned,
    );
  await Bun.write(
    output + "/environment-fixtures.json",
    JSON.stringify(
      {
        collections: [callerCollection, targetCollection],
        registeredBeforeFirstSave: true,
      },
      null,
      2,
    ),
  );
  await page.reload();
  await resourceSaved(page);
  const dialog = () =>
    page.getByRole("dialog", { name: "Manage environments", exact: true });
  const close = async () => {
    await dialog().getByRole("button", { name: "Cancel", exact: true }).click();
    await dialog().waitFor({ state: "detached" });
  };
  const open = async (/** @type {string} */ id = base._id) => {
    await page
      .getByRole("button", { name: "Edit environment", exact: true })
      .click();
    await dialog()
      .getByRole("combobox", { name: "Environment to edit", exact: true })
      .selectOption(id);
    return dialog();
  };
  const choose = async (/** @type {string} */ id) => {
    await page
      .getByRole("combobox", { name: "Active environment", exact: true })
      .selectOption(id);
    await resourceSaved(page);
    await until(
      async () => (await load()).activeEnvironmentId === id,
      "Durable environment selection",
    );
  };
  const chooseCollection = async (/** @type {string} */ id) => {
    await page.getByLabel("Collection", { exact: true }).selectOption(id);
    await resourceSaved(page);
    await until(
      async () => (await load()).activeWorkspaceId === id,
      "Durable owned collection selection",
    );
  };
  const setTheme = async (/** @type {string} */ theme) => {
    if ((await page.locator("html").getAttribute("data-theme")) !== theme)
      await page
        .getByRole("button", { name: "Toggle theme", exact: true })
        .click();
    await until(
      async () =>
        (await load()).settings.theme === theme &&
        (await page.locator("html").getAttribute("data-theme")) === theme,
      "Durable environment theme",
    );
  };
  const edit = async (
    /** @type {string} */ id,
    /** @type {string} */ name,
    /** @type {Record<string,any>} */ data,
  ) => {
    const expectedPropertyOrder = { $: Object.keys(data) };
    const pane = await open(id);
    await pane.getByRole("textbox", { name: "Name", exact: true }).fill(name);
    const input = pane
      .locator(".shared-code-editor")
      .filter({ has: page.locator('textarea[aria-label="Environment JSON"]') })
      .locator(".CodeMirror");
    await input.evaluate(
      (el, text) => /** @type {any} */ (el).CodeMirror.setValue(text),
      JSON.stringify(data, null, 2),
    );
    await pane
      .getByRole("button", { name: "Save environment", exact: true })
      .press("Enter");
    await pane.waitFor({ state: "detached" });
    await until(async () => {
      const row = (await load()).resources.find(
        (/** @type {any} */ r) => r._id === id,
      );
      return (
        row?.name === name.trim() &&
        isDeepStrictEqual(row.data, data) &&
        isDeepStrictEqual(row.dataPropertyOrder, expectedPropertyOrder)
      );
    }, "Authored environment persisted");
    await page.reload();
    await resourceSaved(page);
    const row = (await load()).resources.find(
      (/** @type {any} */ r) => r._id === id,
    );
    assert.equal(row.name, name.trim());
    assert.deepEqual(row.data, data);
    assert.deepEqual(row.dataPropertyOrder, expectedPropertyOrder);
    return row;
  };
  try {
    const baseData = {
      scope: "base",
      baseOnly: "base-value",
      same: "base",
      falseValue: false,
      zero: 0,
      nil: null,
      empty: "",
      recursive: "{{ _.baseOnly }}",
    };
    await edit(base._id, " Base native ", baseData);
    await open(base._id);
    assert.equal(
      await dialog()
        .getByRole("button", { name: "Delete…", exact: true })
        .isDisabled(),
      true,
    );
    await close();
    await checkpoint({
      kind: "base-edit-reload-delete-protected",
      id: base._id,
    });
    const beforeCreate = await load();
    await open(base._id);
    await dialog()
      .getByRole("button", { name: "New environment", exact: true })
      .click();
    const create = page.getByRole("dialog");
    const subName = "Owned sub " + crypto.randomUUID();
    await create
      .getByRole("textbox", { name: "Name", exact: true })
      .fill(" " + subName + " ");
    await create
      .getByRole("checkbox", { name: "Private environment", exact: true })
      .check();
    await create
      .getByRole("button", { name: "Create", exact: true })
      .press("Enter");
    await create.waitFor({ state: "detached" });
    let sub = /** @type {any} */ (null);
    await until(async () => {
      const current = await load();
      sub = current.resources.find(
        (/** @type {any} */ r) =>
          r._type === "environment" &&
          r.name === subName &&
          !beforeCreate.resources.some(
            (/** @type {any} */ old) => old._id === r._id,
          ),
      );
      return !!sub;
    }, "Actual UI-created environment");
    assert.equal(sub.parentId, base._id);
    assert.equal(sub.isPrivate, true);
    assert.equal(sub.color, null);
    assert.deepEqual(sub.data, {});
    await page.reload();
    await resourceSaved(page);
    await checkpoint({ kind: "actual-private-sub-create-reload", id: sub._id });
    let subData = /** @type {Record<string,any>} */ ({
      scope: "sub",
      same: "sub",
      subOnly: "sub-value",
    });
    await edit(sub._id, " Renamed sub " + subName + " ", subData);
    await choose(sub._id);
    await checkpoint({ kind: "actual-sub-trimmed-rename-reload", id: sub._id });
    const names = await measureEnvironmentName(page, output, {
      saved: load,
      until,
      setTheme,
      native: true,
    });
    assert.equal(names.rows.length, 6);
    assert.equal(names.jsonRows.length, 12);
    await page.setViewportSize({ width: 1440, height: 960 });
    await checkpoint({
      kind: "actual-create-trim-rename-name6-json12",
      id: sub._id,
    });
    for (const invalid of ["null", "true", "0", '"text"']) {
      const before = await load();
      await open(sub._id);
      await dialog()
        .locator(".CodeMirror")
        .evaluate(
          (el, text) => /** @type {any} */ (el).CodeMirror.setValue(text),
          invalid,
        );
      await dialog()
        .getByRole("button", { name: "Save environment", exact: true })
        .press("Enter");
      const error = dialog().getByRole("alert");
      await error.waitFor();
      assert.match(
        await error.innerText(),
        /Environment must be a JSON object/,
      );
      assert.equal(await error.getAttribute("id"), null);
      assert.equal(
        await dialog()
          .getByRole("textbox", { name: "Name", exact: true })
          .getAttribute("aria-invalid"),
        null,
      );
      assert.deepEqual(await load(), before);
      await close();
      await checkpoint({ kind: "native-json-nonobject-no-save", invalid });
    }
    const beforeAppearance = await load();
    await open(sub._id);
    await dialog()
      .getByRole("checkbox", { name: "Private environment", exact: true })
      .uncheck();
    await dialog()
      .getByLabel("Environment color", { exact: true })
      .fill("#123456");
    await close();
    assert.deepEqual(
      await load(),
      beforeAppearance,
      "Privacy/color draft Cancel makes no saved change",
    );
    await checkpoint({ kind: "privacy-color-draft-cancel-exact", id: sub._id });
    await open(sub._id);
    assert.equal(
      await dialog()
        .getByRole("checkbox", { name: "Private environment", exact: true })
        .isChecked(),
      true,
    );
    await dialog()
      .getByRole("checkbox", { name: "Private environment", exact: true })
      .uncheck();
    await dialog()
      .getByLabel("Environment color", { exact: true })
      .fill("#123456");
    const orderedText =
      '{"scope":"sub","same":"sub","subOnly":"sub-value","12":"twelve","2":"two","nested":{"9":"nine","2":"two"}}';
    const orderedInput = dialog()
      .locator(".shared-code-editor")
      .filter({ has: page.locator('textarea[aria-label="Environment JSON"]') })
      .locator(".CodeMirror");
    await orderedInput.evaluate(
      (el, text) => /** @type {any} */ (el).CodeMirror.setValue(text),
      orderedText,
    );
    await dialog()
      .getByRole("button", { name: "Save environment", exact: true })
      .press("Enter");
    await dialog().waitFor({ state: "detached" });
    await until(async () => {
      const row = (await load()).resources.find(
        (/** @type {any} */ r) => r._id === sub._id,
      );
      return row.isPrivate === false && row.color === "#123456";
    }, "Privacy/color/order save durable");
    await page.reload();
    await resourceSaved(page);
    const appearance = (await load()).resources.find(
      (/** @type {any} */ r) => r._id === sub._id,
    );
    subData = JSON.parse(orderedText);
    assert.deepEqual(appearance.data, subData);
    assert.deepEqual(appearance.dataPropertyOrder, {
      $: ["scope", "same", "subOnly", "12", "2", "nested"],
      "$~|nested": ["9", "2"],
    });
    assert.equal(
      await page
        .getByRole("combobox", { name: "Active environment", exact: true })
        .locator('option[value="' + sub._id + '"]')
        .evaluate((el) => el.style.color),
      "rgb(18, 52, 86)",
    );
    await checkpoint({
      kind: "privacy-color-property-order-save-reload",
      id: sub._id,
      color: appearance.color,
      propertyOrder: appearance.dataPropertyOrder,
    });
    await open(sub._id);
    const orderedValue = await dialog()
      .locator(".CodeMirror")
      .evaluate((el) => /** @type {any} */ (el).CodeMirror.getValue());
    assert.ok(orderedValue.indexOf('"12"') < orderedValue.indexOf('"2"'));
    assert.ok(orderedValue.indexOf('"9"') < orderedValue.lastIndexOf('"2"'));
    await dialog()
      .getByRole("button", { name: "Clear environment color", exact: true })
      .click();
    await dialog()
      .getByRole("checkbox", { name: "Private environment", exact: true })
      .check();
    await dialog()
      .getByRole("button", { name: "Save environment", exact: true })
      .click();
    await dialog().waitFor({ state: "detached" });
    await until(async () => {
      const row = (await load()).resources.find(
        (/** @type {any} */ r) => r._id === sub._id,
      );
      return row.isPrivate === true && row.color === null;
    }, "Clear color/private save durable");
    await page.reload();
    await resourceSaved(page);
    assert.equal(
      (await load()).resources.find(
        (/** @type {any} */ row) => row._id === sub._id,
      ).color,
      null,
    );
    assert.match(
      await page
        .getByRole("combobox", { name: "Active environment", exact: true })
        .locator('option[value="' + sub._id + '"]')
        .innerText(),
      /\(private\)$/,
    );
    await checkpoint({
      kind: "private-create-toggle-cancel-color-clear-recursive-numeric-property-order",
      id: sub._id,
      propertyOrder: appearance.dataPropertyOrder,
    });
    const priorCopy = await load();
    await open(sub._id);
    await dialog()
      .getByRole("button", { name: "Duplicate", exact: true })
      .click();
    let copy = /** @type {any} */ (null);
    await until(async () => {
      copy = (await load()).resources.find(
        (/** @type {any} */ r) =>
          r._type === "environment" &&
          !priorCopy.resources.some(
            (/** @type {any} */ old) => old._id === r._id,
          ),
      );
      return !!copy;
    }, "Actual duplicated environment");
    assert.notEqual(copy._id, sub._id);
    assert.equal(copy.parentId, base._id);
    assert.deepEqual(copy.data, subData);
    assert.equal(
      copy.name,
      priorCopy.resources.find((/** @type {any} */ r) => r._id === sub._id)
        .name + " (copy)",
    );
    await close();
    await page.reload();
    await resourceSaved(page);
    const beforeCancel = await load();
    await open(copy._id);
    await dialog()
      .getByRole("button", { name: "Delete…", exact: true })
      .click();
    const confirm = page.getByRole("dialog", {
      name: "Delete environment?",
      exact: true,
    });
    await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
    await close();
    assert.deepEqual(await load(), beforeCancel);
    await checkpoint({
      kind: "duplicate-fresh-data-cancel-delete-exact",
      id: copy._id,
    });
    assert.equal(copy.isPrivate, true);
    assert.equal(copy.color, null);
    assert.deepEqual(copy.dataPropertyOrder, appearance.dataPropertyOrder);
    const orderIds = async () =>
      page
        .getByRole("combobox", { name: "Active environment", exact: true })
        .locator("option")
        .evaluateAll((nodes) =>
          nodes.map((node) => /** @type {HTMLOptionElement} */ (node).value),
        );
    const beforeOrder = await load(),
      oldOrder = await orderIds(),
      reorderStart = Date.now();
    await open(copy._id);
    assert.equal(
      await dialog()
        .getByRole("button", { name: "Move environment down", exact: true })
        .isDisabled(),
      true,
    );
    await dialog()
      .getByRole("button", { name: "Move environment up", exact: true })
      .click();
    await until(async () => {
      const data = await load();
      return (
        data.resources.find((/** @type {any} */ r) => r._id === copy._id)
          .metaSortKey <
        data.resources.find((/** @type {any} */ r) => r._id === sub._id)
          .metaSortKey
      );
    }, "Actual environment Move up durable");
    await close();
    await page.reload();
    await resourceSaved(page);
    const moved = await load();
    assert.deepEqual(await orderIds(), ["", copy._id, sub._id]);
    for (const row of beforeOrder.resources) {
      const next = moved.resources.find(
        (/** @type {any} */ r) => r._id === row._id,
      );
      if ([sub._id, copy._id].includes(row._id)) {
        const strip = (/** @type {any} */ r) =>
          Object.fromEntries(
            Object.entries(r).filter(
              ([key]) => !["metaSortKey", "modified"].includes(key),
            ),
          );
        assert.deepEqual(strip(next), strip(row));
        if (next.modified !== row.modified)
          assert.ok(
            next.modified >= reorderStart && next.modified <= Date.now(),
          );
      } else assert.deepEqual(next, row);
    }
    assert.deepEqual(moved.history, beforeOrder.history);
    await open(copy._id);
    assert.equal(
      await dialog()
        .getByRole("button", { name: "Move environment up", exact: true })
        .isDisabled(),
      true,
    );
    await dialog()
      .getByRole("button", { name: "Move environment down", exact: true })
      .click();
    await until(async () => {
      const data = await load();
      return (
        data.resources.find((/** @type {any} */ r) => r._id === copy._id)
          .metaSortKey >
        data.resources.find((/** @type {any} */ r) => r._id === sub._id)
          .metaSortKey
      );
    }, "Actual environment Move down durable");
    await close();
    await page.reload();
    await resourceSaved(page);
    assert.deepEqual(await orderIds(), oldOrder);
    await checkpoint({
      kind: "actual-reorder-edges-exact-owned-fields-reload",
      before: oldOrder,
      after: await orderIds(),
    });
    // Native imported topology: nested environment/folders are retained model fixtures,
    // not claims that the current New environment UI authors arbitrary parents.
    const nestedId = "env_native_nested_" + crypto.randomUUID(),
      outerId = "fld_native_outer_" + crypto.randomUUID(),
      innerId = "fld_native_inner_" + crypto.randomUUID();
    const topology = await load();
    topology.resources.push(
      {
        _id: nestedId,
        _type: "environment",
        parentId: sub._id,
        name: "Imported nested",
        isPrivate: true,
        color: "#654321",
        metaSortKey: 0,
        environmentId: sub._id,
        data: {
          scope: "nested",
          same: "nested",
          nestedOnly: "nested-value",
          literalParentId: sub._id,
        },
        dataPropertyOrder: {
          $: ["scope", "same", "nestedOnly", "literalParentId"],
        },
      },
      {
        _id: outerId,
        _type: "request_group",
        parentId: callerCollection._id,
        name: "Imported outer",
        environment: { same: "outer", outerOnly: "outer-value" },
        metaSortKey: 1,
      },
      {
        _id: innerId,
        _type: "request_group",
        parentId: outerId,
        name: "Imported inner",
        environment: { same: "inner", innerOnly: "inner-value" },
        metaSortKey: 1,
      },
    );
    await invoke("save_workspace", { data: topology });
    await page.reload();
    await resourceSaved(page);
    const beforeNestedCopy = await load();
    await open(sub._id);
    await dialog()
      .getByRole("button", { name: "Duplicate", exact: true })
      .click();
    let nestedCopies = /** @type {any[]} */ ([]);
    await until(async () => {
      nestedCopies = (await load()).resources.filter(
        (/** @type {any} */ r) =>
          !beforeNestedCopy.resources.some(
            (/** @type {any} */ old) => old._id === r._id,
          ),
      );
      return nestedCopies.length === 2;
    }, "Actual nested parent/child duplicate persisted");
    const rootCopy = nestedCopies.find((row) => row.parentId === base._id),
      childCopy = nestedCopies.find((row) => row.parentId === rootCopy?._id);
    assert.ok(rootCopy && childCopy);
    assert.notEqual(childCopy._id, nestedId);
    assert.equal(childCopy.environmentId, rootCopy._id);
    assert.equal(childCopy.metaSortKey, 0);
    assert.equal(childCopy.isPrivate, true);
    assert.equal(childCopy.color, "#654321");
    assert.deepEqual(childCopy.dataPropertyOrder, {
      $: ["scope", "same", "nestedOnly", "literalParentId"],
    });
    assert.deepEqual(
      childCopy.data,
      topology.resources.find((/** @type {any} */ row) => row._id === nestedId)
        .data,
    );
    assert.equal(
      childCopy.data.literalParentId,
      sub._id,
      "Literal data IDs never remapped",
    );
    assert.deepEqual(rootCopy.data, subData);
    assert.equal(rootCopy.isPrivate, true);
    assert.deepEqual(rootCopy.dataPropertyOrder, appearance.dataPropertyOrder);
    await close();
    const afterNestedCopy = await load();
    for (const row of beforeNestedCopy.resources)
      assert.deepEqual(
        afterNestedCopy.resources.find(
          (/** @type {any} */ r) => r._id === row._id,
        ),
        row,
      );
    assert.deepEqual(afterNestedCopy.history, beforeNestedCopy.history);
    await page.reload();
    await resourceSaved(page);
    await open(rootCopy._id);
    await dialog()
      .getByRole("button", { name: "Delete…", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Delete environment?", exact: true })
      .getByRole("button", { name: "Delete environment", exact: true })
      .click();
    await until(
      async () =>
        !(await load()).resources.some((/** @type {any} */ r) =>
          nestedCopies.some((copy) => copy._id === r._id),
        ),
      "Actual duplicate subtree delete persisted",
    );
    await page.reload();
    await resourceSaved(page);
    assert.deepEqual((await load()).resources, beforeNestedCopy.resources);
    assert.deepEqual((await load()).history, beforeNestedCopy.history);
    await checkpoint({
      kind: "nested-duplicate-fresh-parent-reference-private-order-literal-source-immutable-delete",
      root: rootCopy._id,
      child: childCopy._id,
    });
    await page
      .getByRole("button", { name: "Manage Imported outer", exact: true })
      .click();
    const folderDialog = page.getByRole("dialog");
    const folderText = folderDialog.getByRole("textbox", {
      name: "Folder variables (JSON)",
      exact: true,
    });
    const folderJSON =
      '{"same":"outer","outerOnly":"outer-value","12":"twelve","2":"two","nested":{"9":"nine","2":"two"}}';
    await folderText.fill(folderJSON);
    await folderDialog
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await folderDialog.waitFor({ state: "detached" });
    await until(
      async () =>
        !!(await load()).resources.find(
          (/** @type {any} */ row) => row._id === outerId,
        )?.environmentPropertyOrder,
      "Folder property order saved",
    );
    await page.reload();
    await resourceSaved(page);
    const folder = (await load()).resources.find(
      (/** @type {any} */ row) => row._id === outerId,
    );
    assert.deepEqual(folder.environment, JSON.parse(folderJSON));
    assert.deepEqual(folder.environmentPropertyOrder, {
      $: ["same", "outerOnly", "12", "2", "nested"],
      "$~|nested": ["9", "2"],
    });
    await page
      .getByRole("button", { name: "Manage Imported outer", exact: true })
      .click();
    const renderedFolder = await page
      .getByRole("dialog")
      .getByRole("textbox", { name: "Folder variables (JSON)", exact: true })
      .inputValue();
    assert.ok(renderedFolder.indexOf('"12"') < renderedFolder.indexOf('"2"'));
    assert.ok(
      renderedFolder.indexOf('"9"') < renderedFolder.lastIndexOf('"2"'),
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await checkpoint({
      kind: "actual-folder-editor-property-order-reload",
      id: outerId,
      propertyOrder: folder.environmentPropertyOrder,
    });
    for (const [token, text] of [
      ["env-bare-null-refusal", "{{ _.nil }}"],
      ["env-missing-refusal", "{{ _.missingOwnedVariable }}"],
    ]) {
      const current = await load();
      const row = current.resources.find(
        (/** @type {any} */ item) => item._id === request._id,
      );
      Object.assign(row, {
        parentId: callerCollection._id,
        url: fixture.target(token),
        headers: [],
        body: { mimeType: "text/plain", text },
      });
      current.activeWorkspaceId = callerCollection._id;
      current.activeRequestId = request._id;
      await invoke("save_workspace", { data: current });
      await page.reload();
      await resourceSaved(page);
      await choose("");
      const before = await load(),
        count = fixture.records.length;
      const savedBase = before.resources.find(
        (/** @type {any} */ item) => item._id === base._id,
      );
      assert.equal(savedBase.data.nil, null);
      assert.equal(savedBase.data.falseValue, false);
      assert.equal(savedBase.data.zero, 0);
      await page.getByRole("button", { name: "Send", exact: true }).click();
      const feedback = page
        .locator(".error-state")
        .filter({ hasText: "attempted to output null or undefined" });
      await feedback.waitFor();
      await until(
        async () =>
          (await page
            .getByRole("button", { name: "Send", exact: true })
            .count()) === 1,
        "Strict template preflight refusal settles",
      );
      assert.equal(
        fixture.records.length,
        count,
        "Strict null/missing refusal performs no native wire",
      );
      const after = await load();
      assert.deepEqual(after.history, before.history);
      assert.deepEqual(after.resources, before.resources);
      await checkpoint({
        kind: "strict-template-preflight-no-wire-no-history",
        token,
        text,
        error: await feedback.innerText(),
      });
    }
    const wire = async (
      /** @type {string} */ token,
      /** @type {string} */ envId,
      /** @type {string} */ parentId,
      /** @type {string} */ expectedScope,
      /** @type {string} */ expectedSame,
    ) => {
      const current = await load(),
        row = current.resources.find(
          (/** @type {any} */ r) => r._id === request._id,
        );
      const url = fixture.target(token);
      Object.assign(row, {
        parentId,
        url: url + "?scope={{ _.scope }}",
        headers: [{ name: "X-Environment", value: "{{ _.same }}" }],
        body: {
          mimeType: "text/plain",
          text: "{{ _.same }}|{{ _.baseOnly }}|{{ _.falseValue }}|{{ _.zero }}|{{ _.nil | default('', true) }}|{{ _.empty }}|{{ _.recursive }}",
        },
      });
      current.activeWorkspaceId = callerCollection._id;
      current.activeRequestId = request._id;
      await invoke("save_workspace", { data: current });
      await page.reload();
      await resourceSaved(page);
      await choose(envId);
      const before = await load(),
        count = fixture.records.length;
      const savedBase = before.resources.find(
        (/** @type {any} */ item) => item._id === base._id,
      );
      assert.equal(savedBase.data.nil, null);
      assert.equal(savedBase.data.falseValue, false);
      assert.equal(savedBase.data.zero, 0);
      await page.getByRole("button", { name: "Send", exact: true }).click();
      let response = /** @type {any} */ (null);
      await until(async () => {
        response = (await load()).history.find(
          (/** @type {any} */ h) =>
            h.requestId === request._id &&
            !before.history.some((/** @type {any} */ old) => old._id === h._id),
        );
        return (
          !!response &&
          (await page
            .getByRole("button", { name: "Send", exact: true })
            .count()) === 1
        );
      }, "Real rendered environment response persisted");
      assert.equal(fixture.records.length, count + 1);
      const record = fixture.records[count];
      assert.equal(
        new URL(record.path, "http://owned").searchParams.get("scope"),
        expectedScope,
      );
      assert.equal(record.headers["x-environment"], expectedSame);
      assert.equal(
        Buffer.from(record.bodyBase64, "base64").toString(),
        expectedSame + "|base-value|false|0|||base-value",
      );
      assert.equal(response.status, 200);
      assert.equal(response.environmentId, envId || null);
      assert.equal(response.body, manualReply(token).toString());
      await page.reload();
      await resourceSaved(page);
      assert.ok(
        (await load()).history.some(
          (/** @type {any} */ h) => h._id === response._id,
        ),
      );
      await checkpoint({
        kind: "real-inheritance",
        token,
        environmentId: envId,
        parentId,
        historyId: response._id,
        wire: record,
      });
      await progress();
      return response;
    };
    const baseResponse = await wire(
      "env-base",
      "",
      callerCollection._id,
      "base",
      "base",
    );
    await wire("env-sub", sub._id, callerCollection._id, "sub", "sub");
    await wire(
      "env-nested",
      nestedId,
      callerCollection._id,
      "nested",
      "nested",
    );
    await wire("env-outer", nestedId, outerId, "nested", "outer");
    await wire("env-inner", nestedId, innerId, "nested", "inner");
    await choose(sub._id);
    await chooseCollection(targetCollection._id);
    assert.equal((await load()).activeEnvironmentId, "");
    await chooseCollection(callerCollection._id);
    assert.equal((await load()).activeEnvironmentId, sub._id);
    await page.reload();
    assert.equal((await load()).activeEnvironmentId, sub._id);
    await choose("");
    await chooseCollection(targetCollection._id);
    await chooseCollection(callerCollection._id);
    assert.equal((await load()).activeEnvironmentId, "");
    await checkpoint({ kind: "collection-remembered-sub-base-reload" });
    await exerciseNativeEnvironmentDependencies(context, fixture, {
      callerCollectionId: callerCollection._id,
      targetCollectionId: targetCollection._id,
      load,
      checks,
      progress,
    });
    await chooseCollection(callerCollection._id);
    // Restore the primary owned request tab before testing selected deletion.
    await page
      .locator("button.tree-request")
      .filter({ has: page.getByText(request.name, { exact: true }) })
      .click();
    await resourceSaved(page);
    await choose(nestedId);
    await page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("button", { name: "Preferences", exact: true })
      .click();
    const prefs = page.getByRole("region", {
      name: "Preferences",
      exact: true,
    });
    await prefs.getByRole("tab", { name: "Requests", exact: true }).click();
    await prefs
      .getByRole("checkbox", {
        name: "Filter response history by environment",
        exact: true,
      })
      .check();
    await until(
      async () => (await load()).settings.filterResponsesByEnv === true,
      "Actual environment response filter persisted",
    );
    await prefs
      .getByRole("button", { name: "Close Preferences", exact: true })
      .click();
    await page.reload();
    await resourceSaved(page);
    const beforeDelete = await load();
    await open(sub._id);
    await dialog()
      .getByRole("button", { name: "Delete…", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Delete environment?", exact: true })
      .getByRole("button", { name: "Delete environment", exact: true })
      .click();
    await until(async () => {
      const state = await load();
      return (
        !state.resources.some((/** @type {any} */ r) =>
          [sub._id, nestedId].includes(r._id),
        ) && state.activeEnvironmentId === ""
      );
    }, "Selected subtree delete falls back to Base");
    const afterDelete = await load();
    assert.ok(
      afterDelete.resources
        .filter((/** @type {any} */ r) => r._type === "workspace_meta")
        .every(
          (/** @type {any} */ r) =>
            ![sub._id, nestedId].includes(r.activeEnvironmentId),
        ),
    );
    assert.deepEqual(afterDelete.history, beforeDelete.history);
    assert.equal(
      await page
        .getByRole("combobox", { name: "Active environment", exact: true })
        .inputValue(),
      "",
    );
    await until(
      async () =>
        (await page
          .locator(".response-pane .CodeMirror")
          .first()
          .evaluate((el) => /** @type {any} */ (el).CodeMirror.getValue())) ===
        baseResponse.body,
      "Base current response restored after selected deletion",
    );
    const menu = page.getByRole("button", {
      name: "Response history",
      exact: true,
    });
    await menu.click();
    const optionsList = page.getByRole("listbox", {
      name: "Response history",
      exact: true,
    });
    assert.equal(await optionsList.getByRole("option").count(), 1);
    await page.keyboard.press("Escape");
    await page.reload();
    await resourceSaved(page);
    assert.equal((await load()).activeEnvironmentId, "");
    await checkpoint({
      kind: "selected-delete-descendants-metadata-base-response-filter-reload",
      removed: [sub._id, nestedId],
      baseResponseId: baseResponse._id,
    });
    for (const row of original.resources)
      assert.deepEqual(
        (await load()).resources.find(
          (/** @type {any} */ r) => r._id === row._id,
        ),
        row,
      );
    assert.deepEqual(errors, []);
    await Bun.write(
      output + "/environment-native-acceptance.json",
      JSON.stringify(
        {
          passed: true,
          native: true,
          renderingMode: "native-hidden",
          checks,
          nameProfiles: 6,
          jsonRefusals: 12,
          CSSViewportOnly: true,
          nestedFolderAuthoring:
            "imported owned topology; actual select/edit/render/send",
          callbackDrainRefusal: false,
        },
        null,
        2,
      ),
    );
  } finally {
    if (viewport) await page.setViewportSize(viewport);
    await page.evaluate((values) => {
      for (const [key, value] of Object.entries(values))
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
    }, layout);
    assert.deepEqual(
      await page.evaluate(
        (keys) =>
          Object.fromEntries(
            keys.map((key) => [key, localStorage.getItem(key)]),
          ),
        layoutKeys,
      ),
      layout,
    );
  }
}
