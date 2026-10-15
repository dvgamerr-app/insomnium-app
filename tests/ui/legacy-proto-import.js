import assert from "node:assert/strict";
import { runLegacyProtoNativeCases } from "./helpers/legacy-proto-native-cases.js";

// This feature requires actual Rust proto compilation and native gRPC transport.
assert.equal(process.env.INSOMNIUM_LEGACY_PROTO_NATIVE, "1", "Set INSOMNIUM_LEGACY_PROTO_NATIVE=1 for the saved native-hidden scenario");
await runLegacyProtoNativeCases();
