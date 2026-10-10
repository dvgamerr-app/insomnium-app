/** Controlled response-worker lifecycle only; normal cases use the bundled worker.
 * @param {import('playwright-core').Page} page
 * @param {'hold'|'construction'|'post'} [mode] */
export async function installResponseWorkerControl(page, mode = "hold") {
  await page.evaluate((mode) => {
    const scope = /** @type {any} */ (window);
    const NativeWorker = window.Worker;
    const setTimer = window.setTimeout;
    const clearTimer = window.clearTimeout;
    const records = /** @type {any[]} */ ([]);
    class ControlledWorker {
      onmessage = null;
      onerror = null;
      onmessageerror = null;
      /** @type {any} */ record;
      constructor(
        /** @type {string|URL} */ url,
        /** @type {WorkerOptions|undefined} */ options,
      ) {
        this.record = {
          url: String(url),
          options,
          createdAt: performance.now(),
          startedAt: null,
          terminated: false,
          terminatedAt: null,
          deadlineTimer: null,
          deadlineScheduledAt: null,
          deadlineFired: false,
          deadlineFiredAt: null,
          deadlineClearedAt: null,
          posts: /** @type {any[]} */ ([]),
          worker: this,
        };
        records.push(this.record);
        if (mode === "construction")
          throw Error("Owned response worker construction failure");
      }
      postMessage(/** @type {any} */ data) {
        this.record.startedAt = performance.now();
        this.record.posts.push(structuredClone(data));
        if (mode === "post") throw Error("Owned response worker post failure");
      }
      terminate() {
        this.record.terminated = true;
        this.record.terminatedAt ??= performance.now();
      }
    }
    scope.Worker = function (
      /** @type {string|URL} */ url,
      /** @type {WorkerOptions|undefined} */ options,
    ) {
      return String(url).includes("response-filter.worker")
        ? new ControlledWorker(url, options)
        : new NativeWorker(url, options);
    };
    /** @param {TimerHandler} handler @param {number|undefined} delay @param {...any} args */
    scope.setTimeout = function (handler, delay, ...args) {
      const record = records.at(-1);
      if (
        delay === 3000 &&
        typeof handler === "function" &&
        record &&
        record.startedAt === null &&
        record.deadlineTimer === null
      ) {
        record.deadlineScheduledAt = performance.now();
        record.deadlineTimer = setTimer.call(
          window,
          () => {
            record.deadlineFired = true;
            record.deadlineFiredAt = performance.now();
            handler.apply(window, args);
          },
          delay,
        );
        return record.deadlineTimer;
      }
      return Reflect.apply(setTimer, window, [handler, delay, ...args]);
    };
    scope.clearTimeout = function (/** @type {number|undefined} */ id) {
      const record = records.find((r) => r.deadlineTimer === id);
      if (record) record.deadlineClearedAt ??= performance.now();
      return clearTimer.call(window, id);
    };
    scope.__responseWorkerControl = {
      records,
      snapshot() {
        return records.map(({ worker, ...record }) => record);
      },
      emit(
        /** @type {number} */ index,
        /** @type {string} */ kind,
        /** @type {any} */ data,
      ) {
        records[index]?.worker?.["on" + kind]?.({ data });
      },
    };
  }, mode);
}

/** @param {import('playwright-core').Page} page */
export function responseWorkerRecords(page) {
  return page.evaluate(() =>
    /** @type {any} */ (window).__responseWorkerControl.snapshot(),
  );
}
/** Deliver a chosen generation's callback even after termination.
 * @param {import('playwright-core').Page} page @param {number} index
 * @param {'message'|'error'|'messageerror'} kind @param {Record<string,any>} [data] */
export function emitResponseWorker(page, index, kind, data = {}) {
  return page.evaluate(
    ({ index, kind, data }) =>
      /** @type {any} */ (window).__responseWorkerControl.emit(
        index,
        kind,
        data,
      ),
    { index, kind, data },
  );
}
