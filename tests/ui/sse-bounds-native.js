import assert from "node:assert/strict";
import { runSseBoundsNativeCases } from "./helpers/sse-bounds-native-cases.js";

assert.equal(process.env.INSOMNIUM_SSE_BOUNDS_NATIVE, "1");
await runSseBoundsNativeCases();
