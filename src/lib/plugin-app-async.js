/** Internal preparation; complete app/DOM facade is not activated yet.
 * @param {(method:string,args:any[])=>Promise<any>} call @param {()=>boolean} current */
export function createPluginAppAsyncHelpers(call, current) {
  const invoke = (/** @type {string} */ method, /** @type {any[]} */ args) => {
    if (!current()) return Promise.reject(Error("Plugin app helper is no longer current"));
    return call(method, args);
  };
  return Object.freeze({
    alert: (/** @type {string} */ title, /** @type {string} */ message = "") => invoke("app.alert", [title, message]),
    prompt: (/** @type {string} */ title, /** @type {any} */ options = {}) => invoke("app.prompt", [title, options || {}]),
    showSaveDialog: (/** @type {any} */ options = {}) => invoke("app.showSaveDialog", [options || {}]),
  });
}

/** Validate before any dialog/service dispatch.
 * @param {any} value @returns {{method:string,args:any[]}} */
export function validatePluginAppAsyncCall(value) {
  if (!value || Object.keys(value).sort().join(",") !== "args,method" || !Array.isArray(value.args))
    throw Error("Invalid async plugin app operation");
  const { method, args } = value;
  if (method === "app.alert") {
    if (args.length !== 2 || args.some((/** @type {any} */ arg) => typeof arg !== "string")) throw Error("Invalid plugin alert arguments");
  } else if (method === "app.prompt" || method === "app.showSaveDialog") {
    const prompt = method === "app.prompt";
    if (args.length !== (prompt ? 2 : 1) || (prompt && typeof args[0] !== "string")) throw Error("Invalid plugin dialog arguments");
    const options = args[prompt ? 1 : 0];
    const keys = prompt ? ["label", "defaultValue", "submitName", "inputType"] : ["defaultPath"];
    if (!options || typeof options !== "object" || Array.isArray(options) || Object.keys(options).some(key => !keys.includes(key) || typeof options[key] !== "string"))
      throw Error("Invalid plugin dialog options");
  } else throw Error("Unknown async plugin app operation");
  return value;
}
