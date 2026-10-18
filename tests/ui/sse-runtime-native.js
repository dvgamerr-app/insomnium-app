import assert from "node:assert/strict";
import { runSseRuntimeNativeCases } from "./helpers/sse-runtime-native-cases.js";
import {
  integrationProbeIdentifier,
  selectedNativeProbeIdentifier,
} from "./helpers/native-app.js";
import { preserveNativeProfile } from "./helpers/native-profile-preservation.js";
assert.equal(
  process.env.INSOMNIUM_SSE_RUNTIME_NATIVE,
  "1",
  "Set INSOMNIUM_SSE_RUNTIME_NATIVE=1 for the saved native-hidden scenario",
);
if (selectedNativeProbeIdentifier() === integrationProbeIdentifier)
  await preserveNativeProfile(() => runSseRuntimeNativeCases());
else await runSseRuntimeNativeCases();
