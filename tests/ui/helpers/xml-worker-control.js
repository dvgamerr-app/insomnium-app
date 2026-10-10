/** Deterministic faults/delays for mounted formatter lifecycle checks only.
 * Normal formatting cases use the real bundled Worker without this adapter.
 * @param {import('playwright-core').Page} page
 * @param {'hold'|'construction'|'post'} [mode] */
export async function installXmlWorkerControl(page, mode = "hold") {
  await page.evaluate((mode) => {
    const scope = /** @type {any} */ (window);
    const NativeWorker = window.Worker;
    const nativeSetTimeout = window.setTimeout;
    const nativeClearTimeout = window.clearTimeout;
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
          terminated: false,
          createdAt: performance.now(),
          startedAt: null,
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
          throw Error("Owned XML worker construction failure");
      }
      postMessage(/** @type {any} */ message) {
        this.record.startedAt = performance.now();
        this.record.posts.push(structuredClone(message));
        if (mode === "post") throw Error("Owned XML worker post failure");
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
      return String(url).includes("xml-format.worker")
        ? new ControlledWorker(url, options)
        : new NativeWorker(url, options);
    };
    // Observe the formatter's timer without changing its delay or scheduling.
    // It is installed between XML Worker construction and postMessage.
    /** @param {TimerHandler} handler @param {number|undefined} delay @param {...any} args */
    scope.setTimeout = function (
      /** @type {TimerHandler} */ handler,
      /** @type {number|undefined} */ delay,
      ...args
    ) {
      const record = records.at(-1);
      if (
        delay === 3000 &&
        typeof handler === "function" &&
        record &&
        record.startedAt === null &&
        record.deadlineTimer === null
      ) {
        record.deadlineScheduledAt = performance.now();
        record.deadlineTimer = nativeSetTimeout.call(
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
      return Reflect.apply(nativeSetTimeout, window, [handler, delay, ...args]);
    };
    scope.clearTimeout = function (/** @type {number|undefined} */ id) {
      const record = records.find((record) => record.deadlineTimer === id);
      if (record) record.deadlineClearedAt ??= performance.now();
      return nativeClearTimeout.call(window, id);
    };
    scope.__xmlWorkerControl = {
      records,
      emit(/** @type {string} */ kind, /** @type {Record<string,any>} */ data) {
        const worker = records.at(-1)?.worker;
        worker?.["on" + kind]?.({ data });
      },
      snapshot() {
        return records.map(({ worker, ...record }) => record);
      },
      restore() {
        scope.Worker = NativeWorker;
        scope.setTimeout = nativeSetTimeout;
        scope.clearTimeout = nativeClearTimeout;
      },
    };
  }, mode);
}

/** Deliberately deliver even after termination to exercise the late-callback guard.
 * @param {import('playwright-core').Page} page
 * @param {'message'|'error'|'messageerror'} kind
 * @param {Record<string,any>} [data] */
export async function emitXmlWorker(page, kind, data = {}) {
  await page.evaluate(
    ({ kind, data }) => {
      /** @type {any} */ (window).__xmlWorkerControl.emit(kind, data);
    },
    { kind, data },
  );
}

/** @param {import('playwright-core').Page} page */
export async function xmlWorkerRecords(page) {
  return page.evaluate(() =>
    /** @type {any} */ (window).__xmlWorkerControl.snapshot(),
  );
}
