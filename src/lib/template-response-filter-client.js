/** Extract a response-tag body with the response worker's bounded lifetime.
 * @param {string} body @param {string} path @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
export function renderResponseFilter(body, path, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Response filter cancelled", "AbortError"));
      return;
    }
    /** @type {Worker | undefined} */ let worker;
    /** @type {ReturnType<typeof setTimeout> | undefined} */ let timer;
    let finished = false;
    const finish = (
      /** @type {string | undefined} */ text,
      /** @type {Error | undefined} */ error,
    ) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      worker?.terminate();
      if (error) reject(error);
      else resolve(text || "");
    };
    const abort = () =>
      finish(
        undefined,
        new DOMException("Response filter cancelled", "AbortError"),
      );
    try {
      worker = new Worker(
        new URL("./response-filter.worker.js", import.meta.url),
        { type: "module" },
      );
      signal?.addEventListener("abort", abort, { once: true });
      worker.onmessage = (event) => {
        if (typeof event.data?.error === "string")
          finish(undefined, new Error(event.data.error));
        else if (typeof event.data?.text === "string")
          finish(event.data.text, undefined);
        else finish(undefined, new Error("Invalid response filter result"));
      };
      worker.onerror = () =>
        finish(undefined, new Error("Could not load response filter"));
      worker.onmessageerror = () =>
        finish(undefined, new Error("Could not read response filter result"));
      timer = setTimeout(
        () =>
          finish(undefined, new Error("Response filter exceeded 3 seconds")),
        3000,
      );
      worker.postMessage({ body, path, kind: "template" });
    } catch (error) {
      finish(undefined, new Error(String(error)));
    }
  });
}
