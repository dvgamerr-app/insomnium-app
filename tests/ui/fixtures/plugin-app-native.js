import { openPluginSession } from "../../../src/lib/plugin-session.js";
import { createPluginAppSyncHelpers } from "../../../src/lib/plugin-app-sync.js";
import { createPluginNativeAppEndpoint } from "../../../src/lib/plugin-app-native.js";

/** Read-only native preparation. Deliberately never writes/clears OS clipboard.
 * @param {string} url */
async function run(url) {
  const controller = new AbortController();
  let current = true;
  const endpoint = createPluginNativeAppEndpoint({ current: () => current, signal: controller.signal });
  const source = `const make=${createPluginAppSyncHelpers.toString()};exports.templateTags=[{name:'native',run(c,gen){const app=make((method,args)=>__pluginValueCodec.decode(__pluginSyncCall(JSON.stringify({generation:gen,call:__pluginValueCodec.encode({method,args})}))),()=>__pluginHelperCurrent(gen));return {info:app.getInfo(),desktop:app.getPath('DeSkTop')};}}];`;
  const session = await openPluginSession({ name: "insomnia-plugin-native-app-readonly", entry: "index.js", format: "commonjs", files: { "index.js": source } }, {
    isCurrent: () => current,
    createWorker: () => new Worker(url, { type: "module" }),
  });
  try {
    const value = await session.invoke("templateTags", 0, [1], {
      signal: controller.signal,
      isCurrent: () => current,
      helperCall: async () => { throw Error("Unexpected async helper"); },
      syncCall: endpoint,
    });
    current = false;
    let refused = false;
    try { await endpoint({ method: "app.clipboard.clear", args: [] }); }
    catch { refused = true; }
    return { value, staleMutationRefused: refused, isolated: globalThis.crossOriginIsolated };
  } finally {
    current = false;
    controller.abort();
    session.close();
  }
}
/** @type {any} */ (window).__pluginNativeAppReadOnly = run;
