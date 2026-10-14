import assert from "node:assert/strict";
/** @type {{runHook:(mode:string,target:string)=>Promise<void>}} */
const { runHook } = await import(
  new URL("../../../scripts/tauri-spectral-hook.mjs", import.meta.url).href
);
import {
  captureNativeBuildClosure,
  namespaceTarget,
  namespaceProbeIdentifier,
  auditedProbeRoute,
  auditedProbeOutput,
} from "./native-build-closure.js";
// Tauri documented beforeBuildCommand runs before Rust compilation:
// https://v2.tauri.app/reference/config/#buildconfig
// Bun child processes: https://bun.com/docs/runtime/child-process
assert.equal(process.env.TAURI_ENV_TARGET_TRIPLE, namespaceTarget);
assert.ok(process.env.INSOMNIUM_NAMESPACE_BUILD_OUTPUT);
const identifier = auditedProbeRoute(
  process.env.INSOMNIUM_NATIVE_BUILD_IDENTIFIER ?? namespaceProbeIdentifier,
).identifier;
await auditedProbeOutput(
  process.env.INSOMNIUM_NAMESPACE_BUILD_OUTPUT,
  identifier,
);
await runHook("build", namespaceTarget);
await captureNativeBuildClosure(
  process.env.INSOMNIUM_NAMESPACE_BUILD_OUTPUT,
  true,
  identifier,
);
