import assert from "node:assert/strict";

/** @param {import('playwright-core').Page} page @param {string} name */
export async function exerciseSplit(page, name) {
  const handle = page.getByRole("separator", { name, exact: true });
  await handle.waitFor();
  await handle.focus();
  await handle.press("Enter");
  const horizontal =
    (await handle.getAttribute("aria-orientation")) === "horizontal";
  const initial = Number(await handle.getAttribute("aria-valuenow"));
  await handle.press(horizontal ? "ArrowDown" : "ArrowRight");
  assert.ok(
    Number(await handle.getAttribute("aria-valuenow")) > initial,
    name + " keyboard resize",
  );
  await handle.press("Home");
  assert.equal(
    await handle.getAttribute("aria-valuenow"),
    await handle.getAttribute("aria-valuemin"),
  );
  await handle.press("End");
  assert.equal(
    await handle.getAttribute("aria-valuenow"),
    await handle.getAttribute("aria-valuemax"),
  );
  await handle.press("Enter");
  const box = await handle.boundingBox();
  assert.ok(box);
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(
    x + (horizontal ? 0 : -50),
    y + (horizontal ? -50 : 0),
    { steps: 6 },
  );
  await page.mouse.up();
  assert.ok(
    Number(await handle.getAttribute("aria-valuenow")) < initial,
    name + " pointer resize",
  );
  await handle.press("Enter");
}
