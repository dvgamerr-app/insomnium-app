import assert from "node:assert/strict";
import { runWebSocketFramesNativeCases } from "./helpers/websocket-frames-native-cases.js";
assert.equal(process.env.INSOMNIUM_WEBSOCKET_FRAMES_NATIVE, "1");
await runWebSocketFramesNativeCases();
