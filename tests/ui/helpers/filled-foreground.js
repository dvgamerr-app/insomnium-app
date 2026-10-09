import assert from "node:assert/strict";

/** Measure text tokens without activating controls; restore all inline overrides.
 * @param {import("playwright-core").Page} page
 * @param {{selector:string,token:string,states?:string[]}[]} targets
 * @param {string} [output] */
export async function assertFilledForeground(page, targets, output) {
  const root = page.locator("html");
  const keys = ["--on-accent", "--on-danger", "--on-success"];
  const prior = await root.evaluate(
    (el, keys) =>
      keys.map((key) => [
        key,
        el.style.getPropertyValue(key),
        el.style.getPropertyPriority(key),
      ]),
    keys,
  );
  const rows = [];
  const previous = (await page.locator(":focus").count())
    ? await page.locator(":focus").elementHandle()
    : null;
  try {
    for (const target of targets) {
      const control = page.locator(target.selector).first();
      await control.waitFor({ state: "visible" });
      const own = await control.evaluate(
        (el, key) => [
          el.style.getPropertyValue(key),
          el.style.getPropertyPriority(key),
        ],
        target.token,
      );
      try {
        for (const state of target.states || ["default"]) {
          await control.evaluate((el) => el.blur());
          await page.mouse.move(0, 0);
          if (state === "hover") await control.hover();
          if (state === "focus") {
            await control.focus();
            await page.keyboard.press("Tab");
            await control.focus();
            assert.equal(
              await control.evaluate((el) => el.matches(":focus-visible")),
              true,
            );
          }
          await page.waitForTimeout(150);
          const measure = () =>
            control.evaluate((el) => {
              const s = getComputedStyle(el);
              return {
                color: s.color,
                background: s.backgroundColor,
                width: s.width,
                height: s.height,
                font: s.fontSize,
                line: s.lineHeight,
                radius: s.borderRadius,
              };
            });
          const before = await measure();
          assert.equal(
            before.color,
            "rgb(255, 255, 255)",
            "Default filled foreground remains white",
          );
          await root.evaluate(
            (el, key) => el.style.setProperty(key, "rgb(1, 2, 3)"),
            target.token,
          );
          const global = await measure();
          if (output)
            await Bun.write(
              output + "/filled-foreground-progress.json",
              JSON.stringify({
                target,
                state,
                before,
                global,
                expected: "rgb(1, 2, 3)",
              }),
            );
          assert.equal(
            global.color,
            "rgb(1, 2, 3)",
            "Global token propagates to " + target.selector + "/" + state,
          );
          assert.deepEqual(
            { ...global, color: before.color },
            before,
            "Foreground override preserves geometry/background",
          );
          await control.evaluate(
            (el, key) => el.style.setProperty(key, "rgb(4, 5, 6)"),
            target.token,
          );
          const scoped = await measure();
          assert.equal(
            scoped.color,
            "rgb(4, 5, 6)",
            "Local token propagates including focus fallback",
          );
          assert.deepEqual({ ...scoped, color: before.color }, before);
          await control.evaluate(
            (el, { key, own }) => {
              if (own[0]) el.style.setProperty(key, own[0], own[1]);
              else el.style.removeProperty(key);
            },
            { key: target.token, own },
          );
          await root.evaluate(
            (el, { key, prior }) => {
              const row = prior.find((r) => r[0] === key);
              if (!row) throw new Error("Unknown foreground token: " + key);
              if (row[1]) el.style.setProperty(key, row[1], row[2]);
              else el.style.removeProperty(key);
            },
            { key: target.token, prior },
          );
          assert.deepEqual(await measure(), before, "Exact restoration");
          rows.push({
            selector: target.selector,
            token: target.token,
            state,
            before,
            global,
            scoped,
            restored: true,
          });
        }
      } finally {
        await control.evaluate(
          (el, { key, own }) => {
            if (own[0]) el.style.setProperty(key, own[0], own[1]);
            else el.style.removeProperty(key);
          },
          { key: target.token, own },
        );
      }
    }
  } finally {
    await root.evaluate((el, prior) => {
      for (const [key, value, priority] of prior) {
        if (value) el.style.setProperty(key, value, priority);
        else el.style.removeProperty(key);
      }
    }, prior);
    await previous?.focus().catch(() => {});
  }
  return rows;
}
