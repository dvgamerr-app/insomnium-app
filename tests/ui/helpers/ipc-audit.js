/** Count one real native command without replacing its result or reading payloads.
 * @template T @param {import('playwright-core').Page} page @param {string} command
 * @param {()=>Promise<T>} run */
export async function withIpcAudit(page, command, run) {
  await page.evaluate((command) => {
    const host = /** @type {any} */ (window);
    if (host.__ipcAuditFixture) throw new Error("Nested IPC audit fixture");
    const original = window.fetch;
    host.__ipcAuditFixture = { original, calls: 0, completed: 0 };
    host.fetch = async (
      /** @type {RequestInfo|URL} */ input,
      /** @type {RequestInit|undefined} */ init,
    ) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url !== host.__TAURI_INTERNALS__.convertFileSrc(command, "ipc"))
        return original.call(window, input, init);
      host.__ipcAuditFixture.calls++;
      const response = await original.call(window, input, init);
      if (response.headers.get("Tauri-Response") === "ok")
        host.__ipcAuditFixture.completed++;
      return response;
    };
  }, command);
  try {
    const value = await run();
    const counts = await page.evaluate(() => {
      const s = /** @type {any} */ (window).__ipcAuditFixture;
      return { calls: s.calls, completed: s.completed };
    });
    return { value, ...counts };
  } finally {
    await page.evaluate(() => {
      const host = /** @type {any} */ (window);
      if (host.__ipcAuditFixture) {
        window.fetch = host.__ipcAuditFixture.original;
        delete host.__ipcAuditFixture;
      }
    });
  }
}
