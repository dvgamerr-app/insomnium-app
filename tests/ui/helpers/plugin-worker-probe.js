/** Observe the real bundled worker without replacing execution or messages.
 * @param {import('playwright-core').Page} page */
export async function installPluginWorkerProbe(page) {
  await page.evaluate(() => {
    const scope = /** @type {any} */ (window);
    const NativeWorker = window.Worker;
    const records = /** @type {any[]} */ ([]);
    scope.__pluginWorkerProbe = { records, original: NativeWorker };
    scope.Worker = function (
      /** @type {string|URL} */ url,
      /** @type {WorkerOptions|undefined} */ options,
    ) {
      const worker = new NativeWorker(url, options);
      if (String(url).includes("plugin.worker")) {
        const record = {
          url: String(url),
          terminated: false,
          result: null,
          error: null,
        };
        records.push(record);
        worker.addEventListener("message", (event) => {
          record.result = event.data?.result ?? null;
          record.error = event.data?.error ?? null;
        });
        const terminate = worker.terminate.bind(worker);
        worker.terminate = () => {
          record.terminated = true;
          terminate();
        };
      }
      return worker;
    };
  });
}

/** @param {import('playwright-core').Page} page */
export async function pluginWorkerRecords(page) {
  return page.evaluate(() =>
    structuredClone(/** @type {any} */ (window).__pluginWorkerProbe.records),
  );
}

/** @param {import('playwright-core').Page} page */
export async function restorePluginWorkerProbe(page) {
  await page.evaluate(() => {
    const scope = /** @type {any} */ (window);
    if (scope.__pluginWorkerProbe) {
      scope.Worker = scope.__pluginWorkerProbe.original;
      delete scope.__pluginWorkerProbe;
    }
  });
}
