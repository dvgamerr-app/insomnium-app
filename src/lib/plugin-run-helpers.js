/** Explicit RPC names shared by host and guest. */
export const pluginRunHelperMethods = Object.freeze([
  "app.alert",
  "app.prompt",
  "app.showSaveDialog",
  "util.render",
  "data.export.insomnia",
  "data.export.har",
  "data.import.raw",
  "data.import.uri",
  "network.sendRequest",
  "models.request.getById",
  "models.request.getAncestors",
  "models.workspace.getById",
  "models.oAuth2Token.getByRequestId",
  "models.cookieJar.getOrCreateForWorkspace",
  "models.response.getLatestForRequestId",
  "models.response.readBodyChunk",
]);
/** Embedded in QuickJS; functions never cross the value codec.
 * @param {(method:string,args:any[])=>Promise<any>} call
 * @param {{from:(value:any,encoding?:string)=>any,alloc:(length:number)=>any}} buffer
 * @param {()=>boolean} [current]
 * @param {{bodies:Map<string,any>,retained:number}} [cache] */
export function createPluginRunHelpers(
  call,
  buffer,
  current = () => true,
  cache = { bodies: new Map(), retained: 0 },
) {
  // The retained VM owns admitted bytes; each callback still gets its own guard.
  // A response saved by the package can be read through a later current facade.
  const bodies = cache.bodies;
  const response = async (/** @type {any} */ packet) => {
    if (
      !packet ||
      !Object.hasOwn(packet, "response") ||
      !Object.hasOwn(packet, "body")
    )
      throw Error("Invalid plugin response packet");
    if (!current()) throw Error("Plugin response helper is no longer current");
    const body = packet.body;
    if (body?.path) {
      let bytes = null;
      if (typeof body.base64 === "string")
        bytes = buffer.from(body.base64, "base64");
      else if (body.length !== undefined) {
        if (
          body.chunkSize !== 262144 ||
          !Number.isSafeInteger(body.length) ||
          body.length <= body.chunkSize ||
          body.length > Math.ceil((20 * 1024 * 1024) / 3) * 4 ||
          !Number.isSafeInteger(body.bytes) ||
          body.bytes < 0 ||
          body.bytes > 20 * 1024 * 1024
        )
          throw Error("Invalid plugin response transfer");
        if (
          cache.retained - (bodies.get(body.path)?.length ?? 0) + body.bytes >
          64 * 1024 * 1024
        )
          throw Error("Plugin response body cache exceeds 64 MiB");
        bytes = buffer.alloc(body.bytes);
        let written = 0;
        for (let offset = 0; offset < body.length; offset += body.chunkSize) {
          const text = await call("models.response.readBodyChunk", [
            body.path,
            offset,
          ]);
          if (!current())
            throw Error("Plugin response helper is no longer current");
          const chunk =
            typeof text === "string" ? buffer.from(text, "base64") : text;
          if (
            !chunk ||
            chunk.length !==
              Math.min((body.chunkSize / 4) * 3, body.bytes - written)
          )
            throw Error("Invalid plugin response chunk");
          if (written + chunk.length > bytes.length)
            throw Error("Invalid plugin response body length");
          bytes.set(chunk, written);
          written += chunk.length;
        }
        if (written !== bytes.length)
          throw Error("Invalid plugin response body length");
      }
      const next =
        cache.retained -
        (bodies.get(body.path)?.length ?? 0) +
        (bytes?.length ?? 0);
      if (next > 64 * 1024 * 1024)
        throw Error("Plugin response body cache exceeds 64 MiB");
      bodies.set(body.path, bytes);
      cache.retained = next;
    }
    return packet.response ?? null;
  };
  const method =
    (/** @type {string} */ name) =>
    (/** @type {any[]} */ ...args) =>
      call(name, args);
  const models = Object.freeze({
    request: Object.freeze({
      getById: method("models.request.getById"),
      getAncestors: method("models.request.getAncestors"),
    }),
    workspace: Object.freeze({ getById: method("models.workspace.getById") }),
    oAuth2Token: Object.freeze({
      getByRequestId: method("models.oAuth2Token.getByRequestId"),
    }),
    cookieJar: Object.freeze({
      getOrCreateForWorkspace: method(
        "models.cookieJar.getOrCreateForWorkspace",
      ),
    }),
    response: Object.freeze({
      async getLatestForRequestId(/** @type {any[]} */ ...args) {
        const packet = await call(
          "models.response.getLatestForRequestId",
          args,
        );
        return response(packet);
      },
      /** @param {any} [response] @param {any} [fallback] */
      getBodyBuffer(response, fallback) {
        if (!current())
          throw Error("Plugin response helper is no longer current");
        if (!response?.bodyPath) return buffer.alloc(0);
        const body = bodies.get(response.bodyPath);
        if (!body) return fallback === undefined ? null : fallback;
        return buffer.from(
          body.buffer.slice(body.byteOffset, body.byteOffset + body.length),
        );
      },
    }),
  });
  return Object.freeze({
    data:Object.freeze({import:Object.freeze({raw:method("data.import.raw"),uri:method("data.import.uri")}),export:Object.freeze({insomnia:method("data.export.insomnia"),har:method("data.export.har")})}),
    util: Object.freeze({ render: method("util.render"), models }),
    network: Object.freeze({
      async sendRequest(/** @type {any[]} */ ...args) {
        return response(await call("network.sendRequest", args));
      },
    }),
  });
}
/** @param {any} value */
export function validatePluginHelperCall(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Object.keys(value).sort().join(",") !== "args,method" ||
    !pluginRunHelperMethods.includes(value.method) ||
    !Array.isArray(value.args)
  )
    throw Error("Invalid plugin helper operation");
  return value;
}
