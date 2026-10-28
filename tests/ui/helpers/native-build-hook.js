import assert from "node:assert/strict";
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
const config = await Bun.file(new URL("../../../src-tauri/tauri.conf.json", import.meta.url)).json();
assert.equal(config.build.beforeBuildCommand, "bun run build", "Production frontend build command changed");
const child = Bun.spawn([process.execPath, "run", "build"], {stdin:"inherit",stdout:"inherit",stderr:"inherit"});
assert.equal(await child.exited, 0, "Production frontend build failed");
await captureNativeBuildClosure(
  process.env.INSOMNIUM_NAMESPACE_BUILD_OUTPUT,
  true,
  identifier,
);
