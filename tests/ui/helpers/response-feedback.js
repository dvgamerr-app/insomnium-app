import assert from "node:assert/strict";
import { poll } from "./native-app.js";

/** Mounted feedback recovery/ownership; controlled clipboard/Save boundaries only.
 * @param {Record<string,any>} c */
export async function verifyResponseFeedback(c) {
  const {
    page,
    output,
    pane,
    value,
    saved,
    send,
    requestId,
    source,
    pretty,
    wire,
  } = c;
  const checks = /** @type {Record<string,any>[]} */ ([]);
  await page.evaluate(() => {
    const host = /** @type {any} */ (window),
      bridge = host.__TAURI_INTERNALS__;
    const original = window.fetch,
      clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    const records = /** @type {any[]} */ ([]),
      pending = new Map();
    const state = { original, clipboard, records, pending, mode: "success" };
    host.__responseFeedbackBoundary = state;
    const record = (/** @type {string} */ kind, /** @type {any} */ payload) => {
      const r = {
        kind,
        payload,
        mode: state.mode,
        createdAt: performance.now(),
        settled: false,
        outcome: /** @type {string|null} */ (null),
      };
      records.push(r);
      return r;
    };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (/** @type {string} */ text) => {
          const r = record("copy", { text });
          if (state.mode === "hold")
            return new Promise((resolve, reject) =>
              pending.set(
                records.length - 1,
                (/** @type {string} */ outcome) => {
                  r.settled = true;
                  r.outcome = outcome;
                  outcome === "error"
                    ? reject(Error("Owned delayed copy failure"))
                    : resolve(undefined);
                },
              ),
            );
          r.settled = true;
          r.outcome = state.mode === "error" ? "error" : "success";
          if (state.mode === "error") throw Error("Owned copy failure");
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
      const reply = (
        /** @type {any} */ value,
        /** @type {boolean} */ error = false,
      ) =>
        new Response(JSON.stringify(value), {
          headers: {
            "Content-Type": "application/json",
            "Tauri-Response": error ? "error" : "ok",
          },
        });
      if (url === bridge.convertFileSrc("plugin:dialog|save", "ipc")) {
        const r = record("save-dialog", JSON.parse(String(init?.body || "{}")));
        r.settled = true;
        r.outcome = state.mode === "cancel" ? "cancel" : "success";
        return reply(
          state.mode === "cancel" ? null : "owned-feedback-fixture.bin",
        );
      }
      if (url === bridge.convertFileSrc("plugin:fs|write_file", "ipc")) {
        const r = record("save", {
          bytes: Array.from(
            new Uint8Array(await new Response(init?.body).arrayBuffer()),
          ),
        });
        if (state.mode === "hold")
          return new Promise((resolve) =>
            pending.set(records.length - 1, (/** @type {string} */ outcome) => {
              r.settled = true;
              r.outcome = outcome;
              resolve(
                reply(
                  outcome === "error" ? "Owned delayed save failure" : null,
                  outcome === "error",
                ),
              );
            }),
          );
        r.settled = true;
        r.outcome = state.mode === "error" ? "error" : "success";
        return reply(
          state.mode === "error" ? "Owned save failure" : null,
          state.mode === "error",
        );
      }
      return original.call(window, input, init);
    };
  });
  const records = () =>
    page.evaluate(
      () => /** @type {any} */ (window).__responseFeedbackBoundary.records,
    );
  const mode = (/** @type {string} */ mode) =>
    page.evaluate((/** @type {string} */ mode) => {
      /** @type {any} */ (window).__responseFeedbackBoundary.mode = mode;
    }, mode);
  const release = (
    /** @type {number} */ index,
    /** @type {string} */ outcome,
  ) =>
    page.evaluate(
      (/** @type {{index:number,outcome:string}} */ { index, outcome }) => {
        const s = /** @type {any} */ (window).__responseFeedbackBoundary;
        if (!s.pending.has(index)) throw Error("Missing held boundary");
        s.pending.get(index)(outcome);
        s.pending.delete(index);
      },
      { index, outcome },
    );
  const copy = () =>
    pane.getByRole("button", { name: "Copy response", exact: true });
  const button = (/** @type {string} */ kind) =>
    kind === "copy"
      ? copy()
      : pane.getByRole("button", { name: "Save response", exact: true });
  const icon = () =>
    copy()
      .locator("svg")
      .evaluate((/** @type {SVGElement} */ el) => el.innerHTML);
  const idleIcon = await icon();
  const progress = async () =>
    Bun.write(
      output + "/feedback-progress.json",
      JSON.stringify({ checks, records: await records(), wire }, null, 2),
    );
  /** @param {string} kind @param {boolean} held */
  async function click(kind, held = false) {
    const start = (await records()).length;
    await button(kind).click();
    await poll(
      async () =>
        (await records())
          .slice(start)
          .some(
            (/** @type {any} */ r) => r.kind === kind && (held || r.settled),
          ),
      "Feedback boundary: " + kind,
      15000,
    );
    const rows = await records();
    return rows.findIndex(
      (/** @type {any} */ r, /** @type {number} */ index) =>
        index >= start && r.kind === kind,
    );
  }
  try {
    for (const kind of ["copy", "save"]) {
      await mode("error");
      const refused = await click(kind);
      const message =
        kind === "copy" ? "Error: Owned copy failure" : "Owned save failure";
      await pane.getByText(message, { exact: true }).waitFor();
      await mode("success");
      const retried = await click(kind);
      await Bun.write(
        output + `/recovery-${kind}-diagnostics.json`,
        JSON.stringify(
          {
            records: await records(),
            oldErrorCount: await pane
              .getByText(message, { exact: true })
              .count(),
            body: await value(),
          },
          null,
          2,
        ),
      );
      await poll(
        async () =>
          (await pane.getByText(message, { exact: true }).count()) === 0,
        "Successful " + kind + " clears old error",
        5000,
      );
      assert.equal(await value(), pretty);
      checks.push({ kind: "recovery", operation: kind, refused, retried });
      await progress();
      // Refusals must also be announced through shared Feedback.
      await mode("error");
      await click(kind);
      await pane.getByRole("alert").filter({ hasText: message }).waitFor();
      await mode("success");
      await click(kind);
      await poll(
        async () => (await pane.getByRole("alert").count()) === 0,
        "Recovery alert cleared",
        5000,
      );
    }
    await mode("error");
    await click("save");
    await pane.getByRole("alert").waitFor();
    await mode("cancel");
    const start = (await records()).length;
    await button("save").click();
    await poll(
      async () => (await records()).length === start + 1,
      "Cancelled picker has no write",
    );
    assert.equal(await pane.getByRole("alert").count(), 0);
    checks.push({ kind: "cancel-recovery" });
    await progress();
    for (const operation of ["copy", "save"])
      for (const destination of ["request", "response", "unmount", "format"])
        for (const outcome of ["error", "success"]) {
          await mode("hold");
          const held = await click(operation, true);
          if (destination === "request")
            await page
              .locator("button.tree-request")
              .filter({
                has: page.getByText("Other JSON response", { exact: true }),
              })
              .click();
          else if (destination === "response") await send();
          else if (destination === "format")
            await pane
              .getByRole("button", { name: "Raw", exact: true })
              .click();
          else
            await page
              .getByRole("navigation", { name: "Main navigation" })
              .getByRole("button", { name: "API Design", exact: true })
              .click();
          await release(held, outcome);
          if (destination === "request")
            await page
              .locator("button.tree-request")
              .filter({
                has: page.getByText("Owned JSON response", { exact: true }),
              })
              .click();
          if (destination === "unmount")
            await page
              .getByRole("navigation", { name: "Main navigation" })
              .getByRole("button", { name: "Collections", exact: true })
              .click();
          if (destination === "format")
            await pane
              .getByRole("button", { name: "Pretty", exact: true })
              .click();
          await copy().waitFor();
          await poll(
            async () => (await records())[held].settled,
            "Held boundary settled",
          );
          assert.equal(await pane.getByRole("alert").count(), 0);
          assert.equal(await pane.locator(".inline-error").count(), 0);
          assert.equal(await icon(), idleIcon);
          assert.equal(await value(), pretty);
          checks.push({
            kind: "ownership",
            operation,
            destination,
            outcome,
            held,
          });
          await progress();
        }
    for (const operation of ["copy", "save"]) {
      await mode("hold");
      const held = await click(operation, true);
      await mode("success");
      const newer = await click("copy");
      await poll(
        async () => (await icon()) !== idleIcon,
        "Newer Copy succeeds",
      );
      await release(held, "error");
      assert.equal(await pane.getByRole("alert").count(), 0);
      assert.notEqual(await icon(), idleIcon);
      checks.push({ kind: "ordering", operation, held, newer });
      await progress();
    }
    await mode("success");
    const firstTimer = await click("copy");
    await poll(async () => (await icon()) !== idleIcon, "First Copy success");
    await page.waitForTimeout(1000);
    const newerTimer = await click("copy");
    await poll(async () => (await icon()) !== idleIcon, "Newer Copy success");
    await page.waitForTimeout(1000);
    assert.notEqual(
      await icon(),
      idleIcon,
      "Older timer cannot clear newer success",
    );
    checks.push({ kind: "timer-ordering", firstTimer, newerTimer });
    await click("copy");
    await poll(async () => (await icon()) !== idleIcon, "Copy success icon");
    await poll(
      async () => (await icon()) === idleIcon,
      "Copy icon reset deadline",
      5000,
    );
    checks.push({ kind: "success-timer" });
    const state = await saved();
    assert.equal(state.response.body, source);
    assert.equal(
      state.response.bodyBase64,
      Buffer.from(source).toString("base64"),
    );
    assert.equal(state.meta.extra.retained, 42);
    await Bun.write(
      output + "/feedback-acceptance.json",
      JSON.stringify(
        {
          passed: true,
          checks,
          records: await records(),
          wire,
          state,
          requestId,
          limits:
            "Mounted native response feedback with controlled clipboard/dialog/write boundaries; actual OS surfaces and broader editor/platform/migration gates remain required.",
        },
        null,
        2,
      ),
    );
  } finally {
    await progress();
    await page.evaluate(() => {
      const h = /** @type {any} */ (window),
        s = h.__responseFeedbackBoundary;
      for (const finish of s.pending.values()) finish("success");
      s.pending.clear();
      window.fetch = s.original;
      if (s.clipboard)
        Object.defineProperty(navigator, "clipboard", s.clipboard);
      else delete (/** @type {any} */ (navigator).clipboard);
      h.__responseFeedbackRestored = {
        fetch: window.fetch === s.original,
        clipboard: s.clipboard
          ? Object.getOwnPropertyDescriptor(navigator, "clipboard")?.value ===
            s.clipboard.value
          : !Object.hasOwn(navigator, "clipboard"),
      };
      delete h.__responseFeedbackBoundary;
    });
    const restored = await page.evaluate(() => {
      const h = /** @type {any} */ (window),
        r = h.__responseFeedbackRestored;
      delete h.__responseFeedbackRestored;
      return r;
    });
    await Bun.write(
      output + "/feedback-restoration.json",
      JSON.stringify(restored),
    );
    assert.deepEqual(restored, { fetch: true, clipboard: true });
  }
}
