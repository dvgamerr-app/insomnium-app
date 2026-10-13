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

/** Saved headless component measurement; no native transport or persisted workspace.
 * @param {import('playwright-core').Page} page @param {string} output */
export async function measureNamespaceComponent(page, output) {
  const checks = /** @type {Record<string,any>[]} */ ([]);
  const failures = /** @type {Record<string,any>[]} */ ([]);
  const snapshot = async () => JSON.parse(/** @type {string} */ (
    await page.locator("output[data-namespace-snapshot]").getAttribute("data-namespace-snapshot")));
  const trigger = page.getByRole("button", {name:"Namespaces",exact:true});
  const open = async () => {
    await trigger.click();
    const dialog = page.getByRole("dialog", {name:"XPath namespaces",exact:true});
    await dialog.waitFor();
    return dialog;
  };
  const setRows = async (/** @type {{prefix:string,uri:string}[]} */ rows) => {
    const dialog = await open();
    for(let i=await dialog.getByRole("button",{name:/^Remove namespace /}).count();i>0;i--)
      await dialog.getByRole("button",{name:"Remove namespace "+i,exact:true}).click();
    for(let i=0;i<rows.length;i++) {
      await dialog.getByRole("button",{name:"Add namespace",exact:true}).click();
      await dialog.getByLabel("Namespace prefix "+(i+1),{exact:true}).fill(rows[i].prefix);
      await dialog.getByLabel("Namespace URI "+(i+1),{exact:true}).fill(rows[i].uri);
    }
    return dialog;
  };
  for(const theme of ["dark","light"]) for(const width of [1440,900,760,560]) {
    await page.setViewportSize({width,height:600});
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    const initial=await snapshot();
    let dialog=await open();
    await dialog.locator(".hint").click();
    await page.mouse.move(0,0);
    const metrics=await dialog.evaluate(el=>{
      const r=el.getBoundingClientRect();
      return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,scroll:el.scrollWidth,client:el.clientWidth,
        rows:[...el.querySelectorAll(".namespace-row")].map(row=>({columns:getComputedStyle(row).gridTemplateColumns,gap:getComputedStyle(row).gap})),
        labels:[...el.querySelectorAll("label")].map(label=>({text:label.childNodes[0]?.textContent?.trim(),gap:getComputedStyle(label.parentElement?.classList.contains("ui-field")?label.parentElement:label).gap,font:getComputedStyle(label).font})),
        controls:[...el.querySelectorAll("input,button")].map(c=>{const b=c.getBoundingClientRect(),s=getComputedStyle(c);return {name:c.getAttribute("aria-label")||c.textContent,x:b.x,y:b.y,width:b.width,height:b.height,color:s.color,background:s.backgroundColor,font:s.font};})};
    });
    assert.ok(metrics.left>=0&&metrics.right<=width);
    assert.ok(metrics.scroll<=metrics.client+1);
    for(const label of metrics.labels) assert.equal(label.gap,"6px");
    for(const row of metrics.rows) {
      assert.equal(row.gap,"6px");
      assert.equal(row.columns.split(" ").length,width<=600?1:3);
    }
    checks.push({kind:"geometry",theme,width,metrics});
    await dialog.locator(".namespace-row").nth(0).locator("label").nth(0).click();
    assert.equal(await dialog.getByRole("textbox",{name:"Namespace prefix 1",exact:true}).evaluate(el=>el===document.activeElement),true,"Compact label click focuses exact numbered input");
    await dialog.getByLabel("Namespace URI 1",{exact:true}).fill("urn:cancelled");
    await dialog.press("Escape");
    await dialog.waitFor({state:"detached"});
    assert.deepEqual(await snapshot(),initial);
    assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
    checks.push({kind:"escape-no-save-focus",theme,width});
    for(const [rows,message,target] of [
      [[{prefix:"n",uri:"urn:one"},{prefix:"n",uri:"urn:two"}],"unique","Namespace prefix 2"],
      [[{prefix:"bad:name",uri:"urn:x"}],"without a colon","Namespace prefix 1"],
      [[{prefix:"n",uri:""}],"Namespace URI","Namespace URI 1"],
      [[{prefix:"xml",uri:"urn:x"}],"reserved","Namespace prefix 1"],
    ]) {
      dialog=await setRows(/** @type {{prefix:string,uri:string}[]} */(rows));
      const submit=dialog.getByRole("button",{name:"Save namespaces",exact:true});
      await submit.focus(); await submit.press("Enter");
      await poll(async()=>await dialog.getByRole("alert").filter({hasText:/** @type {string} */(message)}).count()>0,"Authoritative namespace field error");
      assert.deepEqual(await snapshot(),initial);
      const control=dialog.getByRole("textbox",{name:/** @type {string} */(target),exact:true});
      const state=await control.evaluate(el=>({id:el.id,invalid:el.getAttribute("aria-invalid"),describedby:el.getAttribute("aria-describedby"),focus:document.activeElement?.getAttribute("aria-label")||document.activeElement?.textContent}));
      const row={kind:"association",theme,width,message,target,state,aria:await control.ariaSnapshot()};
      checks.push(row);
      if(state.invalid!=="true"||!state.describedby) failures.push(row);
      if(state.invalid === "true") {
        assert.ok(state.id);
        assert.equal(state.describedby,state.id+"-error");
        const affected = message === "unique" ? ["Namespace prefix 1","Namespace prefix 2"]
          : message === "reserved" ? ["Namespace prefix 1","Namespace URI 1"] : [target];
        assert.equal(await dialog.getByRole("alert").count(),affected.length,"Only authoritative local field alerts");
        const errorIds=[];
        for(const name of affected) {
          const field=dialog.getByRole("textbox",{name:/** @type {string} */(name),exact:true});
          const id=await field.getAttribute("id");
          assert.equal(await field.getAttribute("aria-invalid"),"true");
          assert.equal(await field.getAttribute("aria-describedby"),id+"-error");
          errorIds.push(id+"-error");
          assert.ok((await dialog.locator('[id="'+id+'-error"]').innerText()).includes(/** @type {string} */(message)));
        }
        assert.equal(new Set(errorIds).size,affected.length,"Each affected field has a distinct exact error ID");
        if(message === "Namespace URI") {
          await dialog.getByLabel("Namespace prefix 1",{exact:true}).fill("bad:name");
          assert.equal(await control.getAttribute("aria-invalid"),"true","An independently invalid URI survives another field correction");
        }
        const count=await dialog.getByRole("button",{name:/^Remove namespace /}).count();
        for(let i=1;i<=count;i++) {
          await dialog.getByLabel("Namespace prefix "+i,{exact:true}).fill("corrected"+i);
          await dialog.getByLabel("Namespace URI "+i,{exact:true}).fill("urn:corrected:"+i);
        }
        assert.equal(await dialog.getByRole("alert").count(),0,"Corrected fields remove their descriptions");
        assert.equal(await dialog.locator('[aria-invalid="true"]').count(),0);
        assert.equal(await dialog.locator('input[aria-describedby]').count(),0);
        assert.deepEqual(await snapshot(),initial,"Correction alone does not save");
      }
      await dialog.getByRole("button",{name:"Cancel",exact:true}).click();
    }
    dialog=await open();
    for(const [index,key] of [[2,"Enter"],[2,"Space"],[1,"Enter"]]) {
      const remove=dialog.getByRole("button",{name:"Remove namespace "+index,exact:true});
      await remove.focus(); await remove.press(/** @type {string} */(key));
      const active=await page.evaluate(()=>({tag:document.activeElement?.tagName,name:document.activeElement?.getAttribute("aria-label")||document.activeElement?.textContent?.trim(),inDialog:!!document.activeElement?.closest("dialog")}));
      const row={kind:"focused-removal",theme,width,index,key,remaining:await dialog.getByRole("button",{name:/^Remove namespace /}).count(),active};
      checks.push(row);
      if(!active.inDialog) failures.push(row);
      if(active.inDialog) assert.equal(active.name,row.remaining?"Remove namespace "+Math.min(Number(index),row.remaining):"Add namespace");
    }
    assert.equal(await dialog.getByRole("button",{name:/^Remove namespace /}).count(),0);
    await dialog.getByRole("button",{name:"Cancel",exact:true}).click();
    dialog=await setRows(Array.from({length:32},(_,i)=>({prefix:"n"+i,uri:"urn:"+i})));
    assert.equal(await dialog.getByRole("button",{name:"Add namespace",exact:true}).isDisabled(),true);
    assert.equal(await dialog.getByRole("textbox").count(),64);
    for(let i=1;i<=32;i++) {
      assert.equal(await dialog.getByRole("textbox",{name:"Namespace prefix "+i,exact:true}).count(),1);
      assert.equal(await dialog.getByRole("textbox",{name:"Namespace URI "+i,exact:true}).count(),1);
    }
    checks.push({kind:"32-cap",theme,width,controls:64});
    await dialog.getByRole("button",{name:"Cancel",exact:true}).click();
    assert.deepEqual(await snapshot(),initial);
    await page.getByRole("button",{name:"Toggle owned save rejection",exact:true}).click();
    dialog=await open();
    await dialog.getByLabel("Namespace prefix 1",{exact:true}).fill(" "+Object.keys(initial.namespaces)[0]+" ");
    await dialog.getByLabel("Namespace URI 1",{exact:true}).fill(" urn:corrected:"+theme+":"+width+" ");
    await dialog.getByRole("button",{name:"Save namespaces",exact:true}).press("Enter");
    await dialog.getByRole("alert").filter({hasText:"This request cannot be edited right now"}).waitFor();
    assert.equal(await dialog.locator('input[aria-invalid="true"]').count(),0,"Callback failure is form-level");
    assert.equal(await dialog.locator('input[aria-describedby]').count(),0);
    assert.deepEqual(await snapshot(),initial);
    await dialog.getByRole("button",{name:"Cancel",exact:true}).click();
    await page.getByRole("button",{name:"Toggle owned save rejection",exact:true}).click();
    dialog=await open();
    await dialog.getByLabel("Namespace prefix 1",{exact:true}).fill(" "+Object.keys(initial.namespaces)[0]+" ");
    await dialog.getByLabel("Namespace URI 1",{exact:true}).fill(" urn:corrected:"+theme+":"+width+" ");
    await dialog.getByRole("button",{name:"Save namespaces",exact:true}).press("Enter");
    await dialog.waitFor({state:"detached"});
    const accepted=await snapshot();
    assert.deepEqual(accepted.namespaces,{...initial.namespaces,[Object.keys(initial.namespaces)[0]]:"urn:corrected:"+theme+":"+width});
    assert.equal(accepted.saves,initial.saves+1);
    assert.equal(accepted.rawResponse,initial.rawResponse);
    checks.push({kind:"callback-refusal-corrected-save",theme,width,accepted});
  }
  await Bun.write(output+"/namespace-component-measurements.json",JSON.stringify({native:false,checks,failures},null,2));
  assert.deepEqual(failures,[],"Namespace local attribution and focused removal remain associated with usable controls");
}

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
  try {
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
      .first()
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
  await Bun.write(output+"/namespace-peer-before-assert.json",JSON.stringify({phase:"native-load-captured-before-peer-assertions",peerId,peerMeta:peerMeta??null,peerResponse:peerResponse??null,expectedMap:{n:"urn:two"},expectedBody:documents["/mapped"].body},null,2));
  assert.deepEqual(peerMeta.responseXPathNamespaces, { n: "urn:two" });
  assert.equal(peerResponse.body, documents["/mapped"].body);
  await Bun.write(output+"/namespace-peer-assertions-passed.json",JSON.stringify({phase:"peer-assertions-passed-before-original-request-click",peerId},null,2));
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
  } catch (error) {
    const seen=new WeakSet();
    /** @type {(value:any,depth?:number)=>Record<string,any>} */
    const describe=(value,depth=0)=>{
      if(depth>5)return {truncated:true};
      if(value===null||typeof value!=='object')return {type:typeof value,message:String(value)};
      if(seen.has(value))return {cycle:true};seen.add(value);
      const result=/** @type {Record<string,any>} */ ({name:String(value.name??value.constructor?.name??'Error'),message:String(value.message??value),stack:typeof value.stack==='string'?value.stack:null,code:typeof value.code==='string'?value.code:null});
      if('cause' in value)result.cause=describe(value.cause,depth+1);
      if(Array.isArray(value.errors))result.errors=value.errors.slice(0,20).map((/** @type {any} */ child)=>describe(child,depth+1));
      return result;
    };
    try {await Bun.write(output+'/namespace-primary-failure.json',JSON.stringify({phase:'original-native-namespace-helper-failed',error:describe(error),completedCheckKinds:checks.map(row=>row.kind)},null,2));}
    catch(diagnosticError){console.error('Namespace diagnostic write failed; original error retained',String(diagnosticError));}
    throw error;
  }
}
