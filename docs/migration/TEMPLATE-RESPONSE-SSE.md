# SSE response-template completion

The SSE mode of the existing saved template-response-send scenario exercises SSE-labelled dependencies through real mounted Windows application, bundled template workers and Rust HTTP transport. The shared held HTTP helper optionally sends headers and a first body chunk while holding EOF. Other callers retain their previous behavior when that option is omitted. The native host is hidden before CDP attachment; browser scenarios continue using headless:true.

```powershell
bun run check
$env:INSOMNIUM_TEMPLATE_SSE='1'
Remove-Item Env:INSOMNIUM_TEMPLATE_ENVIRONMENTS -ErrorAction SilentlyContinue
bun tests/ui/template-response-send.js
```

Four groups cover complete literal SSE framing/base64 and Accept header, header extraction waiting for EOF despite available headers/first event, root Cancel disconnecting a partially received dependency, and real native1500ms timeout without root dispatch or partial-success history. The header case observes unchanged history/root wire and active Cancel before explicitly releasing EOF. Requests remain HTTP response-tag dependencies; they do not create a live SSE event pane.

Sources consulted: [MDN SSE format](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events). Existing subsystem/helper reused; no generator or dependency needed. Initial runs used production01515fc0526bc20cfc56ebf01005051805df164432b122877377ce44f81bdd08. The final native timeout fix changes only http.rs among468 application paths; frontend/CSS remain unchanged. Frozen source is artifacts/playwright/template-sse-source-freeze.json, binding468 app plus235 scenario paths.

Initial compiler33577 reported one possibly-undefined wire.at(-1) assertion. Native70736/artifact1791617044627 had already launched and finished terminal0/4groups, native56568 exit0/native-hidden/visible:false. After terminal the assertion was corrected to optional access and actual displayed timeout error text was added. Final compiler83371 terminal0/0errors0warnings and formatting pass. First-run source freeze is retained separately. Corrected native57151/artifact1791617243227 then failed as detailed below; initial runs do not accept the final timeout fix.

Live SSE event-log versus completed raw history reconciliation, endless body bounds, network faults/provider/protocol/platform/accessibility and all original migration/shared UI/UX/CSS gates remain required. This scenario does not establish full SSE or full migration parity.

Corrected native57151 terminal1 after three groups: its stronger displayed-timeout assertion exposes native `error decoding response body`, although timeout disconnect/no root/no partial history assertions pass. Reqwest Display discards the timeout cause category; pinned vendored0.12.28 Error::is_timeout traverses nested causes. Native http.rs now uses this classification for execute and chunk errors, reporting existing `Request timed out` text. Other error messages are retained. Reference: [reqwest Error::is_timeout](https://docs.rs/reqwest/0.12.28/reqwest/struct.Error.html#method.is_timeout). No UI/CSS change.

Fresh build command: `bun tests/ui/build-recovery-copy-probe.js`, production release/no low-memory override. Original release01515fc0 is preserved under artifacts/native-template-sse-baseline. Targeted `rustfmt --edition 2021 --check src-tauri/src/http.rs` passes; broader cargo fmt check reports existing unrelated formatting only. Initial freeze update rejected ArrayBuffer before write and was corrected to Buffer.

Build40937 finished terminal1: stale LIBCLANG_PATH E:/insomnium is absent after workspace relocation, and libuv bindgen failed. Failure state retained in artifacts/playwright/template-sse-build-clang-failure.json. Corrected invocation uses `$env:LIBCLANG_PATH='E:/.dvgamerr-app/insomnium-app/artifacts/tools/llvm-20.1.8/bin'`, then the same saved build command.

Build21161 completed terminal0/optimized release6m55s. Saved binding command `bun artifacts/template-sse-build-bind.mjs` verifies703 current hashes, isolated probe identity, preserved baseline and fresh executable SHA c2fbaa430547aa47b2247213cc9579119bb52aae66bf47025775a0e7de6989aa, recorded in template-sse-build.json. Saved headless workspace regression passes11 groups/current frontend/terminal0; compiler83371 and targeted Rust formatting pass.

Fresh native59161/artifact1791617973562 terminal0 accepts4groups/3wire/4workers; native67880 exit0/native-hidden/visible:false. `bun artifacts/template-sse-audit.mjs artifacts/playwright/template-response-sse-1791617973562` independently verifies current703 hashes/executable/raw framing/body/base64/EOF/history/selection/Cancel and actual displayed timeout text.

Ordinary HTTP regression25579/artifact1791618102468 terminal0 accepts19groups/43workers/20wire plus one held dependency on the same fresh release; native68164 exit0/native-hidden/visible:false. `bun artifacts/template-sse-http-regression-audit.mjs artifacts/playwright/template-response-send-1791618102468` independently verifies current703 hashes/executable/literal JSON/XML/header/raw values, trigger wire order, nested/foreign Base routing, native Cancel socket disconnect and stopped-worker late callbacks/manual edit preservation. The audit uses the current SSE freeze rather than the earlier release freeze. It proves the shared fixture's default no-initial-chunk cancellation behavior still works.

Exact owned56568/69328/67880/68164 and all four artifact WebView2 profiles are absent, recorded in artifacts/playwright/template-sse-cleanup.json. No live feature handles remain. Compiler83371 terminal0/0errors0warnings, targeted Rust formatting, scenario formatting, saved headless workspace11 and optimized production build pass. Scope is the native timeout identity fix and covered SSE completion/default HTTP regressions; remaining migration gates above stay active.
