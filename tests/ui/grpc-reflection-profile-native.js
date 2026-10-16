import assert from "node:assert/strict";
import { runGrpcLargeSentNativeCases } from "./helpers/grpc-large-sent-native-cases.js";
assert.equal(process.env.INSOMNIUM_GRPC_REFLECTION_PROFILE_NATIVE, "1");
await runGrpcLargeSentNativeCases({ reflectionProfileOnly: true });
