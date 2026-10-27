import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { initialData, newRequest } from "../../src/lib/model.js";
import { appendSseRaw, sseRawBytes } from "../../src/lib/sse-raw.js";
import { withPreview } from "./helpers/preview-app.js";
const sha = (/** @type {Uint8Array} */ bytes) =>
  createHash("sha256").update(bytes).digest("hex");
/** @returns {Record<string,any>} */
const empty = () => ({
  rawEvents: [],
  rawDropped: 0,
  rawReceivedBytes: 0,
  rawRetainedBytes: 0,
  rawStoredBytes: 0,
});
/** @param {Uint8Array} bytes @param {number} chunk @param {number} offset */
const packet = (bytes, chunk, offset) => ({
  kind: "sseRaw",
  data: Buffer.from(bytes).toString("base64"),
  size: bytes.length,
  chunk,
  offset,
});
const exact = Buffer.from(
  "\uFEFF: exact comment\r\nid: owned\r\nevent: update\r\ndata: ไทย β\r\ndata: second line\r\n\r\n: only comment\nid: unfinished\ndata: never dispatched",
);
const cut = exact.indexOf(Buffer.from("ไ")) + 1,
  first = packet(exact.subarray(0, cut), 1, 0),
  second = packet(exact.subarray(cut), 1, cut);
const complete = empty();
appendSseRaw(complete, first);
appendSseRaw(complete, second);
assert.deepEqual(Buffer.from(sseRawBytes(complete)), exact);
assert.equal(complete.rawDropped, 0);
assert.equal(complete.rawReceivedBytes, exact.length);
assert.equal(complete.rawRetainedBytes, exact.length);
const malformed = [
  { ...first, data: "YQ" },
  { ...first, size: first.size + 1 },
  { ...first, chunk: 0 },
  { ...first, offset: -1 },
  { ...first, size: 65537, data: Buffer.alloc(65537).toString("base64") },
];
for (const value of malformed) {
  const response = empty();
  assert.throws(() => appendSseRaw(response, value));
  assert.deepEqual(
    response,
    empty(),
    "Malformed raw packet cannot mutate history",
  );
}
for (const value of malformed)
  assert.throws(
    () => sseRawBytes({ ...empty(), rawEvents: [value] }),
    "Malformed persisted raw packet cannot export",
  );
const sequence = empty();
appendSseRaw(sequence, first);
for (const value of [
  first,
  { ...second, chunk: 3 },
  { ...second, offset: cut + 1 },
]) {
  const before = structuredClone(sequence);
  assert.throws(() => appendSseRaw(sequence, value));
  assert.deepEqual(
    sequence,
    before,
    "Duplicate/skipped/overlapping frame rejected atomically",
  );
}
const capped = empty();
for (let index = 0; index < 1003; index++)
  appendSseRaw(capped, packet(Buffer.from("x"), index + 1, 0));
assert.equal(capped.rawEvents.length, 1000);
assert.equal(capped.rawDropped, 3);
assert.equal(capped.rawReceivedBytes, 1003);
assert.equal(capped.rawRetainedBytes, 1000);
assert.equal(capped.rawEvents[0].chunk, 4);
assert.equal(sseRawBytes(capped).length, 1000);
const byteCapped = empty(),
  large = Buffer.alloc(65536, 65);
for (let index = 0; index < 160; index++)
  appendSseRaw(byteCapped, packet(large, index + 1, 0));
assert.ok(byteCapped.rawDropped > 0);
assert.ok(byteCapped.rawStoredBytes <= 8 * 1024 * 1024);
assert.equal(
  byteCapped.rawStoredBytes,
  Buffer.byteLength(JSON.stringify(byteCapped.rawEvents)),
  "Stored cap counts actual JSON array bytes",
);
assert.equal(byteCapped.rawReceivedBytes, 160 * large.length);
assert.equal(byteCapped.rawRetainedBytes, sseRawBytes(byteCapped).length);
assert.ok(byteCapped.rawRetainedBytes < byteCapped.rawReceivedBytes);
const seed = initialData(),
  workspaceId = seed.activeWorkspaceId;
const request = newRequest(workspaceId, {
  _id: "req_raw_sse_preview",
  name: "Owned raw SSE preview",
  url: "http://127.0.0.1:1/never-connect",
  responseMode: "sse",
});
seed.resources.push(request);
seed.activeRequestId = request._id;
seed.openTabs.push(request._id);
const fullHistory = {
  ...complete,
  _id: "res_raw_sse_complete",
  requestId: request._id,
  protocol: "sse",
  environmentId: null,
  created: 1700000000000,
  connectionState: "closed",
  status: 200,
  events: [
    {
      _id: "parsed_owned",
      kind: "sse",
      event: "update",
      id: "owned",
      data: "ไทย β\nsecond line",
      created: 1700000000000,
    },
  ],
  headers: [["content-type", "text/event-stream"]],
  size: Buffer.byteLength("ไทย β\nsecond line"),
};
const partialHistory = {
  ...capped,
  _id: "res_raw_sse_partial",
  requestId: request._id,
  protocol: "sse",
  environmentId: null,
  created: 1700000001000,
  connectionState: "closed",
  status: 200,
  events: [],
  headers: [],
  size: 1003,
};
const selectionHistory={_id:'res_stream_selection',requestId:request._id,protocol:'sse',environmentId:null,
  created:1700000002000,connectionState:'closed',status:200,headers:[],size:0,
  events:[{...fullHistory.events[0],data:'colliding earlier event'},
    {...fullHistory.events[0],_id:'parsed_latest_selection',data:'latest selected history event'}]};
seed.history = [partialHistory, fullHistory,selectionHistory];
seed.responseSelections = { [request._id]: fullHistory._id };
const wsRequest = newRequest(workspaceId, {
  _id:"req_stream_metric_ws", _type:"websocket_request", name:"Owned stream byte metrics", url:"ws://127.0.0.1:1/never-connect",
});
seed.resources.push(wsRequest);
const metricCases = [
  {name:"unicode",data:"βไทย😀",format:"text",size:Buffer.byteLength("βไทย😀"),dropped:0},
  {name:"binary",data:Buffer.from([0,1,255,127]).toString("base64"),format:"binary",size:4,dropped:0},
  {name:"retained-total",data:"fresh",format:"text",size:9*1024*1024+5,dropped:1},
].map((row,index)=>({...row,_id:"res_stream_metric_"+row.name,requestId:wsRequest._id,protocol:"websocket",environmentId:null,
  created:1700000003000+index,connectionState:"closed",status:101,headers:[],
  events:[{_id:"evt_metric_"+row.name,kind:"message",direction:"received",format:row.format,data:row.data,size:row.name==='retained-total'?5:row.size,created:1700000003000+index}]}));
seed.history.push(...metricCases);
const label = process.env.INSOMNIUM_UI_RUN_LABEL || "";
assert.match(label, /^[a-zA-Z0-9_-]{0,80}$/);
await withPreview(
  "sse-raw-history" + (label ? "-" + label : ""),
  async (page, output) => {
    await page.evaluate(
      (data) =>
        localStorage.setItem(
          "insomnium-tauri-preview-v1",
          JSON.stringify(data),
        ),
      seed,
    );
    await page.reload();
    const pane = page.getByRole("region", {
        name: "Stream response",
        exact: true,
      }),
      history = pane.getByLabel("Connection history", { exact: true });
    await history.waitFor();
    assert.equal(await history.inputValue(), fullHistory._id);
    const metric = pane.locator('[title^="Time to first message / total time /"]');
    const metricResults = /** @type {Record<string,any>[]} */([]);
    const assertMetric = async (/** @type {number} */bytes,/** @type {string} */label) => {
      const expected=bytes<1024?bytes+' B':bytes<1048576?(bytes/1024).toFixed(1)+' KB':(bytes/1048576).toFixed(1)+' MB';
      const displayed=await metric.innerText();
      assert.ok(displayed.endsWith(expected),label+': '+displayed+' must end with '+expected);
      metricResults.push({label,bytes,displayed});
    };
    await assertMetric(fullHistory.size,"SSE UTF8 payload");
    const raw = () => pane.getByRole("tab", { name: "Raw", exact: true });
    await raw().click();
    assert.equal(
      await pane.locator("pre").last().textContent(),
      new TextDecoder().decode(exact),
    );
    await page.screenshot({ path: resolve(output, "complete-raw.png") });
    const downloadRaw = async (
      /** @type {string} */ name,
      /** @type {Uint8Array} */ expected,
    ) => {
      const downloading = page.waitForEvent("download");
      await pane
        .getByRole("button", { name: "Export raw", exact: true })
        .click();
      const download = await downloading;
      const path = resolve(output, name);
      await download.saveAs(path);
      assert.deepEqual(
        Buffer.from(await Bun.file(path).bytes()),
        Buffer.from(expected),
      );
      return { path, bytes: expected.length, sha256: sha(expected) };
    };
    const fullExport = await downloadRaw("complete.bin", exact);
    await page.reload();
    await history.waitFor();
    assert.equal(await history.inputValue(), fullHistory._id);
    await raw().click();
    assert.equal(
      await pane.locator("pre").last().textContent(),
      new TextDecoder().decode(exact),
    );
    await pane.getByRole("tab", { name: "Events", exact: true }).click();
    assert.equal(await pane.locator(".stream-event").count(), 1);
    await pane.locator(".stream-event").click();
    assert.equal(
      await pane.locator(".stream-event-body").textContent(),
      "ไทย β\nsecond line",
    );
    await history.selectOption(selectionHistory._id);
    await pane.locator('.stream-event-body').filter({hasText:'latest selected history event'}).waitFor();
    assert.equal(await pane.locator('.stream-event-body').textContent(),'latest selected history event');
    await history.selectOption(fullHistory._id);await pane.locator('.stream-event').click();
    await page.evaluate(()=>{
      const state=/** @type {any} */(window);state.__streamClipboardDescriptor=Object.getOwnPropertyDescriptor(navigator.clipboard,'writeText');
      Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:(/** @type {string} */text)=>new Promise((resolve,reject)=>{state.__streamCopyText=text;state.__rejectStreamCopy=reject;})});
    });
    try{
      await pane.getByRole('button',{name:'Copy stream event',exact:true}).click();
      assert.equal(await page.evaluate(()=>/** @type {any} */(window).__streamCopyText),'ไทย β\nsecond line');
      await history.selectOption(partialHistory._id);
      await page.evaluate(async()=>{/** @type {any} */(window).__rejectStreamCopy(new Error('owned stale stream copy'));await new Promise(resolve=>setTimeout(resolve,0));});
      assert.equal(await pane.getByText('owned stale stream copy',{exact:false}).count(),0);
      await history.selectOption(fullHistory._id);await pane.locator('.stream-event').click();
      await pane.getByRole('button',{name:'Copy stream event',exact:true}).click();
      await page.evaluate(()=>/** @type {any} */(window).__rejectStreamCopy(new Error('owned current stream copy')));
      await pane.getByRole('alert').filter({hasText:'owned current stream copy'}).waitFor();
    }finally{await page.evaluate(()=>{const state=/** @type {any} */(window);if(state.__streamClipboardDescriptor)Object.defineProperty(navigator.clipboard,'writeText',state.__streamClipboardDescriptor);else delete /** @type {any} */(navigator.clipboard).writeText;});}
    await history.selectOption(partialHistory._id);
    await raw().click();
    await pane
      .getByText(/partial|omitted|older raw|raw.*removed/i)
      .first()
      .waitFor();
    assert.equal(
      await pane.locator("pre").last().textContent(),
      "x".repeat(1000),
    );
    const partialExport = await downloadRaw(
      "partial-retained.bin",
      Buffer.from("x".repeat(1000)),
    );
    await page.screenshot({ path: resolve(output, "partial-raw-warning.png") });
    await page.reload();
    await history.waitFor();
    assert.equal(await history.inputValue(), partialHistory._id);
    await raw().click();
    assert.equal(
      await pane.locator("pre").last().textContent(),
      "x".repeat(1000),
    );
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}"),
    );
    assert.deepEqual(saved.history, seed.history);
    assert.equal(saved.responseSelections[request._id], partialHistory._id);
    await page.locator('.tree-request').filter({hasText:wsRequest.name}).click();
    await history.waitFor();
    for(const entry of metricCases){
      await history.selectOption(entry._id);
      await assertMetric(entry.size,entry.name);
    }
    await page.reload();await history.waitFor();
    assert.equal(await history.inputValue(),metricCases.at(-1)?._id);
    await assertMetric(metricCases.at(-1)?.size??0,"retained total after reload");
    const afterMetrics=await page.evaluate(()=>JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1")||"{}"));
    assert.deepEqual(afterMetrics.history,seed.history);
    await Bun.write(
      resolve(output, "result.json"),
      JSON.stringify(
        {
          status: "passed",
          renderingMode: "headless",
          native: false,
          splitUtf8Together: true,
          bomCommentsFramingUnfinishedExact: true,
          rawExport: fullExport,
          partialExport,
          rawRowCap: 1000,
          rawStoredCap: 8 * 1024 * 1024,
          malformedRefusals: malformed.length,
          sequenceRefusals: 3,
          noParsedDuplication: true,
          historySelectionDoesNotReuseEventId:true,
          lateCopyFailureIgnored: true,
          currentCopyFailureVisible: true,
          reload: true,
          metricResults,
          scope:
            "Seeded durable raw capture UI; native capture verified separately",
        },
        null,
        2,
      ),
    );
  },
);
