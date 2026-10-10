# Plugin package discovery

2026-10-10 covered Windows native discovery and Preferences controls verified. This is the first package-admission milestone from [PLUGIN-COMPATIBILITY.md](PLUGIN-COMPATIBILITY.md); custom plugin execution and full migration remain incomplete.

Preferences now has a Plugins page with Inspect folder, Reload plugins and Default folder. Opening the page inspects the app-data plugins folder; the folder is not created if absent. A selected package folder can be inspected directly, or a container is searched for direct children, scoped packages and node_modules children. Folder selection is transient and does not rewrite legacy pluginPath/pluginConfig or PluginData. Saved disabled configuration is displayed without claiming activation. Existing shared buttons, feedback, tabs, scroll layout and theme tokens are used.

The native discover_plugins command reads package.json and entry metadata only. It never imports code, runs an installer, writes packages or activates contributions. Results distinguish pending execution, invalid names/missing entries, non-JavaScript entries, duplicate package names and per-folder/manifest failures. Ordinary libraries without their own insomnia field are omitted. Description fallback, version, CommonJS/module entry format and dependencies/optional/peer names are reported. Duplicate names retain every candidate; no arbitrary winner is activated.

Inspection is bounded by a 256 KiB manifest, 512 directory entries across the scan and 128 packages. Truncation is explicit through complete:false and a visible warning. Package manifests and resolved entries must stay inside the package's canonical directory. Linked package directories outside a container can be inspected directly, with an explicit message in the container report. Entry lookup covers main or index.js, extension fallback and directory index files. Nested directory-package main resolution, complete dependency admission, all malformed/platform/filesystem cases, persistent custom search paths and npm installation remain required work. Invalid entry metadata does not imply that code has been evaluated; module contribution types cannot be inferred from this static inspection.

Official documentation consulted before implementation:

- [Tauri commands](https://v2.tauri.app/develop/calling-rust/): separate Rust module, async IPC and spawn_blocking for file work; existing Tauri command registration/permission generator is extended without a new dependency or subsystem generator.
- [Rust read_dir](https://doc.rust-lang.org/std/fs/fn.read_dir.html): per-entry errors and nondeterministic enumeration; complete results are sorted and scan limits are reported.
- [Package metadata](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/): main, type and dependency fields. No npm executable is used.

Saved native scenario: `bun tests/ui/plugin-discovery.js` with INSOMNIUM_UI_BUILD_STATE pointing to the freshly built isolated probe. It uses the shared native-hidden helper and reusable package/dialog fixtures. The accepted corpus has13 plugins,2 manifest errors, direct/scoped/node_modules roots, explicit duplicates/invalid/unsupported entries, dependency metadata, a513-entry truncation control and code-execution marker. Mounted controls cover cancel/select/reload/direct-package/missing-folder/default recovery, six dark/light width profiles and unchanged package/workspace data. Native OS dialog replies are controlled by the existing helper; this is not OS dialog surface acceptance.

Initial compiler67648 failed with7 JS scenario annotation errors; fixed JSDoc without changing app behavior. Final compiler62823 passed0errors/0warnings; formatting and diff checks passed. Fresh production build/native acceptance are pending. Custom runtime/registration/store/hooks/actions and all six contexts/eight contribution types remain required, alongside every original full migration/UX/CSS gate.

Current source freeze is `artifacts/playwright/plugin-discovery-source-freeze.json`:471application/237scenario paths before the expected generated discover_plugins permission is produced by the frozen build.rs. Prior accepted f7c86550 executable/build-state are preserved under `artifacts/native-plugin-discovery-baseline`. Production build52765 started1791624824203, using the workspace LLVM20.1.8 LIBCLANG_PATH and no low-memory override. Current headless workspace12 passes on the new frontend. App/scenario edits are frozen until build/scenario is terminal; independent source/build/package-byte/marker/layout/native-hidden audit is prepared in artifacts/plugin-discovery-audit.mjs.

Retained saved headless theme scenario21273 exited0/result passed:true on the new frontend: dark/light1440/900/760,19 covered surfaces and persistence. Its result is `artifacts/playwright/nocturne-theme/result.json`. This is the retained browser regression, not native Plugins acceptance.

First production52765 finished0 in7m33s and bound709source/generated permission/probe/originalf7 baseline; executable SHA25629bb3dbb138563094a5a1b65f7e8301069c42ea0f67dc878efedb14fb645ecde. No native scenario was run on it. Review identified failed filesystem entries did not consume the global scan budget; after terminal, changed only plugins.rs to count both successful and failed entries. First executable/state/freeze retained under `artifacts/native-plugin-discovery-first-build` and `artifacts/playwright/plugin-discovery-first-build-freeze.json`; current709source freeze refreshed for the one Rust edit. New production34734 started1791625367426. Native acceptance remains pending on the corrected source.

## Final acceptance

Corrected production34734 finished0 (finished1791625836149), SHA256 `75d118b3c4031831e7afe2417cc539be23c957159ce65ebe8e0563ab8bcaf4ce`. The source/build binding passes709paths/probe identity/production release profile/preservedf7 baseline, including the permission generated from the frozen build.rs.

First native artifact `artifacts/playwright/plugin-discovery-1791625844709` passed13packages/2manifest errors/six profiles; native66652 exited0/native-hidden/visible:false and independent audit passed. Visual inspection found the light1440 frame captured during theme saving. After terminal, changed only the saved scenario to wait for persisted theme and hidden Saving status before capture; application/executable hashes stayed unchanged. First native freeze is retained as plugin-discovery-first-native-freeze.json. Final compiler37951 exited0/0errors0warnings.

Final native artifact `artifacts/playwright/plugin-discovery-1791625981694` passed on the same executable; native67284 exited0/native-hidden/visible:false. Independent audit verifies709current source hashes/executable/baseline,13package statuses/literal manifest names/versions/entry containment,2manifest errors,513-entry truncation, all28fixture file hashes unchanged and execution marker absent, six measured profiles and saved images. The saved scenario compares actual persisted workspace values before/after and restores the original theme. All six final images were inspected: no panel overflow, readable wrapped paths and settled controls in dark/light1440/900/760. Exact owned66652/67284 and WebView profile processes are absent, recorded in plugin-discovery-cleanup.json. No live feature handles remain.

```powershell
$env:LIBCLANG_PATH='E:/.dvgamerr-app/insomnium-app/artifacts/tools/llvm-20.1.8/bin'
Remove-Item Env:INSOMNIUM_UI_LOW_MEMORY -ErrorAction SilentlyContinue
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/plugin-discovery.js
```

Acceptance covers the listed fixture/Windows controls, not arbitrary module/dependency execution or all discovery filesystems. Parent segments in main are currently refused even if they would normalize inside the package; nested package-directory main lookup, linked package variants, manifest/dependency policy,128-package cap/platform/permission failures and close-during-inspection controls still need completion/verification. Persistent search-path/imported pluginPath migration, installation/reload/disable activation, isolated custom tags/store/hooks/actions and all eight contributions/six contexts remain required. Every original migration/UX/CSS gate remains active.
