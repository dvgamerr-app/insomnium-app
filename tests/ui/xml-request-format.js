import assert from "node:assert/strict";
import {
  installXmlWorkerControl,
  emitXmlWorker,
  xmlWorkerRecords,
} from "./helpers/xml-worker-control.js";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { initialData, newRequest } from "../../src/lib/model.js";
import { startCpuProfile } from "./helpers/cpu-profile.js";
import {
  encodeGitResource,
  decodeGitResource,
} from "../../src/lib/git-resources.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
const source = '<root><item id="owned">value</item><empty/></root>';
const formatted =
  '<root>\n  <item id="owned">value</item>\n  <empty/>\n</root>';
const caseSet = process.env.INSOMNIUM_XML_CASE_SET || "all";
assert.ok(["all", "cancellation", "workspace"].includes(caseSet));
const cancellationOnly = caseSet !== "all";
const profileWorkspace = process.env.INSOMNIUM_XML_PROFILE === "1";
assert.ok(!profileWorkspace || caseSet === "workspace");
const workspaceBudgetMs = process.env.INSOMNIUM_XML_WORKSPACE_BUDGET_MS
  ? Number(process.env.INSOMNIUM_XML_WORKSPACE_BUDGET_MS)
  : null;
assert.ok(
  workspaceBudgetMs === null ||
    (Number.isFinite(workspaceBudgetMs) && workspaceBudgetMs > 0),
);

await withNativeApp("xml-request-format", async ({ page, invoke, output }) => {
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);
  const suffix = Date.now().toString();
  const workspaceId = "wrk_xml_" + suffix;
  const requestId = "req_xml_" + suffix;
  const checks = /** @type {Record<string, any>[]} */ ([]);
  const workers = /** @type {string[]} */ ([]);
  page.on("worker", (worker) => {
    if (worker.url().includes("xml-format.worker")) workers.push(worker.url());
  });
  const initial = (await invoke("load_workspace")) || initialData();
  const resourceStats = {
    count: initial.resources.length,
    historyCount: initial.history.length,
    jsonBytes: Buffer.byteLength(JSON.stringify(initial)),
    byType: /** @type {Record<string,number>} */ ({}),
  };
  for (const resource of initial.resources)
    resourceStats.byType[resource._type] =
      (resourceStats.byType[resource._type] || 0) + 1;
  const previousWorkspaceId = initial.activeWorkspaceId;
  const otherRequestId = requestId + "_other";
  let otherOriginal = /** @type {Record<string,any>|undefined} */ (undefined);
  let lastPersisted = /** @type {any} */ (undefined);
  initial.resources.push({
    _id: workspaceId,
    _type: "workspace",
    parentId: null,
    name: "XML format " + suffix,
    scope: "collection",
  });
  await invoke("save_workspace", { data: initial });
  const editor = page.locator(".CodeMirror").first();
  const value = () =>
    editor.evaluate((el) => /** @type {any} */ (el).CodeMirror.getValue());
  /** @param {string} mime @param {string} text */
  async function seed(mime, text) {
    const data = await invoke("load_workspace");
    data.resources = data.resources.filter(
      (/** @type {any} */ r) => r._id !== requestId && r._id !== otherRequestId,
    );
    const request = newRequest(workspaceId, {
      _id: requestId,
      name: "Owned XML formatter",
      method: "POST",
      url: "https://xml-format.example.invalid/owned",
      body: { mimeType: mime, text, params: [], extra: { retained: 42 } },
    });
    data.resources.push(request);
    otherOriginal = newRequest(workspaceId, {
      _id: otherRequestId,
      name: "XML other request",
      body: { mimeType: "application/xml", text: "<other/>", params: [] },
    });
    data.resources.push(otherOriginal);
    data.activeWorkspaceId = workspaceId;
    data.activeRequestId = requestId;
    data.activeEnvironmentId = "";
    data.openTabs = [requestId];
    await invoke("save_workspace", { data });
    await page.reload();
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: "Collections", exact: true })
      .click();
    await page
      .getByRole("tablist", { name: "Request editor", exact: true })
      .getByRole("tab", { name: "Body", exact: true })
      .click();
    await editor.waitFor();
    await poll(
      async () => (await value()) === text,
      "Seeded XML body mounted",
      60000,
    );
    return request;
  }
  /** @param {string} text */
  async function persisted(text) {
    let request = /** @type {Record<string,any>|undefined} */ (undefined);
    await poll(
      async () => {
        const data = await invoke("load_workspace");
        lastPersisted = data;
        request = data.resources.find(
          (/** @type {any} */ r) => r._id === requestId,
        );
        return request?.body?.text === text;
      },
      "XML body persisted exactly",
      60000,
    );
    assert.ok(request);
    return request;
  }
  for (const mime of [
    "application/xml",
    "text/xml",
    "application/vnd.owned+xml; charset=utf-8",
  ].filter(() => !cancellationOnly)) {
    const original = await seed(mime, source);
    const workerCount = workers.length;
    await page.getByRole("button", { name: "Format XML", exact: true }).click();
    await poll(
      async () => (await value()) === formatted,
      "Real XML worker formatted body",
      60000,
    );
    assert.equal(
      workers.length,
      workerCount + 1,
      "Actual bundled XML worker created",
    );
    const saved = await persisted(formatted);
    assert.deepEqual(saved.body, { ...original.body, text: formatted });
    const git = encodeGitResource(saved);
    const restored = decodeGitResource(git.path, git.content);
    assert.deepEqual(restored, { ...saved, type: "Request" });
    await editor.click();
    await page.keyboard.press("Control+z");
    await poll(
      async () => (await value()) === source,
      "XML format is undoable",
      60000,
    );
    await persisted(source);
    await page.keyboard.press("Control+y");
    await poll(
      async () => (await value()) === formatted,
      "XML format is redoable",
      60000,
    );
    await persisted(formatted);
    await page.reload();
    await editor.waitFor();
    await poll(
      async () => (await value()) === formatted,
      "Formatted XML survives reload",
      60000,
    );
    checks.push({
      kind: "real-worker",
      mime,
      original,
      saved,
      git,
      formatted,
      undo: source,
      redo: formatted,
      reloaded: await value(),
    });
    await Bun.write(
      output + "/progress.json",
      JSON.stringify({ checks, workers }, null, 2),
    );
  }
  for (const name of [
    "edit",
    "tab",
    "mime",
    "request",
    "unmount",
    "workspace",
  ].filter((name) => caseSet !== "workspace" || name === "workspace")) {
    const original = await seed("application/xml", source);
    await installXmlWorkerControl(page);
    await page.getByRole("button", { name: "Format XML", exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "Formatting…", exact: true })
        .isDisabled(),
      true,
    );
    const stopProfile = profileWorkspace
      ? await startCpuProfile(page, output)
      : null;
    if (name === "edit") {
      await editor.evaluate((el) =>
        /** @type {any} */ (el).CodeMirror.setValue("<edited/>"),
      );
    } else if (name === "tab") {
      await page
        .getByRole("tablist", { name: "Request editor", exact: true })
        .getByRole("tab", { name: "Auth", exact: true })
        .click();
    } else if (name === "mime") {
      await page
        .getByLabel("Body type", { exact: true })
        .selectOption("text/plain");
    } else if (name === "request") {
      await page
        .locator("button.tree-request")
        .filter({ has: page.getByText("XML other request", { exact: true }) })
        .click();
    } else if (name === "unmount") {
      await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("button", { name: "API Design", exact: true })
        .click();
    } else {
      await page
        .getByLabel("Collection", { exact: true })
        .selectOption(previousWorkspaceId);
    }
    await poll(
      async () => (await xmlWorkerRecords(page))[0]?.terminated,
      "XML worker terminated on " + name,
      60000,
    );
    const cpuProfile = stopProfile ? await stopProfile() : null;
    const records = await xmlWorkerRecords(page);
    assert.equal(records.length, 1);
    assert.equal(records[0].posts.length, 1);
    const elapsedMs = records[0].terminatedAt - records[0].startedAt;
    await Bun.write(
      output + "/cancel-diagnostic-" + name + ".json",
      JSON.stringify({ name, records, elapsedMs }, null, 2),
    );
    assert.ok(Number.isFinite(elapsedMs) && elapsedMs >= 0);
    if (name === "workspace" && workspaceBudgetMs !== null)
      assert.ok(
        elapsedMs < workspaceBudgetMs,
        "Workspace cancellation exceeds explicit responsiveness budget",
      );
    assert.equal(typeof records[0].deadlineTimer, "number");
    assert.equal(
      records[0].deadlineFired,
      false,
      "Cancellation must clear the timer before its callback: " + name,
    );
    assert.equal(typeof records[0].deadlineClearedAt, "number");
    assert.equal(
      await page.getByText(/XML formatting exceeded 3 seconds/).count(),
      0,
      "Cancellation must not be accepted as deadline failure",
    );
    const mountedValues = () =>
      page
        .locator(".request-editor .CodeMirror")
        .evaluateAll((elements) =>
          elements.map((el) => /** @type {any} */ (el).CodeMirror.getValue()),
        );
    const editorBefore = await mountedValues();
    if (name === "request") assert.deepEqual(editorBefore, ["<other/>"]);
    await emitXmlWorker(page, "message", { text: "<stale/>" });
    await emitXmlWorker(page, "message", { error: "Stale XML error" });
    assert.equal(
      await page.getByText("Stale XML error", { exact: true }).count(),
      0,
    );
    const expected = name === "edit" ? "<edited/>" : source;
    const saved = await persisted(expected);
    assert.equal(saved.body.text, expected);
    assert.equal(saved.body.extra.retained, 42);
    const editorAfter = await mountedValues();
    assert.deepEqual(
      editorAfter,
      editorBefore,
      "Late result preserves destination editor",
    );
    const otherSaved = lastPersisted.resources.find(
      (/** @type {any} */ r) => r._id === otherRequestId,
    );
    assert.deepEqual(
      otherSaved,
      otherOriginal,
      "Late result preserves complete other request",
    );
    checks.push({
      kind: "controlled-cancellation",
      cpuProfile,
      name,
      original,
      saved,
      records,
      elapsedMs,
      editorBefore,
      editorAfter,
      otherOriginal,
      otherSaved,
      deadlineAbsent: true,
      lateTextIgnored: true,
      lateErrorIgnored: true,
    });
    await Bun.write(
      output + "/progress.json",
      JSON.stringify({ checks, workers }, null, 2),
    );
  }
  for (const name of [
    "error",
    "messageerror",
    "response-error",
    "timeout",
    "construction",
    "post",
  ].filter(() => !cancellationOnly)) {
    const original = await seed("application/xml", source);
    await installXmlWorkerControl(
      page,
      name === "construction" || name === "post" ? name : "hold",
    );
    await page.getByRole("button", { name: "Format XML", exact: true }).click();
    if (name === "error" || name === "messageerror")
      await emitXmlWorker(page, name);
    if (name === "response-error")
      await emitXmlWorker(page, "message", {
        error: "Owned XML response failure",
      });
    await page.locator(".inline-error").waitFor();
    const error = await page.locator(".inline-error").innerText();
    if (name === "timeout") assert.match(error, /exceeded 3 seconds/);
    assert.equal(await value(), source);
    const saved = await persisted(source);
    assert.deepEqual(saved.body, original.body);
    const records = await xmlWorkerRecords(page);
    if (name !== "construction") assert.equal(records[0].terminated, true);
    if (name === "timeout") assert.equal(records[0].deadlineFired, true);
    await emitXmlWorker(page, "message", { text: "<late-fault/>" });
    assert.equal(await value(), source);
    checks.push({
      kind: "controlled-fault",
      name,
      original,
      saved,
      error,
      records,
    });
    await Bun.write(
      output + "/progress.json",
      JSON.stringify({ checks, workers }, null, 2),
    );
  }
  for (const [name, text] of [
    ["malformed", "<root><item></root>"],
    ["empty", ""],
    ["mixed text", "<root>before<item/>after</root>"],
  ].filter(() => !cancellationOnly)) {
    const original = await seed("application/xml", text);
    await page.getByRole("button", { name: "Format XML", exact: true }).click();
    await page.locator(".inline-error").waitFor();
    assert.equal(await value(), text, "Rejected XML retains original body");
    const saved = await persisted(text);
    assert.deepEqual(saved.body, original.body);
    checks.push({
      kind: "real-refusal",
      name,
      original,
      saved,
      error: await page.locator(".inline-error").innerText(),
    });
    await Bun.write(
      output + "/progress.json",
      JSON.stringify({ checks, workers }, null, 2),
    );
  }
  await page.setViewportSize({ width: 760, height: 960 });
  if (!cancellationOnly)
    await page.screenshot({ path: output + "/xml-error-760.png" });
  await Bun.write(
    output + "/acceptance.json",
    JSON.stringify(
      {
        passed: true,
        caseSet,
        checks,
        workers,
        requestId,
        workspaceId,
        resourceStats,
        workspaceBudgetMs,
        limits:
          "Real bundled XML worker, mounted Undo/Redo/persistence and rejection controls. Lifecycle delays/faults use an explicit Worker adapter; no real hung-worker simulation or request Send, OS-close, other platform or full migration acceptance is claimed.",
      },
      null,
      2,
    ),
  );
});
