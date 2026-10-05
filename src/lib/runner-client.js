/**
 * Start a dedicated worker for each suite. Caller supplies the owned HTTP sender.
 * @param {{name:string,tests:import('./runner-runtime.js').RunnerTest[]}} suite
 * @param {(requestId:string,signal:AbortSignal)=>Promise<any>} send
 * @param {{signal?:AbortSignal,timeoutMs?:number,bail?:boolean,filter?:string}} [options]
 */
export function runSuiteInWorker(suite, send, options = {}) {
  if (options.signal?.aborted)
    return Promise.reject(new Error("Runner cancelled"));
  const worker = new Worker(new URL("./runner.worker.js", import.meta.url), {
    type: "module",
  });
  return superviseRunnerWorker(worker, suite, send, options);
}

/**
 * Own worker lifetime and every outstanding transport request.
 * @param {Worker} worker
 * @param {{name:string,tests:import('./runner-runtime.js').RunnerTest[]}} suite
 * @param {(requestId:string,signal:AbortSignal)=>Promise<any>} send
 * @param {{signal?:AbortSignal,timeoutMs?:number,bail?:boolean,filter?:string}} [options]
 */
export function superviseRunnerWorker(worker, suite, send, options = {}) {
  return new Promise((resolve, reject) => {
    let done = false;
    let lastId = 0;
    /** @type {Map<number,AbortController>} */
    const calls = new Map();
    /** @type {ReturnType<typeof setTimeout>|undefined} */
    let deadline;
    /** @type {ReturnType<typeof setTimeout>|undefined} */
    let startup;
    /** @param {Error|null} error @param {any} [value] */
    function finish(error, value) {
      if (done) return;
      done = true;
      clearTimeout(deadline);
      clearTimeout(startup);
      options.signal?.removeEventListener("abort", abort);
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
      for (const controller of calls.values()) controller.abort();
      calls.clear();
      if (error) reject(error);
      else resolve(value);
    }
    function abort() {
      finish(new Error("Runner cancelled"));
    }
    /** @param {unknown} error */
    const asError = (error) =>
      error instanceof Error ? error : new Error(String(error));
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) {
      abort();
      return;
    }
    try {
      const timeout = options.timeoutMs ?? 60000;
      if (
        !Number.isInteger(timeout) ||
        timeout < 1 ||
        timeout > 600000 ||
        !suite ||
        typeof suite.name !== "string" ||
        !Array.isArray(suite.tests) ||
        suite.tests.length > 1000
      )
        throw new Error("Invalid runner options or suite");
      // Serialize before posting: reject cycles/oversized input without keeping a worker alive.
      const snapshot = JSON.stringify(suite);
      if (snapshot.length > 2 * 1024 * 1024)
        throw new Error("Runner source exceeds 2 Mi characters");
      startup = setTimeout(
        () => finish(new Error("Runner worker initialization timed out")),
        15000,
      );
      deadline = setTimeout(
        () => finish(new Error("Runner deadline exceeded")),
        Math.min(2147483647, (suite.tests.length + 1) * timeout + 25000),
      );
      worker.onerror = (event) => {
        event.preventDefault();
        finish(new Error(event.message || "Runner worker failed"));
      };
      worker.onmessageerror = () =>
        finish(new Error("Runner worker message could not be decoded"));
      worker.onmessage = (event) => {
        if (done) return;
        const message = event.data;
        try {
          if (message?.type === "ready") {
            clearTimeout(startup);
            return;
          }
          if (message?.type === "cancel-send") {
            calls.get(message.id)?.abort();
            calls.delete(message.id);
            return;
          }
          if (message?.type === "result") {
            if (typeof message.error === "string") {
              finish(new Error(message.error));
              return;
            }
            const result = message.value;
            if (
              !result ||
              !result.stats ||
              !["tests", "passes", "failures", "pending"].every((key) =>
                Array.isArray(result[key]),
              )
            )
              throw new Error("Invalid Runner result");
            finish(null, result);
            return;
          }
          if (message?.type !== "send")
            throw new Error("Unknown Runner worker message");
          if (
            !Number.isSafeInteger(message.id) ||
            message.id <= lastId ||
            message.id > 10000 ||
            typeof message.requestId !== "string" ||
            !message.requestId ||
            calls.size >= 100
          )
            throw new Error("Invalid Runner request message");
          lastId = message.id;
          const controller = new AbortController();
          calls.set(message.id, controller);
          Promise.resolve()
            .then(() => {
              if (done || controller.signal.aborted)
                throw new Error("Runner request cancelled");
              return send(message.requestId, controller.signal);
            })
            .then((value) => {
              if (done || controller.signal.aborted) return;
              worker.postMessage({
                type: "send-result",
                id: message.id,
                value,
              });
            })
            .catch((error) => {
              if (done || controller.signal.aborted) return;
              try {
                worker.postMessage({
                  type: "send-result",
                  id: message.id,
                  error: asError(error).message,
                });
              } catch (postError) {
                finish(asError(postError));
              }
            })
            .finally(() => {
              calls.delete(message.id);
            });
        } catch (error) {
          finish(asError(error));
        }
      };
      worker.postMessage({
        type: "run",
        suite: JSON.parse(snapshot),
        options: {
          timeoutMs: timeout,
          bail: !!options.bail,
          filter: options.filter || "",
        },
      });
    } catch (error) {
      finish(asError(error));
    }
  });
}
