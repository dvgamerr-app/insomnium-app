# Spectral host direction and measured gates — 2026-10-12

Develop an owned Bun linter host for the complete desktop Spectral integration. The browser CSP stays unchanged. This is an implementation direction backed by the measurements below; no host command, application dependency, sidecar packaging or frontend integration has been adopted yet. Structural validation and every original semantic/custom-rule parity requirement remain active.

## Actual executable evidence

The ignored `artifacts/spectral-host-spike` package pins core1.24.0, parsers1.0.5, rulesets1.23.0, ruleset-bundler1.8.0 and ref-resolver1.0.5. Bun1.4.2 is the actual compiler/runtime. Root application package.json/bun.lock and production CSP remain unchanged.

An actual Windows x64 executable runs from a fresh temporary directory containing only the executable and owned fixture files. Its size is 93,478,400 bytes. Default semantic diagnostics return six expected findings. Custom YAML inheritance, local JS ruleset imports, validated function options, an async custom function and resolved-file diagnostic ranges produce ten findings; the complete custom result exactly matches the unbundled official API as parsed JSON in the same source context.

Twelve terminal successful executions cover default/custom, unbundled comparison, invalid custom-loader fallback to the same default diagnostics, actual loopback HTTP reference and ruleset inheritance requests, missing-file reference diagnostics, malformed YAML parser diagnostics, OAS3.0.3/3.1.0/3.2.0, Swagger2.0 and a fresh job after cancellation. The version cases demonstrate real invocation and operation diagnostics for those sample documents, not exhaustive dialect conformance. Actual HTTP requests are recorded for `/base.yaml` and `/shared.yaml`; external diagnostic source/range and error severity are checked.

A separate owned infinite custom function emits an entry marker before entering its loop. The parent observes that marker, kills the actual child, waits for terminal143 and records empty result output. A fresh custom job then reproduces the original result. This proves termination of this single owned executable operation on Windows. It does not prove native Tauri cancellation, process-tree cleanup, memory limits or arbitrary custom child-process cleanup.

Measured successful standalone job times are about368–507ms in this environment. The executable adds about89MiB before installer compression. These are material packaging/startup tradeoffs; cross-platform release and signing remain unverified.

`artifacts/spectral-host-spike/proof/manifest.json` independently freezes/rehashes5,939 source/package/lock/result inputs and binds the actual executable and isolated runtime fixture bytes. All measurement children and loopback server are terminal. Native bb75 browser acceptance is a separate generation and does not contain Spectral.

## Failures retained and corrected

- Initial direct Bun compilation refuses optional macOS `fsevents`. The probe excludes that optional Rollup watch dependency; it never starts watch mode. This is not proof of macOS compatibility.
- Direct compiled JSONC UMD fails dynamic `./impl/format` resolution. A documented Bun `onResolve` plugin selects the same package's published ESM entry. Dependency files are unchanged.
- The ordinary node ruleset-loader preset leaves Spectral package imports external in generated ruleset code. The compiled executable cannot resolve those package imports as physical package files. The package's exported `plugins/builtins` plugin, passed to its public loader plugin argument, supplies the already embedded official modules. Valid custom rules then run successfully; invalid custom loading still falls back.
- One orchestration attempt incorrectly passed input to FileSink.end rather than write; its empty-input EOF failures are retained separately. Later measurements write the request and then close stdin.
- The first isolated-fixture copy omitted hidden `.spectral.yaml`; that ENOENT failure is preserved. The final copy includes hidden files and uses a new output directory. No missing-input failure was relabeled as custom-rule acceptance.

Earlier browser UMD/environment/Ajv-CSP failures remain immutable under `spectral-browser-spike`. The native host direction does not weaken browser script policy.

## Production implementation sequence

1. Build and package a pinned target-specific executable through Bun. Follow [Bun standalone executable](https://bun.sh/docs/bundler/executables) and [plugin API](https://bun.sh/docs/bundler/plugins) contracts, plus [Tauri external binary packaging](https://v2.tauri.app/develop/sidecar/) target-triple naming. Verify installation paths, app shutdown, signing/update/resource layout and supported platform/runtime artifacts. Disable implicit dotenv/bunfig loading; hide the Windows host. Do not expose a general shell command to the frontend.
2. Implement a Rust-owned job lifecycle with closed commands and validated source/collection/repository association. Enforce input/output limits before accumulation, bounded concurrent jobs and deadlines. Drain streams without deadlock. Cancellation, workspace change, disposal and app exit must kill and physically reap the owned operation before releasing its job; define and verify process-tree handling for custom functions that create children. The prototype's post-read8MiB check and kill143 alone are insufficient production guarantees.
3. Preserve `ApiDesign.svelte`'s current source snapshot, beginWorkspaceWork lifecycle,15-second deadline, cancellation and stale-output refusal. Existing structural/request-generation worker remains authoritative for those behaviors. Join semantic results with the same current input; an old spec/result must never update a new selection or save resources. No redesign or new implementation-detail UI flow.
4. Run actual Spectral `Document` diagnostics with severity/code/message/source/range mapping and source navigation. Keep in-memory document/attached-reference data private and avoid plaintext staging of private specs. Retain32attached-files/8MiB and2MiB document bounds. Define resolver precedence between attached files, owning Git working tree and remote references; preserve current structural reference/generation behavior.
5. Resolve the owning registered Git repository before loading `other/.spectral.yaml`; do not accept arbitrary repository paths from a frontend job. Preserve legacy custom-loader failure fallback, functions/options/inheritance/local JS and file/remote resolution. Verify third-party module loading and custom-function logging/result framing; the four owned custom rules are not exhaustive custom API parity. Do not mistake process separation for a sandbox.
6. Verify the complete behavior using reusable saved headless/native-hidden scenarios: semantic findings/source clicks, Git rule edits/round-trip/fallback, reference resolution, private data preservation, cancellation of an actually entered job, deadline/close/replacement/source change, no stale diagnostics, exact profile restoration and packaged release execution. Keep full migration/Spectral marked incomplete until these gates pass.

The current code locations are `src/lib/components/ApiDesign.svelte`, `src/lib/openapi.worker.js`, `src/lib/openapi.js`, `src/lib/openapi-references.js` and native Git bindings. `src-tauri/src/git_remote_job.rs` provides an existing bounded child/reap pattern, including Windows CREATE_NO_WINDOW; it is read-only reference, not proof of a Spectral implementation.

Official API/function contracts: [Spectral JavaScript API](https://github.com/stoplightio/spectral/blob/develop/docs/guides/3-javascript.md), [custom functions](https://github.com/stoplightio/spectral/blob/develop/docs/guides/5-custom-functions.md). Published package exports and actual installed implementation are frozen in the proof.

Commands, inside the isolated package: `bun install --ignore-scripts`; `bun bundle.js`; `bun build host-esm-bundle.js --compile --external fsevents --no-compile-autoload-dotenv --no-compile-autoload-bunfig --outfile spectral-host-final-probe.exe`; `bun measure.js`; `bun freeze.js`. No Node/npm/Python or browser-use tools.

`/compact` cannot be invoked from this interface. This document is the explicit architecture handoff; full implementation and acceptance remain required.
