import assert from "node:assert/strict";

/** Controlled native dialog reply; remaining IPC uses the actual backend.
 * This verifies mounted Browse wiring/cancel behavior, not the OS dialog surface.
 * @param {import('playwright-core').Page} page @param {string|null} selection
 * @param {()=>Promise<void>} run */
export async function withDialogSelection(page, selection, run) {
  await page.evaluate((selection) => {
    const host = /** @type {any} */ (window);
    if (host.__dialogSelection) throw new Error("Nested dialog fixture");
    const original = window.fetch;
    host.__dialogSelection = { original, calls: 0, options: null };
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
      if (
        url !==
        host.__TAURI_INTERNALS__.convertFileSrc("plugin:dialog|open", "ipc")
      )
        return original.call(window, input, init);
      host.__dialogSelection.calls++;
      host.__dialogSelection.options = JSON.parse(String(init?.body || "{}"));
      return new Response(JSON.stringify(selection), {
        headers: { "Content-Type": "application/json", "Tauri-Response": "ok" },
      });
    };
  }, selection);
  try {
    await run();
    const result = await page.evaluate(() => {
      const state = /** @type {any} */ (window).__dialogSelection;
      return { calls: state.calls, options: state.options };
    });
    assert.equal(result.calls, 1);
    return result;
  } finally {
    await page.evaluate(() => {
      const host = /** @type {any} */ (window);
      window.fetch = host.__dialogSelection.original;
      delete host.__dialogSelection;
    });
  }
}
