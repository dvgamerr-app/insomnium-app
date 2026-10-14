import { invoke } from "@tauri-apps/api/core";
import { openPluginSession } from "../../../src/lib/plugin-session.js";
import { createPluginHelperDispatcher } from "../../../src/lib/plugin-helper-dispatcher.js";

const source = `exports.templateTags=[{name:'metadata',async run(c,id){
const select=r=>({httpVersion:r.httpVersion,bytesRead:r.bytesRead,bytesContent:r.bytesContent,bodyBase64:c.util.models.response.getBodyBuffer(r).toString('base64')});
const response=await c.network.sendRequest({_id:id});const sent=select(response);response.bytesRead=-999;
const latest=await c.util.models.response.getLatestForRequestId(id);return {sent,latest:select(latest),detached:response!==latest};
}},{name:'savedMetadata',async run(c,id){const r=await c.util.models.response.getLatestForRequestId(id,null);return {httpVersion:r.httpVersion,bytesRead:r.bytesRead,bytesContent:r.bytesContent,bodyBase64:c.util.models.response.getBodyBuffer(r).toString('base64')};}}];`;
const records = /** @type {{terminated:boolean,index:number}[]} */ ([]);
/** @type {any} */ (window).__pluginMetadataNative = {
  records,
  /** @param {string} url @param {Record<string,any>} input @param {string} id @param {boolean} [readSaved] */
  async run(url, input, id, readSaved = false) {
    const controller = new AbortController();
    let alive = true;
    const data = readSaved ? /** @type {any} */ (await invoke("load_workspace")) : { resources: [{ _type: "workspace", _id: "metadata-fixture", parentId: null }, { _type: "request", _id: id, parentId: "metadata-fixture" }], history: /** @type {Record<string,any>[]} */ ([]) };
    const current = () => alive && !controller.signal.aborted;
    const dispatcher = createPluginHelperDispatcher({
      plugin: "insomnia-plugin-native-metadata", signal: controller.signal, isCurrent: current, getData: () => data,
      render: async () => { throw Error("Unexpected render operation"); },
      cookieJar: async () => { throw Error("Unexpected cookie operation"); },
      send: async (request, _extra, signal) => {
        if (readSaved) throw Error("Saved metadata cannot send another request");
        if (request._id !== id || !current()) throw Error("Metadata request owner changed");
        const native = { ...structuredClone(input), id: crypto.randomUUID() };
        const cancel = () => { void invoke("cancel_http", { id: native.id }).catch(() => {}); };
        signal.addEventListener("abort", cancel, { once: true });
        try {
          signal.throwIfAborted();
          const response = /** @type {Record<string,any>} */ (await invoke("send_http", { request: native }));
          signal.throwIfAborted();
          if (!current()) throw Error("Metadata response owner changed");
          const entry = { ...response, _id: crypto.randomUUID(), requestId: id, created: Date.now(), protocol: "http" };
          data.history.push(entry);
          return entry;
        } finally { signal.removeEventListener("abort", cancel); }
      },
    });
    const session = await openPluginSession({ name: "insomnia-plugin-native-metadata", entry: "index.js", format: "commonjs", files: { "index.js": source } }, {
      isCurrent: current, signal: controller.signal,
      createWorker: () => {
        const worker = new Worker(url, { type: "module" });
        const record = { terminated: false, index: records.length }; records.push(record);
        const terminate = worker.terminate.bind(worker);
        worker.terminate = () => { record.terminated = true; terminate(); };
        return worker;
      },
    });
    try { return await session.invoke("templateTags", readSaved ? 1 : 0, [id], { isCurrent: current, signal: controller.signal, helperCall: dispatcher }); }
    finally {
      alive = false; controller.abort(); session.close();
      const deadline = Date.now() + 6000;
      while (records.some(record => !record.terminated) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
      if (records.some(record => !record.terminated)) throw Error("Metadata worker did not retire");
    }
  },
};
