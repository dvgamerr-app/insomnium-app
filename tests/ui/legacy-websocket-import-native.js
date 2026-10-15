import assert from "node:assert/strict";
import { runLegacyWebSocketNativeCases } from "./helpers/legacy-websocket-native-cases.js";

assert.equal(
  process.env.INSOMNIUM_LEGACY_WEBSOCKET_NATIVE,
  "1",
  "Set INSOMNIUM_LEGACY_WEBSOCKET_NATIVE=1 for the saved native-hidden scenario",
);
await runLegacyWebSocketNativeCases();
