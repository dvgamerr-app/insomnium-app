/** Controlled clipboard/dialog/write boundaries; other native IPC stays real. */
/** @param {import("playwright-core").Page} page */
export async function installResponseTransferBoundary(page) {
  await page.evaluate(() => {
    const host = /** @type {any} */ (window),
      bridge = host.__TAURI_INTERNALS__;
    const original = window.fetch;
    const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    host.__responseToolsBoundary = {
      copies: [],
      saves: [],
      writes: [],
      original,
      clipboard,
      mode: "success",
    };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (/** @type {string} */ text) => {
          host.__responseToolsBoundary.copies.push(text);
          if (host.__responseToolsBoundary.mode === "copy-error")
            throw Error("Owned clipboard refusal");
        },
      },
    });
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
      const s = host.__responseToolsBoundary;
      if (url === bridge.convertFileSrc("plugin:dialog|save", "ipc")) {
        s.saves.push(JSON.parse(String(init?.body || "{}")));
        return new Response(
          JSON.stringify(
            s.mode === "cancel" ? null : "owned-response-fixture.bin",
          ),
          {
            headers: {
              "Content-Type": "application/json",
              "Tauri-Response": "ok",
            },
          },
        );
      }
      if (url === bridge.convertFileSrc("plugin:fs|write_file", "ipc")) {
        const headers = new Headers(init?.headers);
        s.writes.push({
          bytes: Array.from(
            new Uint8Array(await new Response(init?.body).arrayBuffer()),
          ),
          headers: {
            path: headers.get("path"),
            contentType: headers.get("content-type"),
            options: headers.get("options"),
          },
        });
        return new Response(
          JSON.stringify(
            s.mode === "save-error" ? "Owned response write refusal" : null,
          ),
          {
            headers: {
              "Content-Type": "application/json",
              "Tauri-Response": s.mode === "save-error" ? "error" : "ok",
            },
          },
        );
      }
      return original.call(window, input, init);
    };
  });
  const boundary = () =>
    page.evaluate(() => {
      const s = /** @type {any} */ (window).__responseToolsBoundary;
      return { copies: s.copies, saves: s.saves, writes: s.writes };
    });
  const mode = (/** @type {string} */ mode) =>
    page.evaluate((/** @type {string} */ mode) => {
      /** @type {any} */ (window).__responseToolsBoundary.mode = mode;
    }, mode);
  return { boundary, mode };
}

/** @param {import("playwright-core").Page} page */
export async function restoreResponseTransferBoundary(page) {
  await page.evaluate(() => {
    const h = /** @type {any} */ (window),
      s = h.__responseToolsBoundary;
    window.fetch = s.original;
    if (s.clipboard) Object.defineProperty(navigator, "clipboard", s.clipboard);
    else delete (/** @type {any} */ (navigator).clipboard);
    delete h.__responseToolsBoundary;
    h.__responseToolsRestored = {
      fetch: window.fetch === s.original,
      clipboard: s.clipboard
        ? Object.getOwnPropertyDescriptor(navigator, "clipboard")?.value ===
          s.clipboard.value
        : !Object.hasOwn(navigator, "clipboard"),
    };
  });
  const restored = await page.evaluate(() => {
    const h = /** @type {any} */ (window),
      restored = h.__responseToolsRestored;
    delete h.__responseToolsRestored;
    return restored;
  });
  return restored;
}
