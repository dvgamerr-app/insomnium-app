import assert from "node:assert/strict";
import { runWebSocketRuntimeNativeCases } from "./helpers/websocket-runtime-native-cases.js";
assert.equal(
  process.env.INSOMNIUM_WEBSOCKET_RUNTIME_NATIVE,
  "1",
  "Set INSOMNIUM_WEBSOCKET_RUNTIME_NATIVE=1 for the saved native-hidden scenario",
);
await runWebSocketRuntimeNativeCases();
