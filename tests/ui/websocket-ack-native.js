import assert from "node:assert/strict";
import { runWebSocketAckNativeCases } from "./helpers/websocket-ack-native-cases.js";
assert.equal(
  process.env.INSOMNIUM_WEBSOCKET_ACK_NATIVE,
  "1",
  "Set INSOMNIUM_WEBSOCKET_ACK_NATIVE=1 for saved native-hidden acceptance",
);
await runWebSocketAckNativeCases();
