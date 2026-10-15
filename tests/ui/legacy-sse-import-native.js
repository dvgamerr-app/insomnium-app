import assert from "node:assert/strict";
import { runLegacySseNativeCases } from "./helpers/legacy-sse-native-cases.js";
assert.equal(
  process.env.INSOMNIUM_LEGACY_SSE_NATIVE,
  "1",
  "Set INSOMNIUM_LEGACY_SSE_NATIVE=1 for the saved native-hidden scenario",
);
await runLegacySseNativeCases();
