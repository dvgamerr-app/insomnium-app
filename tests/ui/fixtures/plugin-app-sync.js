import { openPluginSession } from "../../../src/lib/plugin-session.js";

const source = `let old;
const app=(c,gen)=>c.app;
exports.templateTags=[{name:'sync',run(c,gen){const a=app(c,gen);old=a;const info=a.getInfo();info.version='edited';const path=a.getPath('DeSkTop');const first=a.clipboard.readText();const wrote=a.clipboard.writeText('ไทย😀');const second=a.clipboard.readText();const cleared=a.clipboard.clear();const empty=a.clipboard.readText();const outside=a.clipboard.readText();return {info:a.getInfo(),path,first,second,empty,outside,sync:!(first instanceof Promise)&&wrote===undefined&&cleared===undefined,frozen:Object.isFrozen(a.clipboard)};}},
{name:'old',run(){try{return old.clipboard.readText();}catch(e){return e.message;}}},
{name:'invalid',run(c,gen){const a=app(c,gen),errors=[];for(const f of [()=>a.getPath('home'),()=>a.clipboard.writeText(42),()=>__pluginSyncCall(JSON.stringify({generation:gen,call:__pluginValueCodec.encode({method:'network.sendRequest',args:[]})}))]){try{f();errors.push('leaked');}catch(e){errors.push(e.message);}}return errors;}},
{name:'read',run(c,gen){try{const value=app(c,gen).clipboard.readText();return {length:value.length,start:value.slice(0,5),end:value.slice(-5)};}catch(e){return {error:e.message};}}},
{name:'readcpu',run(c,gen){app(c,gen).clipboard.readText();while(true){}}}];`;
/** @type {Awaited<ReturnType<typeof openPluginSession>>|undefined} */ let session;
/** @type {AbortController|undefined} */ let controller;
/** @type {Promise<any>|undefined} */ let result;
/** @type {((value:any)=>void)|undefined} */ let release;
/** @type {SharedArrayBuffer[]} */ const buffers = [];
/** @type {any[]} */ const calls = [];
/** @type {any[]} */ const records = [];
let alive = true,
  mode = "normal",
  generation = 0,
  clipboard = "original",
  reads = 0;
/** @type {any} */ (window).__pluginAppSyncFixture = {
  calls,
  records,
  /** @param {string} url @param {string} [nextMode] */
  async open(url, nextMode = "normal") {
    session?.close();
    controller?.abort();
    controller = new AbortController();
    alive = true;
    mode = nextMode;
    generation = 0;
    calls.length = 0;
    records.length = 0;
    buffers.length = 0;
    release = undefined;
    clipboard = "original";
    reads = 0;
    session = await openPluginSession(
      {
        name: "insomnia-plugin-app-sync-fixture",
        entry: "index.js",
        format: "commonjs",
        files: { "index.js": source },
      },
      {
        isCurrent: () => alive,
        createWorker: () => {
          const worker = new Worker(url, { type: "module" }),
            record = { terminated: false };
          records.push(record);
          worker.addEventListener("message", (event) => {
            if (event.data.type === "sync-helper")
              buffers.push(event.data.buffer);
          });
          const terminate = worker.terminate.bind(worker);
          worker.terminate = () => {
            record.terminated = true;
            terminate();
          };
          return worker;
        },
      },
    );
  },
  /** @param {number} index @param {boolean} [tamper] */
  invoke(index, tamper = false) {
    const operation = {
      signal: controller?.signal,
      isCurrent: () => alive && !controller?.signal.aborted,
      helperCall: async () => {
        throw Error("No asynchronous helper in this synchronous scenario");
      },
      syncCall: async (/** @type {{method:string,args:any[]}} */ call) => {
        calls.push(call);
        if (mode === "slow")
          await new Promise((resolve) => setTimeout(resolve, 2500));
        if (mode === "held")
          await new Promise((resolve) => {
            release = resolve;
          });
        controller?.signal.throwIfAborted();
        if (!alive) throw new DOMException("Lost owner", "AbortError");
        if (mode === "error") throw Error("controlled clipboard failure");
        if (call.method === "app.getInfo")
          return { version: "9.1.0", platform: "win32" };
        if (call.method === "app.getPath") return "C:/Users/probe/Desktop";
        if (call.method === "app.clipboard.readText") {
          if (mode === "large") return "ไทย😀".repeat(20000);
          if (mode === "oversized") return "X".repeat(2 * 1024 * 1024);
          if (++reads === 4) clipboard = "outside-new";
          return clipboard;
        }
        if (call.method === "app.clipboard.writeText") clipboard = call.args[0];
        else if (call.method === "app.clipboard.clear") clipboard = "";
        else throw Error("Unexpected app call");
      },
    };
    const promise = session?.invoke(
      "templateTags",
      index,
      [++generation],
      operation,
    );
    if (tamper)
      operation.syncCall = async () => {
        throw Error("Replaced caller endpoint");
      };
    return promise;
  },
  /** @param {number} [index] */
  start(index = 3) {
    result = /** @type {any} */ (window).__pluginAppSyncFixture
      .invoke(index)
      .then(
        (/** @type {any} */ value) => ({ value }),
        (/** @type {Error} */ error) => ({
          error: String(error),
          name: error.name,
        }),
      );
  },
  result: () => result,
  mode(/** @type {string} */ value) {
    mode = value;
  },
  cancel() {
    controller?.abort();
  },
  invalidate() {
    alive = false;
  },
  release() {
    release?.("late");
  },
  states: () =>
    buffers.map((buffer) => Array.from(new Int32Array(buffer, 0, 4))),
  async preflight() {
    const failures = [];
    for (const op of [
      { syncCall: async () => null },
      { syncCall: async () => null, isCurrent: () => true },
    ]) {
      try {
        await session?.invoke("templateTags", 0, [], op);
        failures.push("leaked");
      } catch (e) {
        failures.push(String(e));
      }
    }
    return failures;
  },
  close() {
    session?.close();
    controller?.abort();
    release?.("late");
  },
};
