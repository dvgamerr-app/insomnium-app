import { createPluginStore } from "./plugin-store.js";

/** A retained, serialized plugin worker with an explicit live-owner guard.
 * @param {{name:string,entry:string,format:string,files:Record<string,string>}} snapshot
 * @param {{isCurrent:()=>boolean,signal?:AbortSignal,createWorker?:()=>Worker}} options */
export async function openPluginSession(snapshot, options) {
  const aborted = () =>
    new DOMException("Plugin session is no longer current", "AbortError");
  if (!options || typeof options.isCurrent !== "function")
    throw Error("Plugin execution requires a live-owner guard");
  if (options.signal?.aborted || !options.isCurrent()) throw aborted();
  const store = createPluginStore(snapshot.name);
  const worker =
    options.createWorker?.() ??
    new Worker(new URL("./plugin.worker.js", import.meta.url), {
      type: "module",
    });
  let closed = false,
    nextId = 0,
    storeId = 0,
    queued = 0;
  let queue = Promise.resolve();
  /** @type {{id:number,resolve:(value:any)=>void,reject:(error:Error)=>void,timer:ReturnType<typeof setTimeout>}|undefined} */
  let active;
  const close = (/** @type {Error} */ error = aborted()) => {
    if (closed) return;
    closed = true;
    clearInterval(ownerTimer);
    options.signal?.removeEventListener("abort", cancel);
    worker.terminate();
    if (active) {
      clearTimeout(active.timer);
      active.reject(error);
      active = undefined;
    }
  };
  const current = () => {
    try {
      return !closed && !options.signal?.aborted && options.isCurrent();
    } catch {
      return false;
    }
  };
  const cancel = () => close();
  const ownerTimer = setInterval(() => {
    if (!current()) close();
  }, 100);
  options.signal?.addEventListener("abort", cancel, { once: true });
  /** @param {Record<string,any>} message */
  const send = (message) =>
    new Promise((resolve, reject) => {
      if (!current()) {
        close();
        reject(aborted());
        return;
      }
      const id = message.type === "init" ? 0 : ++nextId;
      active = {
        id,
        resolve,
        reject,
        timer: setTimeout(
          () => close(new Error("Plugin operation exceeded 5 seconds")),
          5000,
        ),
      };
      try {
        worker.postMessage({ ...message, id });
      } catch (error) {
        close(error instanceof Error ? error : new Error(String(error)));
      }
    });
  worker.onerror = (event) => {
    event.preventDefault();
    close(new Error(event.message || "Plugin worker failed"));
  };
  worker.onmessage = async (event) => {
    const message = event.data;
    if (!current()) {
      close();
      return;
    }
    if (message?.type === "store") {
      if (
        !active ||
        active.id === 0 ||
        message.callbackId !== active.id ||
        !Number.isSafeInteger(message.id) ||
        message.id <= storeId
      ) {
        close(new Error("Invalid plugin store ownership"));
        return;
      }
      storeId = message.id;
      let value, error;
      try {
        const operation = message.operation,
          methods = [
            "hasItem",
            "getItem",
            "setItem",
            "removeItem",
            "clear",
            "all",
          ];
        if (
          !operation ||
          Object.keys(operation).sort().join(",") !== "args,method" ||
          !methods.includes(operation.method) ||
          !Array.isArray(operation.args)
        )
          throw Error("Unsupported plugin store operation");
        const count =
          operation.method === "setItem"
            ? 2
            : ["hasItem", "getItem", "removeItem"].includes(operation.method)
              ? 1
              : 0;
        if (
          operation.args.length !== count ||
          !operation.args.every(
            (/** @type {any} */ value) => typeof value === "string",
          )
        )
          throw Error("Invalid plugin store arguments");
        if (!current() || active?.id !== message.callbackId) throw aborted();
        const method =
          /** @type {Record<string,(...args:any[])=>Promise<any>>} */ (store)[
            operation.method
          ];
        value = await method(...operation.args);
      } catch (cause) {
        error = (cause instanceof Error ? cause.message : String(cause)).slice(
          0,
          8192,
        );
      }
      if (current() && active?.id === message.callbackId)
        worker.postMessage({
          type: "store-result",
          id: message.id,
          value,
          error,
        });
      else close();
      return;
    }
    if (!active || message?.id !== active.id) return;
    if (typeof message.error === "string") {
      close(new Error(message.error));
      return;
    }
    if (!Object.hasOwn(message, "result")) {
      close(new Error("Invalid plugin worker response"));
      return;
    }
    clearTimeout(active.timer);
    const resolve = active.resolve;
    active = undefined;
    resolve(message.result);
  };
  let metadata;
  try {
    metadata = await send({ type: "init", snapshot });
  } catch (error) {
    close();
    throw error;
  }
  return {
    metadata,
    /** @param {string} kind @param {number} index @param {any[]} [args] */
    invoke(kind, index, args = []) {
      if (!current()) {
        close();
        return Promise.reject(aborted());
      }
      if (queued >= 64)
        return Promise.reject(
          new Error("Plugin callback queue limit exceeded"),
        );
      let detached;
      try {
        const json = JSON.stringify(args);
        if (!Array.isArray(args) || json.length > 1024 * 1024)
          throw Error("Invalid or oversized plugin arguments");
        detached = JSON.parse(json);
      } catch (error) {
        return Promise.reject(error);
      }
      queued++;
      const job = queue.then(() =>
        send({ type: "invoke", kind, index, args: detached }),
      );
      queue = job.then(
        () => {},
        () => {},
      );
      return job.finally(() => {
        queued--;
      });
    },
    close: () => close(),
  };
}
