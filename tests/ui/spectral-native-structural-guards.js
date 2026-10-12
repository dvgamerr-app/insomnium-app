import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  createSpectralReferenceServer,
  spectralFixturePaths,
  spectralReferenceFiles,
} from "./helpers/spectral-native-external.js";
import { structuralFiles } from "./helpers/structural-source-fixture.js";
import { exerciseStructuralSources } from "./helpers/structural-source-cases.js";

// Preparation only: owned loopback bytes/closed paths and refusal gates, no native/profile.
const output = "artifacts/native-structural-preparation/guards-" + Date.now(),
  rows = /** @type {string[]} */ ([]);
const check = (/** @type {string} */ name) => rows.push(name);
assert.equal(spectralFixturePaths.length, 45);
check("unchanged45 closed filesystem paths");
const server = await createSpectralReferenceServer(output);
try {
  for (const name of Object.keys(structuralFiles)) {
    assert.equal(
      new TextDecoder("utf-8", { ignoreBOM: true }).decode(
        await (
          await fetch(server.origin + "/references/" + name)
        ).arrayBuffer(),
      ),
      spectralReferenceFiles("one")[name],
    );
    check("default schema bytes " + name);
  }
  server.setRepresentation("structural");
  for (const [name, raw] of Object.entries(structuralFiles)) {
    const response = await fetch(server.origin + "/references/" + name);
    assert.equal(response.status, 200);
    assert.deepEqual(
      new Uint8Array(await response.arrayBuffer()),
      new TextEncoder().encode(raw),
    );
    assert.equal(server.events.at(-1).representation, "structural");
    assert.equal(
      server.events.at(-1).sha256,
      createHash("sha256").update(raw).digest("hex"),
    );
    check("exact structural raw+receipt " + name);
  }
  assert.throws(() => server.setRepresentation("other"));
  assert.throws(() => server.setRevision("three"));
  check("closed representation/revision refusal");
  for (const path of [
    "/references/other.yaml",
    "/references/a/shared.yaml?x=1",
    "/references/many/schema-0.yaml",
  ]) {
    assert.equal((await fetch(server.origin + path)).status, 404);
    check("foreign route refusal " + path);
  }
  assert.equal(
    (
      await fetch(server.origin + "/references/a/shared.yaml", {
        method: "POST",
      })
    ).status,
    404,
  );
  check("method refusal");
  server.setRepresentation("schema");
  server.setRevision("two");
  assert.equal(
    await (await fetch(server.origin + "/references/nested/value.yaml")).text(),
    spectralReferenceFiles("two")["nested/value.yaml"],
  );
  check("schema revision restored exactly");
  assert.equal(server.events.length, 7);
  check("refused routes never consumed");
} finally {
  await server.close();
}
for (const origin of [
  undefined,
  "https://127.0.0.1:1234",
  "http://example.com:1234",
]) {
  await assert.rejects(() =>
    exerciseStructuralSources(
      /** @type {any} */ ({ url: () => "http://tauri.localhost/" }),
      output,
      {
        native: true,
        referenceOrigin: origin,
        state: async () => ({}),
        snapshot: async () => ({}),
        configureCase: async () => ({}),
      },
    ),
  );
  check("native explicit loopback refusal " + String(origin));
}
const rootOracle = await Bun.file(
    "artifacts/native-structural-preparation/root-review-snapshot/tests/ui/helpers/spectral-api-design.js",
  ).text(),
  oracle = await Bun.file("tests/ui/helpers/spectral-api-design.js").text();
assert.equal(
  oracle.replaceAll("\r\n", "\n"),
  rootOracle.replaceAll("\r\n", "\n"),
);
assert.equal((oracle.match(/assert\.\w+\(/g) || []).length, 73);
assert.equal(
  (oracle.match(/resource\.sourceSpecId === specId/g) || []).length,
  2,
);
check("whole current73 oracle+ownership filters unchanged");
await Bun.write(
  output + "/guard-result.json",
  JSON.stringify(
    {
      passed: true,
      guards: rows,
      scope: "Preparation only, no native/profile",
      nativeLaunches: 0,
      profileWrites: 0,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ passed: true, guards: rows.length, output }));
