/** Observe one successful native command before delivering its real response.
 * Native execution/reply remain unchanged; no command arguments are logged.
 * Used to arrange an actual OS fault at a deterministic transition boundary.
 * @template T
 * @param {import('playwright-core').Page} page
 * @param {string} command
 * @param {()=>Promise<void>} hook
 * @param {()=>Promise<T>} run */
export async function withIpcSuccessHook(page, command, hook, run) {
  // Installed Playwright has no removeExposedFunction; bindings live until the
  // owned Page is disposed. A unique name prevents reuse and the global is deleted below.
  const binding =
    "__nativeSuccessHook_" + crypto.randomUUID().replaceAll("-", "");
  await page.exposeFunction(binding, hook);
  try {
    await page.evaluate(
      ({ command, binding }) => {
        const host = /** @type {any} */ (window);
        if (host.__ipcSuccessFixture)
          throw new Error("Nested IPC success hook");
        const original = window.fetch;
        host.__ipcSuccessFixture = {
          original,
          calls: 0,
          hooks: 0,
          owner: binding,
        };
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
          const state = host.__ipcSuccessFixture;
          state.calls++;
          const response = await original.call(window, input, init);
          if (response.headers.get("Tauri-Response") === "ok" && !state.hooks) {
            state.hooks++;
            await host[binding]();
          }
          return response;
        };
      },
      { command, binding },
    );
    const value = await run();
    const counts = await page.evaluate(() => {
      const state = /** @type {any} */ (window).__ipcSuccessFixture;
      return { calls: state.calls, hooks: state.hooks };
    });
    return { value, ...counts };
  } finally {
    await page.evaluate((binding) => {
      const host = /** @type {any} */ (window);
      if (host.__ipcSuccessFixture?.owner === binding) {
        window.fetch = host.__ipcSuccessFixture.original;
        delete host.__ipcSuccessFixture;
      }
      delete host[binding];
    }, binding);
  }
}
