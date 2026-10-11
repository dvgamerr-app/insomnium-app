import assert from "node:assert/strict";
import { createServer } from "node:http2";
import { newRequest } from "../../../src/lib/model.js";
import { poll } from "./native-app.js";

/** Real loopback gRPC transport for the saved plugin helper scenario. */
export async function createPluginGrpcFixture() {
  const wire = /** @type {any[]} */ ([]);
  const errors = /** @type {string[]} */ ([]);
  const sessions = new Set();
  const server = createServer();
  server.on("session", session => {
    sessions.add(session);
    session.on("error", error => errors.push(String(error)));
    session.on("close", () => sessions.delete(session));
  });
  server.on("stream", (/** @type {import('node:http2').ServerHttp2Stream} */ stream, headers) => {
    const row = { path: String(headers[":path"]), messages: /** @type {string[]} */ ([]), ended: false };
    wire.push(row);
    let bytes = Buffer.alloc(0);
    let responded = false;
    const respond = () => {
      if (responded) return;
      responded = true;
      const text = Buffer.from(row.messages.join("|"));
      assert.ok(text.length < 128);
      const payload = Buffer.concat([Buffer.from([10, text.length]), text]);
      const frame = Buffer.alloc(5);
      frame.writeUInt32BE(payload.length, 1);
      stream.respond({ ":status": 200, "content-type": "application/grpc" }, { waitForTrailers: true });
      stream.on("wantTrailers", () => stream.sendTrailers({ "grpc-status": "0" }));
      stream.end(Buffer.concat([frame, payload]));
    };
    stream.on("error", error => errors.push(String(error)));
    stream.on("data", chunk => {
      bytes = Buffer.concat([bytes, Buffer.from(chunk)]);
      while (bytes.length >= 5 && bytes.length >= bytes.readUInt32BE(1) + 5) {
        assert.equal(bytes[0], 0, "Owned fixture expects uncompressed gRPC");
        const length = bytes.readUInt32BE(1);
        const payload = bytes.subarray(5, length + 5);
        assert.equal(payload[0], 10);
        assert.equal(payload[1], payload.length - 2);
        row.messages.push(payload.subarray(2).toString());
        bytes = bytes.subarray(length + 5);
        if (row.path === "/helper.Sample/Echo") respond();
      }
    });
    stream.on("end", () => {
      row.ended = true;
      assert.equal(bytes.length, 0);
      respond();
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(null)));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const url = `grpc://127.0.0.1:${address.port}`;
  return {
    stop() { for (const session of sessions) session.destroy(); server.close(); },
    /** @param {string} helper @param {string} collection */
    source(helper, collection) {
      return `exports.templateTags.push(...['grpcurl','grpcbody'].map(name=>({name,async run(c){
        const workspace=await c.util.models.workspace.getById(${JSON.stringify(collection)});
        if(workspace._id!==${JSON.stringify(collection)}) throw Error('Wrong gRPC workspace');
        const saved=await c.util.models.request.getById(${JSON.stringify(helper)});
        saved.url='http://invalid.example/guest-edit';
        const sent=await c.network.sendRequest(saved,[{name:'payload',value:name}]);
        const latest=await c.util.models.response.getLatestForRequestId(saved._id);
        if(latest._id!==sent._id) throw Error('Missing gRPC helper history');
        const body=c.util.models.response.getBodyBuffer(sent).toString();
        if(body!=='plugin-render-accepted') throw Error('Wrong gRPC helper body');
        return name==='grpcurl'?${JSON.stringify(url)}:body;
      }})));`;
    },
    /** @param {string} collection @param {string} id */
    resources(collection, id) {
      return [newRequest(collection, { _id: id, _type: "grpc_request", name: "Plugin helper gRPC",
        url: "{% grpcurl %}", body: { text: '{"name":"{% grpcbody %}"}' },
        settingSendCookies: false, settingStoreCookies: false })];
    },
    /** @param {{page:import('playwright-core').Page,output:string,mainWire:any[]}} context */
    async exercise({ page, output, mainWire }) {
      const checks = [];
      const helperStart = mainWire.length;
      try {
        await page.getByRole("complementary", { name: "Collections" })
          .getByRole("button", { name: "gRPC Plugin helper gRPC", exact: true }).click();
        await page.getByRole("tab", { name: "Proto Files", exact: true }).click();
        await page.getByLabel("Import files", { exact: true }).setInputFiles({ name: "plugin-helper.proto", mimeType: "text/plain",
          buffer: Buffer.from('syntax = "proto3"; package helper; message Input { string name = 1; } service Sample { rpc Echo (Input) returns (Input); rpc Collect (stream Input) returns (Input); }') });
        await page.getByRole("button", { name: "Import 1 files", exact: true }).click();
        await page.getByRole("button", { name: "plugin-helper.proto", exact: true }).waitFor();
        await page.getByRole("button", { name: "Load methods", exact: true }).click();
        const methods = page.getByRole("combobox", { name: "gRPC method", exact: true });
        await methods.selectOption({ label: "/Sample/Echo · Unary" });
        assert.ok(mainWire.slice(helperStart).some(row => row.body === "grpcurl"));
        assert.equal(wire.length, 0, "Local schema discovery sends no gRPC message");
        checks.push("Native schema loading renders the connection using real workspace models and saved HTTP helper");
        await page.getByRole("tablist", { name: "gRPC request editor", exact: true }).getByRole("tab", { name: "Body", exact: true }).click();
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await page.locator(".grpc-response .status-badge").filter({ hasText: "0 OK" }).waitFor();
        await page.getByRole("button", { name: "Send", exact: true }).waitFor();
        await poll(async () => wire[0]?.ended === true, "Unary request sender closes");
        assert.deepEqual(wire.map(row => ({path:row.path,messages:row.messages,ended:row.ended})),
          [{path:"/helper.Sample/Echo",messages:["plugin-render-accepted"],ended:true}]);
        checks.push("Native unary body renderer sends the actual helper response through protobuf and receives status zero");
        await methods.selectOption({ label: "/Sample/Collect · Client streaming" });
        await page.getByRole("button", { name: "Connect", exact: true }).click();
        const send = page.getByRole("button", { name: "Send message", exact: true });
        await send.waitFor();
        for (let index = 1; index <= 2; index++) {
          await send.click();
          await poll(async () => wire[1]?.messages.length === index, "Native gRPC helper message reaches the server");
        }
        await page.getByRole("button", { name: "Commit", exact: true }).click();
        await page.locator(".grpc-response .status-badge").filter({ hasText: "0 OK" }).waitFor();
        assert.equal(wire[1].path, "/helper.Sample/Collect");
        assert.deepEqual(wire[1].messages, ["plugin-render-accepted", "plugin-render-accepted"]);
        assert.equal(wire[1].ended, true);
        const helpers = mainWire.slice(helperStart).filter(row => new URL(row.url).pathname === "/helper");
        assert.ok(helpers.filter(row => row.body === "grpcurl").length >= 3);
        assert.equal(helpers.filter(row => row.body === "grpcbody").length, 3);
        assert.ok(helpers.every(row => row.method === "POST"));
        assert.deepEqual(errors, []);
        checks.push("Native connected client-stream messages independently render real helpers and finish successfully");
        const evidence = { status: "passed", checks, wire, helpers: helpers.map(row => ({url:row.url,method:row.method,body:row.body})), errors };
        await Bun.write(output + "/grpc-helper-acceptance.json", JSON.stringify(evidence, null, 2));
        return evidence;
      } finally {
        await Bun.write(output + "/grpc-helper-wire.json", JSON.stringify({wire,errors}, null, 2));
      }
    },
  };
}
