/** These are the legacy synchronous app operations. Never turn them into a
 * cached clipboard snapshot or an asynchronous guest return value.
 * @param {any} call @returns {{method:string,args:any[]}} */
export function validatePluginAppSyncCall(call) {
  const methods = [
    "app.getInfo",
    "app.getPath",
    "app.clipboard.readText",
    "app.clipboard.writeText",
    "app.clipboard.clear",
  ];
  if (
    !call ||
    Object.keys(call).sort().join(",") !== "args,method" ||
    !methods.includes(call.method) ||
    !Array.isArray(call.args)
  )
    throw Error("Invalid synchronous plugin app operation");
  const text = ["app.getPath", "app.clipboard.writeText"].includes(call.method);
  if (
    call.args.length !== (text ? 1 : 0) ||
    (text && typeof call.args[0] !== "string")
  )
    throw Error("Invalid synchronous plugin app arguments");
  return call;
}

/** Internal preparation for the complete app facade; not activated in renderers.
 * @param {(method:string,args:any[])=>any} call @param {()=>boolean} current */
export function createPluginAppSyncHelpers(call, current) {
  /** @param {string} method @param {any[]} args */
  const invoke = (method, args) => {
    if (!current()) throw Error("Plugin app helper is no longer current");
    return call(method, args);
  };
  return Object.freeze({
    getInfo() {
      const value = invoke("app.getInfo", []);
      if (
        !value ||
        typeof value.version !== "string" ||
        typeof value.platform !== "string"
      )
        throw Error("Invalid plugin app information");
      return { version: value.version, platform: value.platform };
    },
    /** @param {string} name */
    getPath(name) {
      if (typeof name !== "string" || name.toLowerCase() !== "desktop")
        throw Error("Unknown path name " + name);
      const value = invoke("app.getPath", ["desktop"]);
      if (typeof value !== "string") throw Error("Invalid plugin desktop path");
      return value;
    },
    clipboard: Object.freeze({
      readText() {
        const value = invoke("app.clipboard.readText", []);
        if (typeof value !== "string")
          throw Error("Invalid plugin clipboard text");
        return value;
      },
      /** @param {string} text */
      writeText(text) {
        if (typeof text !== "string")
          throw Error("Plugin clipboard value must be text");
        invoke("app.clipboard.writeText", [text]);
      },
      clear() {
        invoke("app.clipboard.clear", []);
      },
    }),
  });
}
