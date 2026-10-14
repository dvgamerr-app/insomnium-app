import assert from "node:assert/strict";
import {
  withNativeApp,
  integrationProbeIdentifier,
  selectedNativeProbeIdentifier,
} from "./helpers/native-app.js";
import { preserveNativeProfile } from "./helpers/native-profile-preservation.js";
import { nativeErrorTree } from "./helpers/native-error.js";

assert.equal(selectedNativeProbeIdentifier(), integrationProbeIdentifier);
assert.ok(
  process.env.INSOMNIUM_UI_BUILD_STATE,
  "Explicit isolated current build required",
);
const nested = new Error("owned namespace primary assertion");
const cleanup = new Error("owned before-close assertion");
const primary = new AggregateError([nested, cleanup], "owned bridge failure", {
  cause: nested,
});
const cycle = new Error("cycle");
cycle.cause = cycle;
assert.equal(nativeErrorTree(cycle).cause.cycle, true);
const inaccessible = Object.defineProperty({}, "message", {
  get() {
    throw new Error("getter refusal");
  },
});
assert.doesNotThrow(() => nativeErrorTree(inaccessible));
assert.equal(nativeErrorTree("primitive failure").message, "primitive failure");
assert.ok(
  nativeErrorTree(
    new AggregateError(
      Array.from({ length: 100 }, () => new Error("bounded")),
      "bounded",
    ),
  ).errors.length <= 32,
);
await preserveNativeProfile(async () => {
  let output = "";
  let caught = /** @type {unknown} */ (undefined);
  try {
    await withNativeApp("native-failure-diagnostics", async (context) => {
      output = context.output;
      throw primary;
    });
  } catch (error) {
    caught = error;
  }
  assert.equal(
    caught,
    primary,
    "Cleanup must preserve the actual original AggregateError",
  );
  assert.ok(output);
  const result = await Bun.file(output + "/result.json").json();
  assert.equal(
    result.status,
    "failed",
    "An expected refusal stays a failed native receipt",
  );
  assert.equal(result.exit.code, 0);
  assert.equal(result.renderingMode, "native-hidden");
  assert.equal(result.hiddenWindow.visible, false);
  assert.equal(result.errorDetails.message, primary.message);
  assert.equal(result.errorDetails.cause.message, nested.message);
  // The repeated primary cause is explicitly marked rather than recursively duplicated.
  assert.equal(result.errorDetails.errors[0].cycle, true);
  assert.equal(result.errorDetails.errors[1].message, cleanup.message);
  await Bun.write(
    output + "/diagnostic-acceptance.json",
    JSON.stringify(
      {
        passed: true,
        originalFailurePreserved: true,
        nestedCausePreserved: true,
        cleanupFailurePreserved: true,
        boundedCyclesAndAccessors: true,
        scenarioReceiptRemainsFailed: true,
        limits:
          "Saved helper diagnostic refusal; no namespace workflow or operator acceptance",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ diagnostics: "passed", output }));
});
