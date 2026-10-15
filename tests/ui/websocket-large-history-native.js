import assert from "node:assert/strict";
import { runWebSocketLargeHistoryNativeCases } from "./helpers/websocket-large-history-native-cases.js";
assert.equal(process.env.INSOMNIUM_WEBSOCKET_LARGE_HISTORY_NATIVE, "1");
await runWebSocketLargeHistoryNativeCases();
