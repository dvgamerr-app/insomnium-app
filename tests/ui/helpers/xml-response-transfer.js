import assert from "node:assert/strict";
import { poll } from "./native-app.js";
import { source, pretty, selections } from "../fixtures/xml-response.js";
import {
  installResponseTransferBoundary,
  restoreResponseTransferBoundary,
} from "./response-transfer-boundary.js";

/** @param {Record<string,any>} context */
export async function verifyXmlResponseTransfer(context) {
  const { page, pane, value, apply, saved, output, workers, wire } = context;
  const { boundary, mode } = await installResponseTransferBoundary(page);
  const checks = [];
  let restored;
  const copy = pane.getByRole("button", { name: "Copy response", exact: true });
  const save = pane.getByRole("button", { name: "Save response", exact: true });
  const original = await saved();
  try {
    for (const [expression, expected] of [
      selections[0],
      selections[2],
      selections[3],
      selections[6],
    ]) {
      await apply(expression, expected);
      const before = await boundary();
      await copy.click();
      await poll(
        async () =>
          (await boundary()).copies.length === before.copies.length + 1,
        "XML filtered Copy",
      );
      await save.click();
      await poll(
        async () =>
          (await boundary()).writes.length === before.writes.length + 1,
        "XML original Save",
      );
      const current = await boundary();
      assert.equal(current.copies.at(-1), expected);
      assert.deepEqual(
        current.writes.at(-1).bytes,
        Array.from(Buffer.from(source)),
      );
      assert.deepEqual(current.saves.at(-1), {
        options: { defaultPath: "response.bin" },
      });
      assert.equal(
        current.writes.at(-1).headers.path,
        "owned-response-fixture.bin",
      );
      const state = await saved(expression);
      assert.deepEqual(state.response, original.response);
      checks.push({ kind: "filtered-transfer", expression, expected, state });
    }
    await pane.getByRole("button", { name: "Raw", exact: true }).click();
    assert.equal(await value(), source);
    await copy.click();
    assert.equal((await boundary()).copies.at(-1), source);
    await pane.getByRole("button", { name: "Pretty", exact: true }).click();
    await pane.getByRole("button", { name: "Clear", exact: true }).click();
    await poll(
      async () => (await value()) === pretty,
      "XML Pretty after Clear",
      60000,
    );
    await copy.click();
    assert.equal((await boundary()).copies.at(-1), pretty);
    checks.push({
      kind: "raw-pretty-copy",
      source,
      pretty,
      state: await saved(""),
    });
    const beforeCancel = await boundary();
    await mode("cancel");
    await save.click();
    await poll(
      async () =>
        (await boundary()).saves.length === beforeCancel.saves.length + 1,
      "XML cancelled Save",
    );
    assert.equal((await boundary()).writes.length, beforeCancel.writes.length);
    checks.push({ kind: "cancel", boundary: await boundary() });
    await mode("copy-error");
    await copy.click();
    await pane
      .getByRole("alert")
      .filter({ hasText: "Error: Owned clipboard refusal" })
      .waitFor();
    await mode("success");
    await copy.click();
    await poll(
      async () => (await pane.getByRole("alert").count()) === 0,
      "XML Copy recovery",
    );
    assert.equal((await boundary()).copies.at(-1), pretty);
    checks.push({ kind: "copy-refusal-recovery", state: await saved("") });
    await mode("save-error");
    await save.click();
    await pane
      .getByRole("alert")
      .filter({ hasText: "Owned response write refusal" })
      .waitFor();
    await mode("success");
    const beforeRecovery = await boundary();
    await save.click();
    await poll(
      async () =>
        (await boundary()).writes.length === beforeRecovery.writes.length + 1 &&
        (await pane.getByRole("alert").count()) === 0,
      "XML Save recovery",
    );
    assert.deepEqual(
      (await boundary()).writes.at(-1).bytes,
      Array.from(Buffer.from(source)),
    );
    const state = await saved("");
    assert.deepEqual(state.response, original.response);
    checks.push({ kind: "save-refusal-recovery", state });
  } finally {
    await Bun.write(
      output + "/copy-save-boundary.json",
      JSON.stringify(await boundary(), null, 2),
    );
    restored = await restoreResponseTransferBoundary(page);
  }
  assert.deepEqual(restored, { fetch: true, clipboard: true });
  await Bun.write(
    output + "/transfer-acceptance.json",
    JSON.stringify(
      {
        passed: true,
        checks,
        restored,
        workers,
        wire,
        limits:
          "Mounted native XML with controlled clipboard/dialog/write boundaries; actual OS clipboard/file dialogs and full migration remain unverified.",
      },
      null,
      2,
    ),
  );
}
