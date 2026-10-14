import assert from "node:assert/strict";
import { newRequest } from "../../../src/lib/model.js";
import { poll } from "./native-app.js";
import { manualReply, manualMultipartParts } from "./http-manual-fixture.js";
import { exerciseManualHttpHistoryCases } from "./http-manual-history-cases.js";

const modes = [
  {
    name: "json",
    mime: "application/json",
    text: '{"exact":9007199254740993,"unicode":"β😀","zero":0}\n',
  },
  { name: "text", mime: "text/plain", text: "manual β 😀\nsecond line\n" },
  {
    name: "xml",
    mime: "application/xml",
    text: '<?xml version="1.0"?><r>β 😀 &amp; x</r>\n',
  },
  {
    name: "form",
    mime: "application/x-www-form-urlencoded",
    text: "dup=alpha&dup=%CE%B2+%F0%9F%98%80+%2B&empty=",
  },
  { name: "multipart", mime: "multipart/form-data", text: "" },
  { name: "binary", mime: "application/octet-stream", text: "" },
];
const uploadBytes = Buffer.from([0, 255, 13, 10, 0, 65, 206, 178]);
const layoutKeys = [
  "nocturne:split:workspace-left",
  "nocturne:split:request-response",
  "nocturne:split:design",
  "insomnium:split:workspace-left",
  "insomnium:split:request-response",
];

/** Actual manual editor/native wire/history acceptance, separate from seeded history cases.
 * @param {import('./native-app.js').ScenarioContext} context
 * @param {Awaited<ReturnType<import('./http-manual-fixture.js').createManualHttpFixture>>} fixture
 * @param {string} collectionId @param {Record<string,any>} original */
export async function exerciseManualHttpWorkflow(
  context,
  fixture,
  collectionId,
  original,
) {
  const { page, invoke, output } = context;
  assert.equal(
    original.history.length,
    0,
    "Low-limit workflow requires the reviewed isolated original-zero-history profile",
  );
  const rows = /** @type {Record<string,any>[]} */ ([]);
  const controls = /** @type {Record<string,any>[]} */ ([]);
  const load = () => invoke("load_workspace");
  const bodyEditor = () =>
    page.getByRole("region", { name: "Body editor", exact: true });
  const bodyInput = () =>
    bodyEditor().getByRole("textbox", { name: "Request body", exact: true });
  const originalViewport = page.viewportSize();
  const originalTheme = await page.locator("html").getAttribute("data-theme");
  const originalSettingTheme = (await load()).settings.theme;
  /** @param {string} theme */
  const setTheme = async (theme) => {
    if ((await page.locator("html").getAttribute("data-theme")) !== theme)
      await page
        .getByRole("button", { name: "Toggle theme", exact: true })
        .click();
    await poll(
      async () =>
        (await load()).settings.theme === theme &&
        (await page.locator("html").getAttribute("data-theme")) === theme,
      "Durable manual workflow theme",
      60000,
    );
  };
  const originalLayout = await page.evaluate(
    (keys) =>
      Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])),
    layoutKeys,
  );
  /** @param {string} id */
  const requestData = async (id) => {
    const current = (await load()).resources.find(
      (/** @type {any} */ row) => row._id === id,
    );
    assert.ok(current);
    return current;
  };
  /** @param {string} id */
  const select = async (id) => {
    const request = await requestData(id);
    await page
      .locator("button.tree-request")
      .filter({ has: page.getByText(request.name, { exact: true }) })
      .click();
    await poll(
      async () => (await load()).activeRequestId === id,
      "Durable manual request selection",
      60000,
    );
    await page
      .getByRole("tablist", { name: "Request editor", exact: true })
      .getByRole("tab", { name: "Body", exact: true })
      .click();
  };
  /** @param {string} name @param {string} url */
  const add = async (name, url) => {
    const data = await load();
    const request = newRequest(collectionId, {
      name: "Manual " + name + " " + crypto.randomUUID(),
      method: "POST",
      url,
    });
    data.resources.push(request);
    data.activeWorkspaceId = collectionId;
    data.activeRequestId = request._id;
    data.openTabs.push(request._id);
    await invoke("save_workspace", { data });
    await page.reload();
    await select(request._id);
    return request._id;
  };
  /** @param {string} id @param {string} url */
  const setURL = async (id, url) => {
    await page
      .getByRole("textbox", { name: "Request URL", exact: true })
      .fill(url);
    await poll(
      async () => (await requestData(id)).url === url,
      "Manual URL persisted",
      60000,
    );
  };
  /** @param {string} id @param {string} text */
  const editText = async (id, text) => {
    await bodyInput().focus();
    await page.keyboard.press("Control+A");
    await page.keyboard.insertText(text);
    await poll(
      async () => (await requestData(id)).body.text === text,
      "Actual CodeMirror edit persisted",
      60000,
    );
    assert.equal(
      await bodyEditor()
        .locator(".CodeMirror")
        .evaluate((el) => /** @type {any} */ (el).CodeMirror.getValue()),
      text,
    );
  };
  /** @param {string} id @param {typeof modes[number]} mode */
  const configure = async (id, mode) => {
    await bodyEditor()
      .getByRole("combobox", { name: "Body type", exact: true })
      .selectOption(mode.mime);
    await poll(
      async () => (await requestData(id)).body.mimeType === mode.mime,
      "Manual MIME persisted",
      60000,
    );
    if (["json", "text", "xml"].includes(mode.name))
      await editText(id, mode.text);
    else if (mode.name === "binary") {
      await bodyEditor()
        .locator('.binary-picker input[type="file"]')
        .setInputFiles({
          name: "manual.bin",
          mimeType: "application/x-wrong-browser-type",
          buffer: uploadBytes,
        });
      await poll(
        async () =>
          (await requestData(id)).body.base64 ===
          uploadBytes.toString("base64"),
        "Manual binary persisted",
        60000,
      );
    } else {
      const definitions = [
        { name: "dup", value: "alpha" },
        { name: "dup", value: "β 😀 +" },
        { name: "empty", value: "" },
        { name: "disabled", value: "must-not-send", disabled: true },
      ];
      for (let index = 0; index < definitions.length; index++) {
        const definition = definitions[index];
        await bodyEditor()
          .getByRole("button", { name: "Add parameter", exact: true })
          .click();
        await bodyEditor()
          .getByRole("textbox", {
            name: "Parameter " + (index + 1),
            exact: true,
          })
          .fill(definition.name);
        await bodyEditor()
          .getByRole("textbox", { name: "Value " + (index + 1), exact: true })
          .fill(definition.value);
        if (definition.disabled)
          await bodyEditor()
            .getByRole("checkbox", { name: "Enable disabled", exact: true })
            .uncheck();
      }
      if (mode.name === "multipart") {
        await bodyEditor()
          .getByRole("button", { name: "Add parameter", exact: true })
          .click();
        await bodyEditor()
          .getByRole("textbox", { name: "Parameter 5", exact: true })
          .fill("upload");
        const row = bodyEditor().locator(".kv-row").nth(4);
        await row
          .getByRole("combobox", { name: "Field type", exact: true })
          .selectOption("file");
        await row
          .locator('input[type="file"]')
          .setInputFiles({
            name: "manual.bin",
            mimeType: "application/octet-stream",
            buffer: uploadBytes,
          });
        const options = bodyEditor().locator(".multipart-options").last();
        await options.locator("summary").click();
        await options
          .getByRole("checkbox", {
            name: "Override sent filename",
            exact: true,
          })
          .check();
        await options
          .getByRole("textbox", {
            name: "Sent filename for upload",
            exact: true,
          })
          .fill("sent.bin");
        await options
          .getByRole("textbox", {
            name: "Content-Type for upload",
            exact: true,
          })
          .fill("application/x-owned-file");
      }
      await poll(
        async () => {
          const params = (await requestData(id)).body.params;
          return (
            params.length === (mode.name === "multipart" ? 5 : 4) &&
            params[3].disabled &&
            (mode.name !== "multipart" ||
              (params[4].base64 === uploadBytes.toString("base64") &&
                params[4].fileNameOverride === "sent.bin" &&
                params[4].contentTypeOverride === "application/x-owned-file"))
          );
        },
        "Actual manual form rows persisted",
        60000,
      );
    }
  };
  /** @param {string} id */
  const reloadBody = async (id) => {
    const before = await requestData(id),
      count = fixture.records.length;
    assert.equal(before.sourceSpecId, undefined);
    assert.equal(before.body._openapiSerialization, undefined);
    await page.reload();
    await select(id);
    assert.deepEqual(await requestData(id), before);
    assert.equal(fixture.records.length, count, "Editor reload never sends");
    return before;
  };
  /** @param {string} id @param {Set<string>} previous */
  const freshHistory = async (id, previous) => {
    let entry = /** @type {Record<string,any>|undefined} */ (undefined);
    await poll(
      async () => {
        entry = (await load()).history.find(
          (/** @type {any} */ row) =>
            row.requestId === id && !previous.has(row._id),
        );
        return (
          !!entry &&
          (await page
            .getByRole("button", { name: "Send", exact: true })
            .count()) === 1
        );
      },
      "Fresh durable native HTTP history and completion",
      60000,
    );
    assert.ok(entry);
    return entry;
  };
  /** @param {string} id @param {string} token @param {number} [status] */
  const send = async (id, token, status = 200) => {
    await page
      .getByRole("tablist", { name: "Response view", exact: true })
      .getByRole("tab", { name: "Preview", exact: true })
      .click();
    const before = await load(),
      count = fixture.records.length;
    const expected = before.resources.find(
      (/** @type {any} */ row) => row._id === id,
    );
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const entry = await freshHistory(
      id,
      new Set(before.history.map((/** @type {any} */ row) => row._id)),
    );
    assert.equal(fixture.records.length, count + 1);
    const wire = fixture.records[count];
    assert.equal(wire.token, token);
    assert.equal(wire.method, "POST");
    assert.ok(wire.bodyReadAt);
    assert.equal(entry.status, status);
    assert.equal(entry.url, expected.url);
    assert.equal(entry.method, "POST");
    assert.equal(entry.environmentId, before.activeEnvironmentId || null);
    assert.equal(entry.body, manualReply(token, status).toString("utf8"));
    assert.equal(
      entry.bodyBase64,
      manualReply(token, status).toString("base64"),
    );
    assert.equal(entry.size, manualReply(token, status).length);
    assert.ok(
      Number.isFinite(entry.headersMs) &&
        Number.isFinite(entry.elapsedMs) &&
        entry.headersMs >= 0 &&
        entry.headersMs <= entry.elapsedMs,
    );
    assert.equal(
      entry.headers.find(
        (/** @type {string[]} */ row) =>
          row[0].toLowerCase() === "x-owned-token",
      )?.[1],
      token,
    );
    assert.equal(
      entry.headers.find(
        (/** @type {string[]} */ row) =>
          row[0].toLowerCase() === "content-type",
      )?.[1],
      "text/plain; charset=utf-8",
    );
    assert.equal(
      await page
        .locator(".response-pane .CodeMirror")
        .first()
        .evaluate((el) => /** @type {any} */ (el).CodeMirror.getValue()),
      entry.body,
    );
    assert.deepEqual(
      (await load()).resources,
      before.resources,
      "Send does not rewrite submitted body/resources",
    );
    await page.reload();
    await select(id);
    assert.ok(
      (await load()).history.some(
        (/** @type {any} */ row) =>
          row._id === entry._id && row.bodyBase64 === entry.bodyBase64,
      ),
    );
    assert.equal(fixture.records.length, count + 1);
    return { wire, entry };
  };
  /** @param {Record<string,any>} wire @param {typeof modes[number]} mode */
  const assertBody = (wire, mode) => {
    const bytes = Buffer.from(wire.bodyBase64, "base64");
    if (mode.name === "multipart") {
      assert.match(
        String(wire.headers["content-type"]),
        /^multipart\/form-data; boundary=/,
      );
      const parts = manualMultipartParts(
        bytes,
        String(wire.headers["content-type"]),
      );
      assert.equal(parts.length, 4);
      const names = ["dup", "dup", "empty", "upload"];
      const values = [
        Buffer.from("alpha"),
        Buffer.from("β 😀 +"),
        Buffer.alloc(0),
        uploadBytes,
      ];
      for (let i = 0; i < parts.length; i++) {
        assert.ok(parts[i].headers.includes('name="' + names[i] + '"'));
        assert.deepEqual(parts[i].body, values[i]);
      }
      assert.match(parts[3].headers, /filename="sent\.bin"/);
      assert.match(
        parts[3].headers,
        /content-type: application\/x-owned-file/i,
      );
      assert.ok(!bytes.includes(Buffer.from("must-not-send")));
    } else {
      assert.equal(wire.headers["content-type"], mode.mime);
      assert.deepEqual(
        bytes,
        mode.name === "binary" ? uploadBytes : Buffer.from(mode.text, "utf8"),
      );
    }
  };
  /** @param {Record<string,number|boolean>} patch */
  const settings = async (patch) => {
    await page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("button", { name: "Preferences", exact: true })
      .click();
    const pane = page.getByRole("region", { name: "Preferences", exact: true });
    await pane.getByRole("tab", { name: "Requests", exact: true }).click();
    for (const [key, value] of Object.entries(patch)) {
      if (key === "filterResponsesByEnv")
        await pane
          .getByRole("checkbox", {
            name: "Filter response history by environment",
            exact: true,
          })
          .setChecked(Boolean(value));
      else {
        const label =
          key === "maxHistory"
            ? "Response history limit"
            : "Request timeout (ms)";
        await pane
          .getByRole("spinbutton", { name: label, exact: true })
          .fill(String(value));
        await pane
          .getByRole("spinbutton", { name: label, exact: true })
          .press("Tab");
      }
    }
    await poll(
      async () => {
        const current = (await load()).settings;
        return Object.entries(patch).every(
          ([key, value]) => current[key] === value,
        );
      },
      "Requests settings persisted",
      60000,
    );
    await pane
      .getByRole("button", { name: "Close Preferences", exact: true })
      .click();
    await page.reload();
    const afterReload = await load();
    for (const [key, value] of Object.entries(patch))
      assert.equal(afterReload.settings[key], value);
  };
  const progress = async () =>
    Bun.write(
      output + "/manual-http-progress.json",
      JSON.stringify({ rows, controls, wires: fixture.records }, null, 2),
    );
  try {
    for (const theme of ["dark", "light"])
      for (const width of [1440, 900, 760])
        for (const mode of modes) {
          await page.setViewportSize({ width, height: 960 });
          await setTheme(theme);
          const token = `${theme}-${width}-${mode.name}`;
          const id = await add(token, fixture.target(token));
          assert.equal(
            await page.locator("html").getAttribute("data-theme"),
            theme,
          );
          await configure(id, mode);
          const submitted = await reloadBody(id);
          assert.equal(
            await page.locator("html").getAttribute("data-theme"),
            theme,
          );
          const { wire, entry } = await send(id, token);
          assert.equal(
            await page.locator("html").getAttribute("data-theme"),
            theme,
          );
          assertBody(wire, mode);
          assert.deepEqual((await requestData(id)).body, submitted.body);
          rows.push({
            theme,
            width,
            mode: mode.name,
            requestId: id,
            historyId: entry._id,
            bodyBytes: wire.bodyBytes,
            wireSHA256: wire.bodySHA256,
            manualEditor: true,
            durableReload: true,
            nativeSend: true,
            statusBodyHeadersTiming: true,
          });
          await progress();
        }
    assert.equal(rows.length, 36);
    // Controls are appended after every body/profile has passed, never used as a substitute.
    await exerciseBodyRefusals();
    await exerciseManualHttpHistoryCases(context, fixture, {
      collectionId,
      original,
      modes,
      uploadBytes,
      load,
      requestData,
      select,
      add,
      setURL,
      editText,
      configure,
      reloadBody,
      freshHistory,
      send,
      settings,
      controls,
      progress,
    });
    for (const resource of original.resources)
      assert.deepEqual(
        (await load()).resources.find(
          (/** @type {any} */ row) => row._id === resource._id,
        ),
        resource,
      );
    assert.equal(original.history.length, 0);
    const result = {
      passed: true,
      rows,
      controls,
      bodyProfiles: 36,
      bodyModes: 6,
      CSSViewportOnly: true,
      originalResourcesPreserved: true,
      physicalOSPicker: false,
      controlledLateIPC: false,
    };
    await Bun.write(
      output + "/manual-http-acceptance.json",
      JSON.stringify(result, null, 2),
    );
    return result;
  } finally {
    if (["dark", "light"].includes(originalSettingTheme))
      await setTheme(originalSettingTheme);
    if (originalViewport) await page.setViewportSize(originalViewport);
    await page
      .locator("html")
      .evaluate(
        (el, theme) =>
          theme === null
            ? el.removeAttribute("data-theme")
            : el.setAttribute("data-theme", theme),
        originalTheme,
      );
    await page.evaluate((values) => {
      for (const [key, value] of Object.entries(values))
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
    }, originalLayout);
    assert.deepEqual(
      await page.evaluate(
        (keys) =>
          Object.fromEntries(
            keys.map((key) => [key, localStorage.getItem(key)]),
          ),
        layoutKeys,
      ),
      originalLayout,
    );
  }

  async function exerciseBodyRefusals() {
    for (const mode of [modes[4], modes[5]]) {
      const token = "missing-" + mode.name;
      const id = await add(token, fixture.target(token));
      await bodyEditor()
        .getByRole("combobox", { name: "Body type", exact: true })
        .selectOption(mode.mime);
      if (mode.name === "multipart") {
        await bodyEditor()
          .getByRole("button", { name: "Add parameter", exact: true })
          .click();
        await bodyEditor()
          .getByRole("textbox", { name: "Parameter 1", exact: true })
          .fill("upload");
        await bodyEditor()
          .getByRole("combobox", { name: "Field type", exact: true })
          .selectOption("file");
      }
      await poll(
        async () => {
          const body = (await requestData(id)).body;
          return (
            body.mimeType === mode.mime &&
            (mode.name === "binary" || body.params[0]?.type === "file")
          );
        },
        "Manual missing-file state saved",
        60000,
      );
      const before = await load(),
        count = fixture.records.length;
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await page
        .locator(".error-state")
        .filter({ hasText: /Select.*file/i })
        .waitFor();
      assert.equal(fixture.records.length, count);
      assert.deepEqual((await load()).history, before.history);
      assert.deepEqual((await load()).resources, before.resources);
      controls.push({
        kind: "missing-file-preflight",
        mode: mode.name,
        requestId: id,
        noWire: true,
        noHistory: true,
      });
    }
    for (const mode of [modes[4], modes[5]]) {
      const token = "upload-limit-" + mode.name,
        id = await add(token, fixture.target(token));
      await configure(id, mode);
      const before = await load(),
        originalBody = (await requestData(id)).body;
      const picker =
        mode.name === "binary"
          ? bodyEditor().locator('.binary-picker input[type="file"]')
          : bodyEditor()
              .locator(".kv-row")
              .nth(4)
              .locator('input[type="file"]');
      await picker.setInputFiles({
        name: "over-limit.bin",
        mimeType: "application/octet-stream",
        buffer: Buffer.alloc(20 * 1024 * 1024 + 1),
      });
      await bodyEditor()
        .getByRole("alert")
        .filter({ hasText: "20 MiB" })
        .waitFor();
      assert.deepEqual((await requestData(id)).body, originalBody);
      assert.deepEqual((await load()).history, before.history);
      assert.ok(!fixture.records.some((row) => row.token === token));
      assert.equal(await picker.inputValue(), "");
      controls.push({
        kind: "upload-limit",
        mode: mode.name,
        requestId: id,
        actualBytes: 20 * 1024 * 1024 + 1,
        noPartialPayload: true,
        validOriginalFileRetained: true,
        noWire: true,
      });
    }
    await progress();
  }
}
