import assert from "node:assert/strict";
import { runSseExactNativeCases } from "./helpers/sse-exact-native-cases.js";
assert.equal(
  process.env.INSOMNIUM_SSE_EXACT_NATIVE,
  "1",
  "Set INSOMNIUM_SSE_EXACT_NATIVE=1 for saved native-hidden acceptance",
);
await runSseExactNativeCases();
