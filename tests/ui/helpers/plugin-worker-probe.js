/** Observe the real bundled worker without replacing execution or messages.
 * @param {import('playwright-core').Page} page */
export async function installPluginWorkerProbe(page) {
  await page.evaluate(() => {
    const scope = /** @type {any} */ (window);
    const NativeWorker = window.Worker;
    const records = /** @type {any[]} */ ([]);
    const terminalNodes = new Map();
    scope.__pluginWorkerProbe = { records, original: NativeWorker,
      trackTerminalNode(/** @type {HTMLElement} */ body) {
        const record=records.filter(row=>!row.terminated).at(-1);
        if(!record)throw Error('No owned plugin worker for terminal node');
        const nodes=terminalNodes.get(record)||[];nodes.push(body);terminalNodes.set(record,nodes);
        return records.indexOf(record);
      },
    };
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
          terminalCleanup: /** @type {any[]} */ ([]),
        };
        records.push(record);
        worker.addEventListener("message", (event) => {
          record.result = event.data?.result ?? null;
          record.error = event.data?.error ?? null;
        });
        const terminate = worker.terminate.bind(worker);
        worker.terminate = () => {
          record.terminalCleanup=(terminalNodes.get(record)||[]).map((/** @type {HTMLElement} */ body)=>({text:body.textContent,count:body.getAttribute('data-cleanup-count'),connected:body.isConnected,mode:body.getAttribute('data-cleanup-mode')}));
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
