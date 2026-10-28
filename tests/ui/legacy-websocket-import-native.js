import assert from "node:assert/strict";
import { runLegacyWebSocketNativeCases } from "./helpers/legacy-websocket-native-cases.js";
import { selectedNativeProbeIdentifier, integrationProbeIdentifier } from './helpers/native-app.js';
import { preserveNativeProfile } from './helpers/native-profile-preservation.js';

assert.equal(
  process.env.INSOMNIUM_LEGACY_WEBSOCKET_NATIVE,
  "1",
  "Set INSOMNIUM_LEGACY_WEBSOCKET_NATIVE=1 for the saved native-hidden scenario",
);
if(selectedNativeProbeIdentifier()===integrationProbeIdentifier)
  await preserveNativeProfile(runLegacyWebSocketNativeCases);
else await runLegacyWebSocketNativeCases();
