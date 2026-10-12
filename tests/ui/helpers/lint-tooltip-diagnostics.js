/** Saved failure-only lint lifecycle diagnostics; restore original DOM API/listeners.
 * @param {import('playwright-core').Page} page */
export async function startLintTooltipDiagnostics(page) {
  await page.evaluate(() => {
    const logs = /** @type {Array<Record<string,any>>} */ ([]),
      ids = new WeakMap(),
      append = Node.prototype.appendChild;
    let sequence = 0;
    /** @param {Element|null} el */
    const describe = (el) => {
      if (!el) return null;
      if (!ids.has(el)) ids.set(el, ++sequence);
      const b = el.getBoundingClientRect(),
        s = getComputedStyle(el);
      return {
        id: ids.get(el),
        tag: el.tagName,
        class: el.className,
        connected: el.isConnected,
        text: el.textContent?.slice(0, 150),
        style: el.getAttribute("style"),
        opacity: s.opacity,
        font: s.fontSize,
        rect: { left: b.left, top: b.top, width: b.width, height: b.height },
      };
    };
    const snapshot = () =>
      Array.from(document.querySelectorAll(".CodeMirror-lint-tooltip")).map(
        describe,
      );
    /** @param {Record<string,any>} row */
    const record = (row) => {
      if (logs.length < 2000) logs.push({ time: performance.now(), ...row });
    };
    Node.prototype.appendChild =
      /** @type {typeof Node.prototype.appendChild} */ (
        function (/** @type {Node} */ node) {
          const result = append.call(this, node);
          if (
            node instanceof Element &&
            node.classList.contains("CodeMirror-lint-tooltip")
          )
            record({
              type: "append-tooltip",
              node: describe(node),
              stack: new Error().stack,
              tooltips: snapshot(),
            });
          return result;
        }
      );
    /** @param {MouseEvent} event */
    const eventListener = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (
        !target ||
        !(
          /CodeMirror-lint/.test(target.className) ||
          target.closest(".CodeMirror")
        )
      )
        return;
      record({
        type: event.type,
        trusted: event.isTrusted,
        x: event.clientX,
        y: event.clientY,
        target: describe(target),
        related: describe(
          event.relatedTarget instanceof Element ? event.relatedTarget : null,
        ),
        tooltips: snapshot(),
      });
    };
    document.addEventListener("mouseover", eventListener, true);
    document.addEventListener("mouseout", eventListener, true);
    const observer = new MutationObserver((records) => {
      for (const r of records)
        if (
          r.target instanceof Element &&
          r.target.classList.contains("CodeMirror-lint-tooltip")
        )
          record({
            type: "tooltip-mutation",
            attribute: r.attributeName,
            oldValue: r.oldValue,
            node: describe(r.target),
            tooltips: snapshot(),
          });
    });
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["style"],
      attributeOldValue: true,
    });
    /** @type {any} */ (window).__savedLintDiagnostics = {
      logs,
      snapshot,
      restore() {
        observer.disconnect();
        document.removeEventListener("mouseover", eventListener, true);
        document.removeEventListener("mouseout", eventListener, true);
        Node.prototype.appendChild = append;
      },
    };
  });
}

/** @param {import('playwright-core').Page} page @param {string} output @param {unknown} error */
export async function saveLintTooltipFailure(page, output, error) {
  const diagnostics = await page.evaluate(() => {
    const state = /** @type {any} */ (window).__savedLintDiagnostics;
    return {
      events: state.logs,
      final: state.snapshot(),
      fontToken:
        document.documentElement.style.getPropertyValue("--font-size-12"),
      shadowToken: document.documentElement.style.getPropertyValue(
        "--editor-popup-shadow",
      ),
    };
  });
  await Bun.write(
    output + "/lint-tooltip-failure.json",
    JSON.stringify({ error: String(error), ...diagnostics }, null, 2),
  );
}

/** @param {import('playwright-core').Page} page */
export async function stopLintTooltipDiagnostics(page) {
  await page.evaluate(() => {
    /** @type {any} */ (window).__savedLintDiagnostics?.restore();
    delete (/** @type {any} */ (window).__savedLintDiagnostics);
  });
}
