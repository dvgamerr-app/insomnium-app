import { mount } from "svelte";
import { initialData } from "../../../src/lib/model.js";
import "../../../src/lib/styles/index.css";

const owner = /** @type {any} */ (window);
const data = initialData();
const fixture = {
  calls: /** @type {{command:string,args:any}[]} */ ([]),
  importMode: "",
  restored: false,
  saves: 0,
  saved: /** @type {any} */ (null),
  failNextLoad: false,
  failNextSave: false,
  holdNextSave: false,
  invalidBackup: false,
  streamChannel: /** @type {any} */ (null),
  rejectStream: /** @type {any} */ (null),
  failStreamAck: false,
  loaded: /** @type {any} */ (null),
};
owner.workspaceRecoveryFixture = fixture;
owner.isTauri = true;
owner.__TAURI_INTERNALS__ = {
  transformCallback() { return 1; },
  unregisterCallback() {},
  async invoke(/** @type {string} */ command, /** @type {any} */ args = {}) {
    fixture.calls.push({ command, args });
    if (command === "plugin:dialog|open") return fixture.importMode === "multi" ? ["/owned/insomnia.workspace.db","/owned/insomnia.request.db"] : ["/owned/collection.json"];
    if (command === "plugin:fs|stat") return {isFile:true,isDirectory:false,isSymlink:false,size:fixture.importMode === "oversize" ? 64 * 1024 * 1024 + 1 : 20,mtime:null,atime:null,birthtime:null};
    if (command === "plugin:fs|open") { owner.importReadOffset=0;owner.importReadPath=args.path;return 31; }
    if (command === "plugin:fs|fstat") return {isFile:fixture.importMode !== "not-regular",isDirectory:false,isSymlink:false,size:fixture.importMode === "grown-before-open" ? 64 * 1024 * 1024 + 1 : 20,mtime:null,atime:null,birthtime:null};
    if (command === "plugin:resources|close") return;
    if (command === "plugin:fs|read") {
      if (fixture.importMode === "read-failure") throw new Error("Controlled read failure");
      if (fixture.importMode === "cancel") owner.importController.abort();
      const record = fixture.importMode === "multi"
        ? owner.importReadPath.endsWith('workspace.db') ? {_id:'wrk_test',type:'Workspace',name:'Owned',parentId:null} : {_id:'req_test',type:'Request',name:'Owned',parentId:'wrk_test',url:'https://owned.invalid'}
        : {resources:[{_id:'wrk_test',_type:'workspace',name:'ไทย',parentId:null}]};
      const content = fixture.importMode === "invalid" ? [0x7b,0x22,0xc3,0x28,0x22,0x7d] : [...new TextEncoder().encode(JSON.stringify(record))];
      const count = fixture.importMode === "grown-during-read" ? args.len : Math.min(args.len,fixture.importMode === "partial" ? 2 : args.len,Math.max(0,content.length-owner.importReadOffset));
      const bytes = fixture.importMode === "grown-during-read" ? new Uint8Array(count).fill(65) : Uint8Array.from(content.slice(owner.importReadOffset,owner.importReadOffset+count));
      owner.importReadOffset += count;
      const trailer = new Uint8Array(8);new DataView(trailer.buffer).setBigUint64(0,BigInt(count));
      const result = new Uint8Array(count+8);result.set(bytes);result.set(trailer,count);return result;
    }
    if (command === "load_workspace") {
      if (fixture.failNextLoad) {
        fixture.failNextLoad = false;
        return new Promise((_, reject) => {
          owner.failPendingWorkspaceLoad = () => reject(new Error("Controlled reload failure"));
        });
      }
      if (!fixture.restored) return { ...structuredClone(data), settings: ["damaged"] };
      return structuredClone(fixture.loaded || data);
    }
    if (command === "inspect_workspace_backup")
      return {
        data: fixture.invalidBackup ? { ...structuredClone(data), settings: ["damaged backup"] } : structuredClone(data),
        primarySha256: "a".repeat(64),
        backupSha256: "b".repeat(64),
      };
    if (command === "restore_workspace_backup") {
      fixture.restored = true;
      return "/owned/workspace-v1.damaged-fixture.json";
    }
    if (command === "connect_stream") {
      fixture.streamChannel = args.onEvent;
      return new Promise((_, reject) => { fixture.rejectStream = reject; });
    }
    if (command === "acknowledge_stream") {
      if (fixture.failStreamAck && args.sequence === 1) throw new Error("Controlled ACK failure");
      return;
    }
    if (command === "cancel_http") return;
    if (command === "save_workspace") {
      fixture.saves++;
      if (fixture.saves === 1 || fixture.failNextSave) { fixture.failNextSave=false; throw new Error("Controlled save failure"); }
      if (fixture.holdNextSave) { fixture.holdNextSave=false; await new Promise(resolve=>{owner.releasePendingSave=resolve;}); delete owner.releasePendingSave; }
      fixture.saved = structuredClone(args.data);
      return;
    }
    throw new Error("Unexpected recovery fixture IPC: " + command);
  },
};
owner.pickImportFixture = async (/** @type {string} */ mode) => {
  const {pickImport} = await import("../../../src/lib/import-export.js");
  fixture.importMode = mode;owner.importController = new AbortController();const before=fixture.calls.length;
  try { const result=await pickImport(owner.importController.signal);return {ok:true,workspaces:result?.resources.filter(row=>row._type==="workspace").length,requests:result?.requests,workspaceName:result?.resources.find(row=>row._type==="workspace")?.name,commands:fixture.calls.slice(before).map(call=>call.command)}; }
  catch(error){return {ok:false,error:String(error),commands:fixture.calls.slice(before).map(call=>call.command)};}
};
void import("./workspace-recovery.svelte")
  .then(({ default: Fixture }) => {
    mount(Fixture, { target: document.body });
    owner.workspaceRecoveryFixtureReady = true;
  })
  .catch((error) => {
    owner.workspaceRecoveryFixtureError = String(error);
  });
