import assert from "node:assert/strict";
import { runMixedStreamNativeCases } from "./helpers/mixed-stream-native-cases.js";
assert.equal(
  process.env.INSOMNIUM_MIXED_STREAM_NATIVE,
  "1",
  "Set INSOMNIUM_MIXED_STREAM_NATIVE=1 for the saved native-hidden scenario",
);
await runMixedStreamNativeCases();
