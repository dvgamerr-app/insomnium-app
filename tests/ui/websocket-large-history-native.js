import assert from "node:assert/strict";
import { runWebSocketLargeHistoryNativeCases } from "./helpers/websocket-large-history-native-cases.js";
import { integrationProbeIdentifier, selectedNativeProbeIdentifier } from "./helpers/native-app.js";
import { preserveNativeProfile } from "./helpers/native-profile-preservation.js";
assert.equal(process.env.INSOMNIUM_WEBSOCKET_LARGE_HISTORY_NATIVE, "1");
if (selectedNativeProbeIdentifier() === integrationProbeIdentifier)
  await preserveNativeProfile(() => runWebSocketLargeHistoryNativeCases());
else await runWebSocketLargeHistoryNativeCases();
