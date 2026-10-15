import assert from "node:assert/strict";
import { runSseRuntimeNativeCases } from "./helpers/sse-runtime-native-cases.js";
assert.equal(
  process.env.INSOMNIUM_SSE_RUNTIME_NATIVE,
  "1",
  "Set INSOMNIUM_SSE_RUNTIME_NATIVE=1 for the saved native-hidden scenario",
);
await runSseRuntimeNativeCases();
