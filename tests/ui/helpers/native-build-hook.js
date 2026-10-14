import assert from "node:assert/strict";
/** @type {{runHook:(mode:string,target:string)=>Promise<void>}} */
const { runHook } = await import(
  new URL("../../../scripts/tauri-spectral-hook.mjs", import.meta.url).href
);
import {
  captureNativeBuildClosure,
  namespaceTarget,
} from "./native-build-closure.js";
// Tauri documented beforeBuildCommand runs before Rust compilation:
// https://v2.tauri.app/reference/config/#buildconfig
// Bun child processes: https://bun.com/docs/runtime/child-process
assert.equal(process.env.TAURI_ENV_TARGET_TRIPLE, namespaceTarget);
assert.ok(process.env.INSOMNIUM_NAMESPACE_BUILD_OUTPUT);
await runHook("build", namespaceTarget);
await captureNativeBuildClosure(process.env.INSOMNIUM_NAMESPACE_BUILD_OUTPUT);
