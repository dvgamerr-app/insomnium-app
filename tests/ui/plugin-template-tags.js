import assert from "node:assert/strict";
import {
  mkdir,
  readFile,
  writeFile,
  unlink,
  realpath,
  lstat,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { newRequest } from "../../src/lib/model.js";
import { builtinTemplateNames } from "../../src/lib/template-registration.js";
import { withNativeApp, poll, probeIdentifier } from "./helpers/native-app.js";
import {
  installPluginWorkerProbe,
  pluginWorkerRecords,
  restorePluginWorkerProbe,
} from "./helpers/plugin-worker-probe.js";
import { withIpcSuccessHook } from "./helpers/ipc-success-hook.js";
import { createPluginOAuthFixture } from "./helpers/plugin-oauth-native.js";
import { createPluginGrpcFixture } from "./helpers/plugin-grpc-native.js";
import { pluginAppInfoSource, exercisePluginAppInfoNative } from "./helpers/plugin-app-info-native.js";
import {pluginDomOwnerNativeSource,exercisePluginDomOwnerHttpNative} from "./helpers/plugin-dom-owner-native.js";
import {exercisePluginDomNestedOwnerNative} from "./helpers/plugin-dom-nested-owner-native.js";
import {createPluginDomStreamFixture,exercisePluginDomStreamOwnerNative} from "./helpers/plugin-dom-stream-owner-native.js";
import {pluginDomTerminalNativeSource,exercisePluginDomTerminalOwnerNative} from "./helpers/plugin-dom-terminal-owner-native.js";
import {pluginDomCollectionsNativeSource,exercisePluginDomCollectionsNative} from "./helpers/plugin-dom-collections-native.js";
import {pluginDomTokensNativeSource,exercisePluginDomTokensNative} from "./helpers/plugin-dom-tokens-native.js";
import {pluginDomDatasetNativeSource,exercisePluginDomDatasetNative} from "./helpers/plugin-dom-dataset-native.js";
import {
  editorTagSource,
  editorTemplate,
  exerciseTemplateTagEditorNative,
} from "./helpers/template-tag-editor-native.js";

const editorMode = process.env.INSOMNIUM_TEMPLATE_TAG_EDITOR === "1";
const helperMode = process.env.INSOMNIUM_PLUGIN_HELPERS === "1";
const cookieMode = helperMode && process.env.INSOMNIUM_PLUGIN_HELPER_COOKIES === "1";
const protocolMode = helperMode && process.env.INSOMNIUM_PLUGIN_HELPER_PROTOCOLS === "1";
const oauthMode = helperMode && process.env.INSOMNIUM_PLUGIN_HELPER_OAUTH === "1";
const oauthFixture = oauthMode ? createPluginOAuthFixture() : undefined;
const appInfoMode = helperMode && process.env.INSOMNIUM_PLUGIN_APP_INFO === "1";
const domOwnerMode = helperMode && process.env.INSOMNIUM_PLUGIN_DOM_OWNER === "1";
const domNestedMode=domOwnerMode&&process.env.INSOMNIUM_PLUGIN_DOM_NESTED_OWNER==="1";
const domStreamMode=domNestedMode&&process.env.INSOMNIUM_PLUGIN_DOM_STREAM_OWNER==="1";
const domTerminalMode=domStreamMode&&process.env.INSOMNIUM_PLUGIN_DOM_TERMINAL_OWNER==="1";
const domCollectionsMode=domTerminalMode&&process.env.INSOMNIUM_PLUGIN_DOM_COLLECTIONS==="1";
const domTokensMode=domCollectionsMode&&process.env.INSOMNIUM_PLUGIN_DOM_TOKENS==="1";
const domDatasetMode=domTokensMode&&process.env.INSOMNIUM_PLUGIN_DOM_DATASET==="1";
const domStreamFixture=domStreamMode?createPluginDomStreamFixture():undefined;
const grpcFixture = helperMode && process.env.INSOMNIUM_PLUGIN_HELPER_GRPC === "1" ? await createPluginGrpcFixture() : undefined;
const socketMessages = /** @type {string[]} */ ([]);
let socketConnections = 0;

const readyText =
  "Plugin loaded in isolation. Custom template tags are available to request rendering. Hooks and actions are not connected yet.";
const names = ["insomnia-plugin-render-a", "insomnia-plugin-render-b"];
const publicNames = [
  "UnicodeTag",
  "ไทย",
  "$owned",
  "_owned",
  "1custom",
  "__proto__",
  "constructor",
  'a"b',
  "a\\b",
];
assert.ok(process.env.APPDATA);
const storeRoot = resolve(process.env.APPDATA, probeIdentifier);
assert.equal(
  (await realpath(storeRoot)).toLowerCase(),
  storeRoot.toLowerCase(),
);
const storePath = join(storeRoot, "plugin-data-v1.json");
let originalStore;
try {
  const stat = await lstat(storePath);
  assert.ok(stat.isFile() && !stat.isSymbolicLink());
  assert.equal(
    (await realpath(storePath)).toLowerCase(),
    storePath.toLowerCase(),
  );
  originalStore = await readFile(storePath);
} catch (error) {
  if (/** @type {any} */ (error).code !== "ENOENT") throw error;
}
const wire = /** @type {any[]} */ ([]);
const heldRoots=/** @type {(()=>void)[]} */([]);
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request, server) {
    if (protocolMode && new URL(request.url).pathname === "/ws" && server.upgrade(request)) return;
    wire.push({
      url: request.url,
      method: request.method,
      body: await request.text(),
      headers: Object.fromEntries(request.headers),
    });
    if(domNestedMode&&new URL(request.url).pathname==="/dom-owner-held")return new Promise(resolve=>{
      let released=false;heldRoots.push(()=>{if(released)return;released=true;resolve(new Response("late-owned-response",{headers:{"Content-Type":"text/plain"}}));});
    });
    if(domTerminalMode&&new URL(request.url).pathname==='/dom-terminal-helper-held')return new Promise(resolve=>{
      let released=false;heldRoots.push(()=>{if(released)return;released=true;resolve(new Response('late-terminal-helper',{headers:{'Content-Type':'text/plain'}}));});
    });
    return new Response("plugin-render-accepted", {
      headers: { "Content-Type": "text/plain" },
    });
  },
  websocket: {
    open() {socketConnections++;},
    message(socket,message) {const text=String(message);socketMessages.push(text);socket.send(text);},
  },
});
try {
  await withNativeApp(
    editorMode ? "plugin-template-editor" : "plugin-template-tags",
    async ({ page, invoke, output }) => {
      const original = await invoke("load_workspace"),
        collection = "wrk_plugin_render_" + Date.now(),
        requestId = "req_plugin_render_" + Date.now(),
        helperRequestId = requestId + "_helper",
        socketRequestId = requestId + "_socket",
        socketPayloadId = requestId + "_payload",
        oauthRequestId = requestId + "_oauth",
        root = join(output, "packages"),
        files = /** @type {{path:string,text:string}[]} */ ([]),
        checks = /** @type {string[]} */ ([]),
        observations = /** @type {any[]} */ ([]),
        records = /** @type {any[]} */ ([]),
        directories = [];
      let expiredCookieExpiry = "";
      const sourceA = `exports.templateTags=[
      {name:'dup',priority:-100,run(){return 'A-first';}},
      {name:'dup',priority:100,run(){return 'A-last';}},
      {name:'internal',run(){return 'internal-first';}},
      {name:'internal',run(){return 'internal-last';}},
      ${helperMode ? "{name:'extrainfo',run(c){return c.context.getExtraInfo('payload');}}," : ""}
      {name:'context',run(c,...args){return JSON.stringify({args,scope:c.context.scope,alias:c.context._.scope,derived:c.context.derived,meta:c.meta,purpose:c.renderPurpose});}},
      {name:'args',run(c,zero,nan,infinity,missing){return JSON.stringify({negativeZero:Object.is(zero,-0),nan:Number.isNaN(nan),infinity:infinity===Infinity,undefined:missing===undefined});}},
      {name:'value',run(c,kind){switch(kind){case 'false':return false;case 'zero':return 0;case 'null':return null;case 'undefined':return undefined;case 'bigint':return 12345678901234567890n;case 'nan':return NaN;case 'infinity':return Infinity;case 'array':return ['a',null,'b'];case 'object':return {a:1};case 'regex':return /owned/gi;case 'map':return new Map([['a',1]]);case 'set':return new Set([1]);case 'bytes':return new Uint8Array([1,2,255]);}}},
      ...${JSON.stringify(builtinTemplateNames)}.map(name=>({name,run(){throw Error('built-in collision callback must not run');}}))
    ];`;
      let sourceB =
        `exports.templateTags=[
      {name:'dup',priority:-999,run(){return 'B';}},
      ...${JSON.stringify(publicNames)}.map(name=>({name,run(){return name;}})),
      {name:'not callable',run(){throw Error('unparseable declaration must not break other tags');}},
      {name:'persist',async run(c){await c.store.setItem('value','stored');return await c.store.getItem('value');}},
      {name:'hold',async run(c){await c.store.getItem('gate');await c.store.setItem('forbidden','leaked');return 'held';}},
      {name:'throwing',run(){throw Error('owned plugin failure');}}
    ];` + (helperMode ? `exports.templateTags.push({name:'workspacehelper',async run(c){
      const saved=await c.util.models.request.getById(${JSON.stringify(helperRequestId)});
      const w=await c.util.models.workspace.getById(${JSON.stringify(collection)});
      const jar=await c.util.models.cookieJar.getOrCreateForWorkspace(w);
      const again=await c.util.models.cookieJar.getOrCreateForWorkspace(w);
      ${cookieMode ? "jar.cookies[0].value='guest-edit';" : ""}
      const prompted=await c.app.prompt('Plugin workspace helper',{defaultValue:'accepted'});
      saved.url='http://invalid.example/guest-edit';
      const sent=await c.network.sendRequest(saved,[{name:'payload',value:'from-extra'}]);
      const latest=await c.util.models.response.getLatestForRequestId(saved._id);
      return JSON.stringify({prompted,jarId:jar._id,jarStable:again._id===jar._id,
        parentId:jar.parentId,cookies:jar.cookies.length,version:sent.httpVersion,
        bytes:sent.bytesRead,body:c.util.models.response.getBodyBuffer(sent).toString(),
        latestMatches:latest._id===sent._id,latestBody:c.util.models.response.getBodyBuffer(latest).toString()
        ${cookieMode ? ",cookieModels:again.cookies" : ""}});
    }});` : "") + (protocolMode ? `exports.templateTags.push(
      {name:'messagehelper',async run(c){const saved=await c.util.models.request.getById(${JSON.stringify(helperRequestId)});const response=await c.network.sendRequest(saved,[{name:'payload',value:'from-extra'}]);return 'payload:'+c.util.models.response.getBodyBuffer(response).toString();}},
      {name:'payloadprompt',async run(c){return await c.app.prompt('Plugin payload cancellation',{defaultValue:'must-not-send'});}});` : "") + (editorMode ? editorTagSource : "");
      sourceB += oauthFixture?.source(helperRequestId, collection) ?? "";
      sourceB += grpcFixture?.source(helperRequestId, collection) ?? "";
      if (appInfoMode) sourceB += pluginAppInfoSource;
      if (domOwnerMode) sourceB += pluginDomOwnerNativeSource(helperRequestId);
      if (domTerminalMode) sourceB += pluginDomTerminalNativeSource(requestId+'_terminal_helper');
      if (domCollectionsMode) sourceB += pluginDomCollectionsNativeSource();
      if (domTokensMode) sourceB += pluginDomTokensNativeSource();
      if (domDatasetMode) sourceB += pluginDomDatasetNativeSource();
      for (const [index, source] of [sourceA, sourceB].entries()) {
        const directory = join(root, index === 0 ? "a" : "b");
        await mkdir(directory, { recursive: true });
        directories.push(directory);
        for (const [file, text] of Object.entries({
          "package.json": JSON.stringify({
            name: names[index],
            version: "1.0.0",
            insomnia: {},
            main: "index.js",
          }),
          "index.js": source,
        })) {
          const path = join(directory, file);
          await Bun.write(path, text);
          files.push({ path, text });
        }
      }
      const seed = structuredClone(original);
      seed.resources.push(
        {
          _id: collection,
          _type: "workspace",
          parentId: null,
          name: "Plugin render fixture",
          scope: "collection",
        },
        {
          _id: "env_" + collection,
          _type: "environment",
          parentId: collection,
          name: "Base Environment",
          data: {
            scope: "base",
            derived: "{% dup %}",
            ...(editorMode ? { tag: editorTemplate } : {}),
          },
        },
        newRequest(collection, {
          _id: requestId,
          name: "Plugin render request",
          method: "POST",
          url: `http://127.0.0.1:${server.port}/render`,
          body: { mimeType: "text/plain", text: "" },
          settingSendCookies: false,
          settingStoreCookies: false,
        }),
      );
      seed.activeWorkspaceId = collection;
      if (helperMode) seed.resources.push(newRequest(collection, {
        _id: helperRequestId, name: "Helper saved request", method: "POST",
        url: `http://127.0.0.1:${server.port}/helper`,
        body: { mimeType: "text/plain", text: "{% extrainfo %}" },
        settingSendCookies: false, settingStoreCookies: false,
      }));
      if(domNestedMode)seed.resources.push(newRequest(collection,{_id:requestId+"_dialog_child",name:"Dialog dependent request",method:"POST",url:`http://127.0.0.1:${server.port}/dialog-child`,body:{mimeType:"text/plain",text:"{% ownednativedialog %}"},settingSendCookies:false,settingStoreCookies:false}));
      if(domTerminalMode)seed.resources.push(newRequest(collection,{_id:requestId+'_terminal_helper',name:'Terminal held helper',method:'POST',url:`http://127.0.0.1:${server.port}/dom-terminal-helper-held`,body:{mimeType:'text/plain',text:'terminal-helper'},settingSendCookies:false,settingStoreCookies:false}));
      if(domStreamFixture)for(const protocol of /** @type {const} */(["websocket","sse"]))seed.resources.push(newRequest(collection,{_id:requestId+"_dialog_"+protocol,name:protocol==="websocket"?"Dialog stream socket":"Dialog event stream",_type:protocol==="websocket"?"websocket_request":"request",method:"GET",responseMode:protocol==="sse"?"sse":undefined,url:domStreamFixture.url(protocol),settingSendCookies:false,settingStoreCookies:false}));
      if (protocolMode) seed.resources.push(
        newRequest(collection,{_id:socketRequestId,_type:"websocket_request",name:"Plugin helper socket",
          url:`ws://127.0.0.1:${server.port}/ws`,activePayloadId:socketPayloadId,
          settingSendCookies:false,settingStoreCookies:false}),
        {_id:socketPayloadId,_type:"websocket_payload",parentId:socketRequestId,name:"Helper payload",
          mode:"text/plain",value:"{% messagehelper %}"},
      );
      seed.activeRequestId = requestId;
      if (oauthFixture) seed.resources.push(...oauthFixture.resources(collection, oauthRequestId));
      if (grpcFixture) seed.resources.push(...grpcFixture.resources(collection, requestId + "_grpc"));
      seed.activeEnvironmentId = "";
      seed.openTabs = [requestId];
      seed.settings.pluginDirectories = directories;
      seed.settings.pluginPathMigrationVersion = 1;
      seed.settings.pluginConfig = {
        ...seed.settings.pluginConfig,
        [names[0]]: { disabled: false },
        [names[1]]: { disabled: false },
      };
      const preferences = async () => {
        await page
          .getByRole("button", { name: "Preferences", exact: true })
          .first()
          .click();
        await page.getByRole("tab", { name: "Plugins", exact: true }).click();
        await page.waitForFunction(
          () =>
            document
              .querySelector(".plugins-panel")
              ?.getAttribute("aria-busy") === "false",
        );
      };
      const card = (/** @type {string} */ name) =>
        page
          .locator(".plugin-card")
          .filter({ has: page.getByRole("heading", { name, exact: true }) });
      const closePreferences = () =>
        page
          .getByRole("button", { name: "Close Preferences", exact: true })
          .click();
      const load = async (/** @type {string} */ name) => {
        await card(name)
          .getByRole("button", { name: "Load plugin", exact: true })
          .click();
        await card(name).getByText(readyText, { exact: true }).waitFor();
      };
      const body = async (/** @type {string} */ text) => {
        await page.getByRole("tab", { name: "Body", exact: true }).click();
        await page
          .locator(".request-editor .CodeMirror")
          .first()
          .evaluate(
            (el, text) => /** @type {any} */ (el).CodeMirror.setValue(text),
            text,
          );
        await poll(
          async () =>
            (await invoke("load_workspace")).resources.find(
              (/** @type {any} */ r) => r._id === requestId,
            ).body.text === text,
          "Saved body edit",
        );
      };
      const settled = () =>
        poll(
          async () =>
            (await page
              .getByRole("button", { name: "Cancel", exact: true })
              .count()) === 0,
          "Plugin template Send settles",
          60000,
        );
      const send = async (/** @type {string|null} */ expected) => {
        const before = wire.length;
        await page.getByRole("button", { name: "Send", exact: true }).click();
        if (expected !== null)
          await poll(
            () => Promise.resolve(wire.length > before),
            "Actual native plugin-render wire",
            60000,
          );
        else await page.getByText("Request failed", { exact: true }).waitFor();
        await settled();
        if (expected === null) assert.equal(wire.length, before);
        else {
          assert.equal(wire.length, before + 1);
          assert.equal(wire.at(-1).body, expected);
          assert.equal(wire.at(-1).method, "POST");
        }
        observations.push({
          source: (await invoke("load_workspace")).resources.find(
            (/** @type {any} */ r) => r._id === requestId,
          ).body.text,
          expected,
          wireCount: wire.length,
        });
      };
      try {
        if (cookieMode) {
          const cookieFiles = [collection + ".json", collection + ".previous.json"];
          for (const name of cookieFiles)
            assert.equal(await Bun.file(join(storeRoot, "cookies", name)).exists(), false,
              "Owned fixture cookie file must not pre-exist");
          await Bun.write(join(output, "cookie-fixture.json"), JSON.stringify({ collection, cookieFiles }, null, 2));
          await invoke("change_cookie", {
            workspaceId: collection, url: "https://api.example.test/cookie/child",
            raw: "owned_host=host-value; Secure; HttpOnly", previous: null, clear: false,
          });
          await invoke("change_cookie", {
            workspaceId: collection, url: "https://api.example.test/cookie/child",
            raw: "owned_suffix=suffix-value; Domain=example.test; Path=/explicit; Expires=Wed, 21 Oct 2037 07:28:00 GMT",
            previous: null, clear: false,
          });
          await invoke("change_cookie", {
            workspaceId: collection, url: "https://api.example.test/cookie/child",
            raw: "owned_expiry=expired-value; Max-Age=1", previous: null, clear: false,
          });
          const initialCookies = await invoke("snapshot_request_cookies", { workspaceId: collection, includeExpired: true });
          expiredCookieExpiry = initialCookies.cookies.find((/** @type {any} */ item) => item.key === "owned_expiry")?.expires?.AtUtc;
          assert.equal(typeof expiredCookieExpiry, "string");
          assert.ok(Number.isFinite(Date.parse(expiredCookieExpiry)));
          await page.waitForTimeout(Math.max(0, Date.parse(expiredCookieExpiry) - Date.now()) + 250);
          const expiryProbes = /** @type {{at:number,cookies:number,includesExpired:boolean}[]} */ ([]);
          try {
            await poll(async () => {
              const observed = await invoke("snapshot_request_cookies", { workspaceId: collection });
              const includesExpired = observed.cookies.some((/** @type {any} */ item) => item.key === "owned_expiry");
              expiryProbes.push({ at: Date.now(), cookies: observed.cookies.length, includesExpired });
              return !includesExpired;
            }, "Native cookie expiry observed", 5000);
          } finally {
            await Bun.write(join(output, "cookie-expiry-probes.json"), JSON.stringify(expiryProbes, null, 2));
          }
          const normal = await invoke("snapshot_request_cookies", { workspaceId: collection });
          const model = await invoke("snapshot_request_cookies", { workspaceId: collection, includeExpired: true });
          assert.equal(normal.cookies.length, 2);
          assert.equal(normal.cookies.some((/** @type {any} */ item) => item.key === "owned_expiry"), false);
          assert.equal(model.cookies.length, 3);
          await Bun.write(join(output, "cookie-expiry-control.json"), JSON.stringify({ expiredCookieExpiry, observedAt: Date.now(), normal, model, expiryProbes }, null, 2));
        }
        await invoke("save_workspace", { data: seed });
        await page.reload();
        await page.locator(".app-shell").waitFor();
        await installPluginWorkerProbe(page);
        await preferences();
        await load(names[1]);
        await load(names[0]);
        await closePreferences();
        if (editorMode) {
          const editor = await exerciseTemplateTagEditorNative({
            page,
            invoke,
            output,
            requestId,
            collection,
            plugin: names[1],
            body,
            send,
            reload: async () => {
              await preferences();
              await load(names[1]);
              await closePreferences();
            },
          });
          checks.push(...editor.checks);
          observations.push(...editor.observations);
        } else {
          if (helperMode) {
            await body("{% workspacehelper %}");
            const before = wire.length;
            await page.getByRole("button", { name: "Send", exact: true }).click();
            const dialog = page.getByRole("dialog", { name: "Plugin workspace helper", exact: true });
            await dialog.waitFor();
            await dialog.getByRole("button", { name: "Submit", exact: true }).click();
            await poll(() => Promise.resolve(wire.length === before + 2), "Actual helper and root native wire", 60000);
            await settled();
            const sent = wire.slice(before);
            assert.equal(new URL(sent[0].url).pathname, "/helper");
            assert.equal(sent[0].body, "from-extra");
            const summary = JSON.parse(sent[1].body);
            assert.equal(summary.prompted, "accepted");
            assert.equal(summary.jarStable, true);
            assert.equal(summary.parentId, collection);
            assert.equal(summary.cookies, cookieMode ? 3 : 0);
            if (cookieMode) {
              assert.deepEqual([...summary.cookieModels].sort((a, b) => a.key.localeCompare(b.key)), [
                { key: "owned_expiry", value: "expired-value", domain: "api.example.test", path: "/cookie",
                  pathIsDefault: true, hostOnly: true, expires: expiredCookieExpiry, secure: false, httpOnly: false },
                { key: "owned_host", value: "host-value", domain: "api.example.test", path: "/cookie",
                  pathIsDefault: true, hostOnly: true, expires: "Infinity", secure: true, httpOnly: true },
                { key: "owned_suffix", value: "suffix-value", domain: "example.test", path: "/explicit",
                  pathIsDefault: false, hostOnly: false, expires: "2037-10-21T07:28:00Z", secure: false, httpOnly: false },
              ]);
            }
            assert.equal(summary.version, "HTTP/1.1");
            assert.equal(summary.bytes, Buffer.byteLength("plugin-render-accepted"));
            assert.equal(summary.body, "plugin-render-accepted");
            assert.equal(summary.latestMatches, true);
            assert.equal(summary.latestBody, summary.body);
            const persisted = await invoke("load_workspace");
            const jars = persisted.resources.filter((/** @type {any} */ item) => item._type === "cookie_jar" && item.parentId === collection);
            assert.equal(jars.length, 1);
            assert.equal(jars[0]._id, summary.jarId);
            assert.ok(persisted.history.some((/** @type {any} */ entry) => entry.requestId === helperRequestId && entry.httpVersion === "HTTP/1.1"));
            checks.push("Actual workspace helpers: saved-ID native send/extra info/model/body/history/cookie jar/genuine Prompt");
            observations.push({ helper: summary, nativeWire: sent });
          }
          if (protocolMode) {
            await page.getByRole("complementary",{name:"Collections"})
              .getByRole("button",{name:"WS Plugin helper socket",exact:true}).click();
            const before=wire.length;
            await page.getByRole("button",{name:"Connect and send",exact:true}).click();
            await poll(async()=>socketMessages.length===1 ||
              (await page.locator(".inline-error").filter({hasText:"TemplateRenderError"}).count())>0,
              "Initial payload helper native WebSocket",60000);
            if(socketMessages.length!==1) throw Error("Initial plugin payload failed: "+
              await page.locator(".inline-error").filter({hasText:"TemplateRenderError"}).first().innerText());
            assert.equal(socketMessages[0],"payload:plugin-render-accepted");
            assert.equal(wire.length,before+1);assert.equal(wire.at(-1).body,"from-extra");
            checks.push("WebSocket initial payload captures actual workspace helper/native nested HTTP/extra info/body");
            await page.getByRole("button",{name:"Send message",exact:true}).click();
            await poll(()=>Promise.resolve(socketMessages.length===2),"Connected payload helper native WebSocket",60000);
            assert.equal(socketMessages[1],socketMessages[0]);assert.equal(wire.length,before+2);
            assert.equal(wire.at(-1).body,"from-extra");
            checks.push("Connected WebSocket payload retains root owner and actual workspace helpers");
            await Bun.write(join(output,"protocol-intermediate.json"),JSON.stringify({socketMessages:[...socketMessages],socketConnections,nativeHttp:wire.slice(before)},null,2));
            await page.getByRole("textbox",{name:"WebSocket message",exact:true}).fill("{% payloadprompt %}");
            await poll(async()=>(await invoke("load_workspace")).resources.find((/** @type {any} */ r)=>r._id===socketPayloadId)?.value==="{% payloadprompt %}","Saved prompt payload");
            await page.getByRole("button",{name:"Send message",exact:true}).click();
            const prompt=page.getByRole("dialog",{name:"Plugin payload cancellation",exact:true});
            await prompt.waitFor();
            // showModal makes the underlying UI inert. Dispatch the actual
            // button handler to exercise owner Abort while its dialog is open.
            await page.locator("button.send-button").filter({hasText:"Disconnect"})
              .evaluate(element=>/** @type {HTMLButtonElement} */ (element).click());
            await prompt.waitFor({state:"detached"});
            await page.getByRole("button",{name:"Connect",exact:true}).waitFor();
            assert.equal(socketMessages.length,2);assert.equal(wire.length,before+2);assert.equal(socketConnections,1);
            checks.push("Disconnect cancels real plugin payload prompt without wire leakage");
            const protocolEvidence={socketMessages:[...socketMessages],socketConnections,nativeHttp:wire.slice(before),
              cancellationMethod:"Programmatic real Disconnect button handler while showModal blocks pointer input",
              automaticCatalogRecoveryProven:false};
            await Bun.write(join(output,"protocol-cancellation.json"),JSON.stringify(protocolEvidence,null,2));
            observations.push({pluginProtocols:protocolEvidence});
            // The next ordinary native Send must work without reloading plugins.
            // Abort retires the worker, while its admitted catalog stays available.
            await page.getByRole("complementary",{name:"Collections"})
              .getByRole("button",{name:"POST Plugin render request",exact:true}).click();
          }
          await body(
            ["dup", "internal", ...publicNames]
              .map((name) => "{% " + name + " %}")
              .join("|"),
          );
          await send(["B", "internal-last", ...publicNames].join("|"));
          if (protocolMode) {
            const evidence = observations.find(row => row.pluginProtocols)?.pluginProtocols;
            assert.ok(evidence);
            evidence.automaticCatalogRecoveryProven = true;
            evidence.recoveryResponse = ["B", "internal-last", ...publicNames].join("|");
            await Bun.write(join(output,"protocol-cancellation.json"),JSON.stringify(evidence,null,2));
          }
          checks.push(
            "discovery order wins over reversed Load and priority; internal duplicate and Unicode/symbol names",
          );
          await body('{% context false, 0, "", _.scope %}');
          await send(
            JSON.stringify({
              args: [false, 0, "", "base"],
              scope: "base",
              alias: "base",
              derived: "B",
              meta: { requestId, workspaceId: collection },
              purpose: "send",
            }),
          );
          checks.push(
            "actual inherited environment and legacy helper context/meta/purpose",
          );
          await body("{% args -0, 0/0, 1/0, missing %}");
          await send(
            '{"negativeZero":true,"nan":true,"infinity":true,"undefined":true}',
          );
          checks.push(
            "bounded argument codec preserves signed zero, nonfinite and undefined through both real workers",
          );
          await body(
            [
              "false",
              "zero",
              "null",
              "undefined",
              "bigint",
              "nan",
              "infinity",
              "array",
              "object",
              "regex",
              "map",
              "set",
              "bytes",
            ]
              .map((kind) => `{% value "${kind}" %}`)
              .join("|"),
          );
          await send(
            "false|0|||12345678901234567890|NaN|Infinity|a,,b|[object Object]|/owned/gi|[object Map]|[object Set]|1,2,255",
          );
          checks.push(
            "Nunjucks output coercion preserves non-JSON callback values",
          );
          await body(
            '{% base64 "encode", "normal", "hello" %}|{% request "name" %}|{% persist %}',
          );
          await send("aGVsbG8=|Plugin render request|stored");
          checks.push(
            "built-in local/native collisions protected and real durable store bridge",
          );
          await preferences();
          await card(names[1])
            .getByRole("button", { name: "Unload plugin", exact: true })
            .click();
          await closePreferences();
          await body("{% dup %}");
          await send("A-last");
          checks.push(
            "Unload removes winner and uses remaining loaded definition",
          );
          await preferences();
          await card(names[0])
            .getByRole("button", { name: "Disable plugin", exact: true })
            .click();
          await closePreferences();
          await send(null);
          checks.push("Disabled/unloaded definitions cannot dispatch or send");
          await preferences();
          await card(names[0])
            .getByRole("button", { name: "Enable plugin", exact: true })
            .click();
          await load(names[0]);
          await load(names[1]);
          await closePreferences();
          for (const mode of ["cancel", "request-edit", "unload", "disable"]) {
            await body("{% hold %}");
            const before = wire.length;
            const boundary = await withIpcSuccessHook(
              page,
              "plugin_store",
              async () => {
                if (mode === "cancel")
                  await page
                    .getByRole("button", { name: "Cancel", exact: true })
                    .click();
                else if (mode === "request-edit")
                  await page
                    .getByLabel("Request URL", { exact: true })
                    .fill(`http://127.0.0.1:${server.port}/edited`);
                else {
                  await preferences();
                  await card(names[1])
                    .getByRole("button", {
                      name:
                        mode === "unload" ? "Unload plugin" : "Disable plugin",
                      exact: true,
                    })
                    .click();
                  await closePreferences();
                }
              },
              async () => {
                await send(null);
              },
            );
            assert.equal(boundary.calls, 1);
            assert.equal(boundary.hooks, 1);
            assert.equal(wire.length, before);
            const forbidden = await invoke("plugin_store", {
              plugin: names[1],
              operation: { action: "hasItem", key: "forbidden" },
            });
            assert.equal(forbidden, false);
            observations.at(-1).boundary = {
              mode,
              calls: boundary.calls,
              hooks: boundary.hooks,
              forbidden,
            };
            checks.push(
              "held native reply " +
                mode +
                " prevents result/network and subsequent write",
            );
            await preferences();
            if (mode === "disable")
              await card(names[1])
                .getByRole("button", { name: "Enable plugin", exact: true })
                .click();
            await load(names[1]);
            await closePreferences();
          }
          await body("{% throwing %}");
          await send(null);
          await preferences();
          await card(names[1])
            .getByText("owned plugin failure", { exact: true })
            .waitFor();
          await load(names[1]);
          await closePreferences();
          await body("{% dup %}");
          await send("B");
          checks.push(
            "Guest callback error marks closed registry session and explicit Reload recovers",
          );
        }
        if (grpcFixture) {
          const evidence = await grpcFixture.exercise({page,invoke,id:requestId+"_grpc",output,mainWire:wire,domOwner:domOwnerMode});
          checks.push(...evidence.checks);
          observations.push({pluginGrpc:evidence});
          await page.getByRole("complementary",{name:"Collections"}).getByRole("button",{name:"POST Plugin render request",exact:true}).click();
        }
        if (oauthFixture) {
          const evidence = await oauthFixture.exercise({page,invoke,output,id:oauthRequestId,helper:helperRequestId,mainWire:wire});
          checks.push(...evidence.checks);
          observations.push({pluginOAuth:evidence});
          await page.getByRole("complementary",{name:"Collections"}).getByRole("button",{name:"POST Plugin render request",exact:true}).click();
        }
        if (appInfoMode) {
          const evidence=await exercisePluginAppInfoNative({invoke,output,body,send,wire});
          checks.push(...evidence.checks);
          observations.push({pluginAppInfo:evidence});
          await body("{% dup %}");
        }
        if (domOwnerMode) {
          const evidence=await exercisePluginDomOwnerHttpNative({page,wire,output,body,send});
          checks.push(...evidence.checks);observations.push({pluginDomOwner:evidence});
          await body("{% dup %}");
        }
        if(domNestedMode){
          const evidence=await exercisePluginDomNestedOwnerNative({page,invoke,output,body,send,wire,requestId,childId:requestId+"_dialog_child",baseUrl:`http://127.0.0.1:${server.port}`,releaseHeld:()=>heldRoots.forEach(release=>release())});
          checks.push(...evidence.checks);observations.push({pluginDomNested:evidence});await body("{% dup %}");
        }
        if(domStreamFixture){
          const evidence=await exercisePluginDomStreamOwnerNative({page,invoke,output,wire,fixture:domStreamFixture,ids:{websocket:requestId+"_dialog_websocket",sse:requestId+"_dialog_sse"},rootId:requestId});
          checks.push(...evidence.checks);observations.push({pluginDomStream:evidence});await body("{% dup %}");
        }
        if(domTerminalMode){
          const evidence=await exercisePluginDomTerminalOwnerNative({page,invoke,output,wire,requestId,plugin:names[1],baseUrl:`http://127.0.0.1:${server.port}`,body,releaseHeld:()=>heldRoots.forEach(release=>release())});
          checks.push(...evidence.checks);observations.push({pluginDomTerminal:evidence});await body('{% dup %}');
        }
        if(domCollectionsMode){
          const evidence=await exercisePluginDomCollectionsNative({page,output,wire,body,send});
          checks.push(...evidence.checks);observations.push({pluginDomCollections:evidence});await body('{% dup %}');
        }
        if(domTokensMode){
          const evidence=await exercisePluginDomTokensNative({page,output,wire,body,send});
          checks.push(...evidence.checks);observations.push({pluginDomTokens:evidence});await body('{% dup %}');
        }
        if(domDatasetMode){
          const evidence=await exercisePluginDomDatasetNative({page,output,wire,body,send});
          checks.push(...evidence.checks);observations.push({pluginDomDataset:evidence});await body('{% dup %}');
        }
        await preferences();
        for (const name of names)
          await card(name)
            .getByRole("button", { name: "Unload plugin", exact: true })
            .click();
        await closePreferences();
        records.push(...(await pluginWorkerRecords(page)));
        assert.ok(records.every((record) => record.terminated));
        const workers = [];
        for (const prefix of ["plugin.worker-", "template.worker-"]) {
          const { readdir } = await import("node:fs/promises");
          const name = (await readdir("build/_app/immutable/workers")).find(
            (name) => name.startsWith(prefix),
          );
          assert.ok(name);
          const path = join("build/_app/immutable/workers", name),
            url = new URL("/_app/immutable/workers/" + name, page.url()).href;
          const embedded = await page.evaluate(
            async (url) => (await fetch(url)).text(),
            url,
          );
          const sha256 = createHash("sha256")
            .update(await readFile(path))
            .digest("hex");
          assert.equal(
            createHash("sha256").update(embedded).digest("hex"),
            sha256,
          );
          workers.push({ path, url, sha256 });
        }
        const actual = await invoke("load_workspace");
        assert.equal(
          actual.resources.find((/** @type {any} */ r) => r._id === requestId)
            .body.text,
          "{% dup %}",
        );
        assert.equal(
          actual.resources.find(
            (/** @type {any} */ r) => r._id === "env_" + collection,
          ).data.derived,
          "{% dup %}",
        );
        for (const file of files)
          assert.equal(await readFile(file.path, "utf8"), file.text);
        await invoke("save_workspace", { data: original });
        const restored = await invoke("load_workspace");
        assert.deepEqual(restored, original);
        await Bun.write(
          join(output, "acceptance.json"),
          JSON.stringify(
            {
              passed: true,
              checks,
              observations,
              wire,
              records,
              workers,
              files,
              original,
              restored,
              actual,
              requestId,
              collection,
            },
            null,
            2,
          ),
        );
      } finally {
        await restorePluginWorkerProbe(page);
        await invoke("save_workspace", { data: original });
        assert.deepEqual(await invoke("load_workspace"), original);
      }
    },
  );
} finally {
  heldRoots.forEach(release=>release());
  domStreamFixture?.stop();
  server.stop(true);
  oauthFixture?.stop();
  grpcFixture?.stop();
  if (originalStore) {
    await writeFile(storePath, originalStore);
    assert.deepEqual(await readFile(storePath), originalStore);
  } else {
    await unlink(storePath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    assert.equal(await Bun.file(storePath).exists(), false);
  }
}
