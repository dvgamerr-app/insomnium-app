import assert from "node:assert/strict";
import { poll } from "./native-app.js";
import {
  namespaceRows,
  xpathNamespaces,
} from "../../../src/lib/xpath-namespaces.js";
import { withResponseNamespaces } from "../../../src/lib/request-meta.js";
import { filterXmlResponse } from "../../../src/lib/xml-response-filter.js";
import { documents } from "../fixtures/xml-response.js";
import { newRequest } from "../../../src/lib/model.js";
import {
  installResponseWorkerControl,
  responseWorkerRecords,
  emitResponseWorker,
} from "./response-worker-control.js";

/** @param {Record<string,any>} context */
export async function verifyXmlResponseNamespaces(context) {
  const {
    page,
    pane,
    input,
    value,
    reset,
    saved,
    output,
    workers,
    wire,
    invoke,
    requestId,
  } = context;
  const checks = /** @type {Record<string,any>[]} */ ([]);
  const refusals = [
    null,
    [],
    { "": "urn:x" },
    { "a:b": "urn:x" },
    { "1x": "urn:x" },
    { x: "" },
    { x: "urn: x" },
    { xml: "urn:x" },
    { xmlns: "urn:x" },
    { x: "http://www.w3.org/2000/xmlns/" },
    { x: "http://www.w3.org/XML/1998/namespace" },
    { ["x".repeat(129)]: "urn:x" },
    { x: "u".repeat(4097) },
    Object.fromEntries(
      Array.from({ length: 33 }, (_, i) => ["n" + i, "urn:" + i]),
    ),
  ];
  for (const bad of refusals) assert.throws(() => xpathNamespaces(bad));
  assert.throws(
    () =>
      namespaceRows([
        { prefix: "n", uri: "urn:x" },
        { prefix: "n", uri: "urn:y" },
      ]),
    /unique/,
  );
  assert.equal(
    namespaceRows([
      { prefix: " n ", uri: " urn:x " },
      { prefix: "", uri: "" },
    ]).n,
    "urn:x",
  );
  const unusual = xpathNamespaces(
    JSON.parse('{"__proto__":"urn:p","constructor":"urn:c","β":"urn:u"}'),
  );
  assert.equal(Object.getPrototypeOf(unusual), null);
  assert.equal(unusual.__proto__, "urn:p");
  assert.equal(
    filterXmlResponse(
      '<r xmlns="urn:u"><item>β</item></r>',
      "string(//β:item)",
      unusual,
    ),
    "<result>\nβ\n</result>",
  );
  const imported = {
    _id: "reqm_contract",
    _type: "request_meta",
    parentId: "req_contract",
    responseFilter: "//n:item",
    responseFilterHistory: ["//kept"],
    extra: { retained: 42 },
    created: 1,
  };
  const next = withResponseNamespaces(imported, "req_contract", {
    n: "urn:one",
  });
  assert.deepEqual(next.responseFilterHistory, imported.responseFilterHistory);
  assert.equal(next.responseFilter, imported.responseFilter);
  assert.deepEqual(next.extra, imported.extra);
  assert.equal(next._id, imported._id);
  assert.equal(next.created, 1);
  checks.push({
    kind: "validation",
    refusals: refusals.length + 1,
    unusual: JSON.parse(JSON.stringify(unusual)),
    metadata: next,
  });

  await reset("/mapped");
  const original = (await saved()).response;
  const open = async () => {
    await pane.getByRole("button", { name: "Namespaces", exact: true }).click();
    const dialog = page.getByRole("dialog", {
      name: "XPath namespaces",
      exact: true,
    });
    await dialog.waitFor();
    return dialog;
  };
  const setRows = async (/** @type {{prefix:string,uri:string}[]} */ rows) => {
    const dialog = await open();
    const count = await dialog
      .getByRole("button", { name: /^Remove namespace / })
      .count();
    for (let i = count; i > 0; i--)
      await dialog
        .getByRole("button", { name: "Remove namespace " + i, exact: true })
        .click();
    for (let i = 0; i < rows.length; i++) {
      await dialog
        .getByRole("button", { name: "Add namespace", exact: true })
        .click();
      await dialog
        .getByLabel("Namespace prefix " + (i + 1), { exact: true })
        .fill(rows[i].prefix);
      await dialog
        .getByLabel("Namespace URI " + (i + 1), { exact: true })
        .fill(rows[i].uri);
    }
    return dialog;
  };
  const saveMap = async (/** @type {{prefix:string,uri:string}[]} */ rows) => {
    const dialog = await setRows(rows);
    await dialog
      .getByRole("button", { name: "Save namespaces", exact: true })
      .click();
    await dialog.waitFor({ state: "detached" });
    const expected = Object.fromEntries(rows.map((r) => [r.prefix, r.uri]));
    await poll(
      async () => {
        const current = (await saved()).meta.responseXPathNamespaces;
        await Bun.write(
          output + "/namespace-map-progress.json",
          JSON.stringify({ expected, current, checks }, null, 2),
        );
        return (
          !!current &&
          Object.keys(current).length === Object.keys(expected).length &&
          Object.entries(expected).every(
            ([prefix, uri]) => current[prefix] === uri,
          )
        );
      },
      "Durable XPath namespace map",
      60000,
    );
  };
  async function select(
    /** @type {string} */ expression,
    /** @type {string} */ expected,
  ) {
    await input().fill(expression);
    await input().press("Enter");
    await poll(
      async () => (await value()) === expected,
      "Mapped XPath literal",
      60000,
    );
    assert.equal(await pane.getByRole("alert").count(), 0);
    const state = await saved(expression);
    assert.deepEqual(state.response, original);
    checks.push({ kind: "selection", expression, expected, state });
  }
  await saveMap([
    { prefix: "n", uri: "urn:one" },
    { prefix: "m", uri: "urn:two" },
  ]);
  await select("//n:item/text()", "<result>\none\n</result>");
  await select("//m:item/text()", "<result>\ntwo\nother\n</result>");
  await select("//m:item/@m:id", '<result>\np:id="b"\n</result>');
  await select("count(//n:item | //m:item)", "<result>\n3\n</result>");
  await select("//item", "<result/>");
  await page.reload();
  await input().waitFor();
  await poll(
    async () => (await value()) === "<result/>",
    "Mapped reload result",
    60000,
  );
  assert.deepEqual((await saved()).meta.responseXPathNamespaces, {
    n: "urn:one",
    m: "urn:two",
  });
  checks.push({ kind: "reload", state: await saved() });
  const preserved = await saved();
  for (const [rows, message] of [
    [
      [
        { prefix: "n", uri: "urn:one" },
        { prefix: "n", uri: "urn:two" },
      ],
      "unique",
    ],
    [[{ prefix: "bad:name", uri: "urn:x" }], "without a colon"],
    [[{ prefix: "n", uri: "" }], "Namespace URI"],
    [[{ prefix: "xml", uri: "urn:x" }], "reserved"],
  ]) {
    const dialog = await setRows(
      /** @type {{prefix:string,uri:string}[]} */ (rows),
    );
    await dialog
      .getByRole("button", { name: "Save namespaces", exact: true })
      .click();
    await dialog
      .getByRole("alert")
      .filter({ hasText: /** @type {string} */ (message) })
      .waitFor();
    assert.deepEqual(await saved(), preserved);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  }
  checks.push({ kind: "validation-ui", refusals: 4, state: await saved() });
  const dialog = await open();
  await dialog
    .getByLabel("Namespace URI 1", { exact: true })
    .fill("urn:cancelled");
  await dialog.press("Escape");
  await dialog.waitFor({ state: "detached" });
  assert.deepEqual(await saved(), preserved);
  assert.equal(
    await pane
      .getByRole("button", { name: "Namespaces", exact: true })
      .evaluate(
        (/** @type {HTMLElement} */ el) => el === document.activeElement,
      ),
    true,
  );
  checks.push({ kind: "cancel-focus", state: await saved() });
  await saveMap([{ prefix: "n", uri: "urn:two" }]);
  await select("count(//n:item)", "<result>\n2\n</result>");
  await pane.getByRole("button", { name: "Clear", exact: true }).click();
  await saved("");
  assert.deepEqual((await saved()).meta.responseXPathNamespaces, {
    n: "urn:two",
  });
  checks.push({ kind: "clear-retains-map", state: await saved() });

  for (const theme of ["dark", "light"])
    for (const width of [1440, 900, 760]) {
      await page.setViewportSize({ width, height: 960 });
      await page.evaluate(
        (/** @type {string} */ theme) =>
          (document.documentElement.dataset.theme = theme),
        theme,
      );
      const dialog = await open();
      const metrics = await dialog.evaluate((/** @type {HTMLElement} */ el) => {
        const r = el.getBoundingClientRect();
        return {
          width: innerWidth,
          left: r.left,
          right: r.right,
          scroll: el.scrollWidth,
          client: el.clientWidth,
          controls: [...el.querySelectorAll("input,button")].map((c) => {
            const b = c.getBoundingClientRect();
            return {
              name: c.getAttribute("aria-label") || c.textContent,
              left: b.left,
              right: b.right,
              width: b.width,
            };
          }),
        };
      });
      assert.ok(metrics.left >= 0 && metrics.right <= width);
      assert.ok(metrics.scroll <= metrics.client + 1);
      for (const c of metrics.controls)
        assert.ok(
          c.width >= 24 &&
            c.left >= metrics.left - 1 &&
            c.right <= metrics.right + 1,
        );
      await page.screenshot({
        path: output + `/namespaces-${theme}-${width}.png`,
      });
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      checks.push({ kind: "layout", theme, width, metrics });
    }
  await page.setViewportSize({ width: 1440, height: 960 });
  // Mapping replacement is a worker generation boundary, including late faults.
  await input().fill("count(//n:item)");
  await installResponseWorkerControl(page);
  await input().press("Enter");
  await poll(
    async () => !!(await responseWorkerRecords(page))[0]?.posts.length,
    "Old mapped worker",
  );
  // Complete the new worker before polling slow native persistence. Editing the
  // existing row avoids spending the old generation's real 3s deadline on setup.
  const mappingDialog = await open();
  await mappingDialog
    .getByLabel("Namespace URI 1", { exact: true })
    .fill("urn:one");
  await mappingDialog
    .getByRole("button", { name: "Save namespaces", exact: true })
    .click();
  await mappingDialog.waitFor({ state: "detached" });
  await poll(
    async () =>
      !!(await responseWorkerRecords(page))[0]?.terminated &&
      !!(await responseWorkerRecords(page))[1]?.posts.length,
    "Mapping replaces worker",
    60000,
  );
  await Bun.write(
    output + "/mapping-workers-before-completion.json",
    JSON.stringify(await responseWorkerRecords(page), null, 2),
  );
  await emitResponseWorker(page, 1, "message", {
    text: "CURRENT MAPPED PREVIEW",
  });
  await poll(
    async () => (await value()) === "CURRENT MAPPED PREVIEW",
    "Current mapping result",
    60000,
  );
  for (const kind of /** @type {('message'|'error'|'messageerror')[]} */ ([
    "message",
    "error",
    "messageerror",
  ]))
    await emitResponseWorker(page, 0, kind, {
      text: "STALE MAP",
      error: "STALE ERROR",
    });
  assert.equal(await value(), "CURRENT MAPPED PREVIEW");
  assert.equal(await pane.getByRole("alert").count(), 0);
  const records = await responseWorkerRecords(page);
  assert.deepEqual(records[0].posts[0].namespaces, { n: "urn:two" });
  assert.deepEqual(records[1].posts[0].namespaces, { n: "urn:one" });
  assert.ok(records[0].deadlineClearedAt !== null);
  assert.deepEqual((await saved()).response, original);
  checks.push({ kind: "mapping-generation", records, state: await saved() });
  await page.reload();
  await input().waitFor();
  await poll(
    async () => (await value()) === "<result>\n1\n</result>",
    "Real mapping after controlled callbacks",
    60000,
  );
  await saveMap([]);
  await pane
    .getByRole("alert")
    .filter({ hasText: "Cannot resolve QName" })
    .waitFor();
  assert.deepEqual((await saved()).meta.responseXPathNamespaces, {});
  assert.deepEqual((await saved()).response, original);
  checks.push({ kind: "remove-map", state: await saved() });
  await saveMap([{ prefix: "n", uri: "urn:one" }]);
  await poll(
    async () => (await value()) === "<result>\n1\n</result>",
    "Restored original request mapping",
    60000,
  );
  const latest = await invoke("load_workspace");
  const request = latest.resources.find(
    (/** @type {any} */ r) => r._id === requestId,
  );
  const peerId = "req_ns_peer_" + Date.now();
  latest.resources.push(
    newRequest(request.parentId, {
      _id: peerId,
      name: "Namespace peer",
      url: request.url,
    }),
    {
      _id: "reqm_" + peerId,
      _type: "request_meta",
      parentId: peerId,
      responseFilter: "count(//n:item)",
      responseXPathNamespaces: { n: "urn:two" },
    },
  );
  await invoke("save_workspace", { data: latest });
  await page.reload();
  await input().waitFor();
  await page
    .locator("button.tree-request")
    .filter({ has: page.getByText("Namespace peer", { exact: true }) })
    .click();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await poll(
    async () => (await value()) === "<result>\n2\n</result>",
    "Peer request namespace mapping",
    60000,
  );
  const peerState = await invoke("load_workspace");
  const peerMeta = peerState.resources.find(
    (/** @type {any} */ r) =>
      r.parentId === peerId && r._type === "request_meta",
  );
  const peerResponse = peerState.history.find(
    (/** @type {any} */ r) => r.requestId === peerId,
  );
  assert.deepEqual(peerMeta.responseXPathNamespaces, { n: "urn:two" });
  assert.equal(peerResponse.body, documents["/mapped"].body);
  await page
    .locator("button.tree-request")
    .filter({ has: page.getByText("Owned XML response", { exact: true }) })
    .click();
  await poll(
    async () => (await value()) === "<result>\n1\n</result>",
    "Original request retains mapping",
    60000,
  );
  assert.deepEqual((await saved()).meta.responseXPathNamespaces, {
    n: "urn:one",
  });
  assert.deepEqual((await saved()).response, original);
  checks.push({
    kind: "request-isolation",
    peerMeta,
    peerResponse,
    state: await saved(),
  });
  await Bun.write(
    output + "/namespace-acceptance.json",
    JSON.stringify(
      {
        passed: true,
        checks,
        workers,
        wire,
        limits:
          "Local Windows native XPath mapping/edit/reload/cancellation and six layouts; full accessibility/platform/template/OS transfer/migration remain required.",
      },
      null,
      2,
    ),
  );
}
