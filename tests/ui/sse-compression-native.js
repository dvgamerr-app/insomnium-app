import assert from "node:assert/strict";
import { runSseCompressionNativeCases } from "./helpers/sse-compression-native-cases.js";
assert.equal(
  process.env.INSOMNIUM_SSE_COMPRESSION_NATIVE,
  "1",
  "Set INSOMNIUM_SSE_COMPRESSION_NATIVE=1 for the saved native-hidden scenario",
);
await runSseCompressionNativeCases();
