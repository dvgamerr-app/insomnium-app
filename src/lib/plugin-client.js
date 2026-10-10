/** @param {{name:string,entry:string,format:string,files:Record<string,string>}} snapshot @param {{signal?:AbortSignal}} [options]
 * @returns {Promise<Record<string,any>>} */
export function inspectPluginExports(snapshot, options = {}) {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new DOMException("Plugin inspection cancelled", "AbortError"));
      return;
    }
    /** @type {Worker|undefined} */ let worker;
    let settled = false;
    const finish = (
      /** @type {Error|null} */ error,
      /** @type {any} */ result,
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", cancel);
      worker?.terminate();
      if (error) reject(error);
      else resolve(result);
    };
    const cancel = () =>
      finish(
        new DOMException("Plugin inspection cancelled", "AbortError"),
        null,
      );
    const timer = setTimeout(
      () => finish(new Error("Plugin inspection exceeded 5 seconds"), null),
      5000,
    );
    options.signal?.addEventListener("abort", cancel, { once: true });
    try {
      worker = new Worker(new URL("./plugin.worker.js", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (event) => {
        if (typeof event.data?.error === "string")
          finish(new Error(event.data.error), null);
        else if (event.data?.result && typeof event.data.result === "object")
          finish(null, event.data.result);
        else finish(new Error("Invalid plugin worker result"), null);
      };
      worker.onerror = (event) => {
        event.preventDefault();
        finish(new Error(event.message || "Plugin worker failed"), null);
      };
      worker.postMessage({ type: "inspect", snapshot });
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)), null);
    }
  });
}
