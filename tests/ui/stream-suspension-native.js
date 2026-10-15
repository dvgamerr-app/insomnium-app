import assert from "node:assert/strict";
import { runStreamSuspensionNativeCases } from "./helpers/stream-suspension-native-cases.js";
assert.equal(
  process.env.INSOMNIUM_STREAM_SUSPENSION_NATIVE,
  "1",
  "Set INSOMNIUM_STREAM_SUSPENSION_NATIVE=1 for owned native-hidden fault injection",
);
await runStreamSuspensionNativeCases();
