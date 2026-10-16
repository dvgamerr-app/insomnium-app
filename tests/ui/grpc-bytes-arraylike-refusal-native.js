import assert from "node:assert/strict";
import { runGrpcJsonRefusalNativeCases } from "./helpers/grpc-json-refusal-native-cases.js";
assert.equal(process.env.INSOMNIUM_GRPC_BYTES_ARRAYLIKE_REFUSAL_NATIVE, "1");
await runGrpcJsonRefusalNativeCases({ bytesArraylikeOnly: true });
