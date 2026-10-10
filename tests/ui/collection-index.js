import assert from "node:assert/strict";
import { withComponentFixture } from "./helpers/component-fixture.js";
await withComponentFixture("collection-index", async (page, output) => {
  const rows = JSON.parse(
    await page.getByLabel("Index contract evidence").innerText(),
  );
  assert.equal(rows.length, 316);
  for (const row of rows) {
    assert.equal(row.actual, row.expected, row.name);
    if (Object.hasOwn(row, "legacy"))
      assert.equal(row.actual, row.legacy, row.name);
    if (row.name === "deep-chain") {
      assert.equal(row.size, row.count);
      assert.ok(row.reads <= row.readLimit, "Bounded topology reads");
    }
  }
  const read = async () =>
    JSON.parse(await page.getByLabel("Reactive index evidence").innerText());
  const reactive = /** @type {Record<string,any>[]} */ ([]);
  let evidence = await read();
  assert.deepEqual(evidence.requestsA, ["nested", "ws"]);
  assert.deepEqual(evidence.requestsB, ["grpc"]);
  assert.deepEqual(evidence.environmentsA, ["env", "subenv"]);
  reactive.push({ name: "initial", evidence });
  await page.getByRole("button", { name: "Move folder", exact: true }).click();
  evidence = await read();
  assert.deepEqual(evidence.requestsA, ["ws"]);
  assert.deepEqual(evidence.requestsB, ["nested", "grpc"]);
  reactive.push({ name: "move-folder", evidence });
  await page
    .getByRole("button", { name: "Move environment", exact: true })
    .click();
  evidence = await read();
  assert.deepEqual(evidence.environmentsA, []);
  assert.equal(evidence.memberships.subenv, "B");
  reactive.push({ name: "move-environment", evidence });
  await page
    .getByRole("button", { name: "Change collection type", exact: true })
    .click();
  evidence = await read();
  assert.deepEqual(evidence.requestsB, []);
  assert.equal(evidence.memberships.nested, "");
  reactive.push({ name: "change-type", evidence });
  await page
    .getByRole("button", { name: "Restore collection type", exact: true })
    .click();
  evidence = await read();
  assert.deepEqual(evidence.requestsB, ["nested", "grpc"]);
  reactive.push({ name: "restore-type", evidence });
  await page
    .getByRole("button", { name: "Rename resource ID", exact: true })
    .click();
  evidence = await read();
  assert.equal(evidence.memberships.nested, undefined);
  assert.equal(evidence.memberships.renamed, "B");
  reactive.push({ name: "rename-id", evidence });
  await page.getByRole("button", { name: "Add request", exact: true }).click();
  evidence = await read();
  assert.deepEqual(evidence.requestsA, ["ws", "added"]);
  reactive.push({ name: "add", evidence });
  await page
    .getByRole("button", { name: "Remove request", exact: true })
    .click();
  evidence = await read();
  assert.deepEqual(evidence.requestsA, ["ws"]);
  reactive.push({ name: "remove", evidence });
  await page
    .getByRole("button", { name: "Replace resources", exact: true })
    .click();
  evidence = await read();
  assert.deepEqual(evidence.requestsA, ["nested", "ws"]);
  assert.deepEqual(evidence.environmentsA, ["env", "subenv"]);
  reactive.push({ name: "replace", evidence });
  await page.getByRole("button", { name: "Edit body", exact: true }).click();
  assert.deepEqual(await read(), evidence);
  reactive.push({ name: "body-edit", evidence: await read() });
  await Bun.write(
    output + "/acceptance.json",
    JSON.stringify(
      {
        passed: true,
        rows,
        reactive,
        limits:
          "Saved headless model and Svelte-derived topology controls; production/native responsiveness requires separate saved acceptance.",
      },
      null,
      2,
    ),
  );
});
