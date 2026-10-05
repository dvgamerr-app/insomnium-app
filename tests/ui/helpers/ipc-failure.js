/** Inject one command failure through the native custom-protocol transport.
 * Other commands retain their real backend. No request bodies/headers are logged.
 * @template T
 * @param {import("playwright-core").Page} page
 * @param {string} command
 * @param {boolean} afterNativeSuccess
 * @param {()=>Promise<T>} run */
export async function withIpcFailure(page, command, afterNativeSuccess, run) {
  await page.evaluate(
    ({ command, afterNativeSuccess }) => {
      const host = /** @type {any} */ (window);
      if (host.__ipcFailureFixture) throw new Error("Nested IPC fault fixture");
      const original = window.fetch;
      host.__ipcFailureFixture = { original, calls: 0, completed: 0 };
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
        host.__ipcFailureFixture.calls++;
        if (afterNativeSuccess) {
          const response = await original.call(window, input, init);
          if (response.headers.get("Tauri-Response") !== "ok") return response;
          await response.arrayBuffer();
          host.__ipcFailureFixture.completed++;
        }
        return new Response(
          JSON.stringify("Injected IPC failure: " + command),
          {
            headers: {
              "Content-Type": "application/json",
              "Tauri-Response": "error",
            },
          },
        );
      };
    },
    { command, afterNativeSuccess },
  );
  try {
    const value = await run();
    const counts = await page.evaluate(() => {
      const state = /** @type {any} */ (window).__ipcFailureFixture;
      return { calls: state.calls, completed: state.completed };
    });
    return { value, ...counts };
  } finally {
    await page.evaluate(() => {
      const host = /** @type {any} */ (window);
      if (host.__ipcFailureFixture) {
        window.fetch = host.__ipcFailureFixture.original;
        delete host.__ipcFailureFixture;
      }
    });
  }
}
