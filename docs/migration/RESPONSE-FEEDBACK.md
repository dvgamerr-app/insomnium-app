# Response Copy/Save feedback recovery and ownership

Status: correction and scoped feedback/tools/filter regressions verified (2026-10-10).

Baseline52497/artifact `json-response-filter-1791600297879` exits1 while native
64284 exits0/hidden. Two Copy boundaries settle error then success, but oldErrorCount
stays1 and original numeric text remains. This proves the retry bug. Old production
executable89bbb511 and exact baseline source/build are retained in
`artifacts/native-response-feedback-baseline` and response-feedback-baseline-freeze.json.

ResponsePane now uses raw feedback records owned by a derived request/response
ID, original body/bytes and displayed text. Each operation gets a generation;
retry clears earlier feedback, old completion/timers cannot change a newer
owner/operation and onDestroy invalidates outstanding completions. Display owner
identity prevents feedback reappearing after request/Pretty-Raw round trips.
Existing filter-application errors use the same guard; errors pass role=alert to
the shared Feedback component. Layout/CSS, original-byte Save and displayed Copy
payloads remain unchanged. No reset effect or native/backend/dependency change.

Fresh saved production21725 exits0, started1791600646689/finished1791601074387,
executable SHA256 `20458ce222ec9977976c7dfdeee5be51ba0478feedff73d6f9d40fffa92920cb`.
Frozen692 app/scenario paths match with exactly one app file changed. Initial
scenario and application assignment/declaration diagnostics were corrected before
build; final compiler0/0. Unrelated Timeline formatter changes were reverted.
Saved current frontend headless workspace scenario exits0/eleven checks.

Native feedback11095/artifact `json-response-filter-1791601149652` exits0/native
51684 exit0/native-hidden/visible:false. Twenty-three groups prove two retry/alert
recoveries, cancelled Save, sixteen late success/error cases across request,
response, unmount and Pretty-Raw, two newer-operation guards, older timer and
normal success-icon timeout. The adapter captures18 Copy/15dialog/14write
boundaries (47total) and five actual HTTP Sends. Independent source/build/baseline
failure/literal body/base64/metadata/boundary/timer/restoration audit passes.

Native tools60210/artifact `json-response-filter-1791601261476` exits0/native23580
exit0/native-hidden, nine groups/three Sends/six dark-light width profiles pass.
Independent current692/fresh executable/payload/history/timer/geometry/restoration
audit passes; current dark/light760 images inspected.

Default regression91664/artifact1791601427607 exited0 with26groups, but the
independent audit rejected its workspace cancellation's late snapshot equality:
the destination's separately held worker timed out while native persistence was
read. The immediate stale-callback assertion had passed. Retain this failure;
it does not establish that the old worker changed the destination.

The saved fixture now completes that destination worker before injecting old
callbacks and records destination workspace/request/response/metadata before
and after. Corrected default55009/artifact `json-response-filter-1791602462836`
exits0, native60868 exits0/native-hidden/visible:false, with26groups/11real
workers/21HTTP Sends. The combined regression audit passes late preview equality
and exact destination state equality, plus literal body/base64/metadata,
cancellation/deadline/fault/history and all six responsive profiles. The explicit
acceptance freeze matches692current source paths and records only this default
scenario change; application, feedback helper and executable remain unchanged.
Feedback23 and tools9 remain tied to their earlier harness freeze, rather than
being described as rerun after the default-only fixture correction.

Owned cleanup confirms all five probe PIDs and their exact WebView profiles are
absent; all feature scenario/build handles are terminal. Other processes were
not terminated. Headless workspace eleven checks passed again after the owner
follow-up. Compiler/formatting and commit results are recorded in STATUS.

Previously ResponsePane catch handlers assigned copyError, but successful retries
did not reset it. Feedback/copied state lacked request/response and async
operation ownership. The existing saved JSON response scenario now has a
`INSOMNIUM_RESPONSE_FEEDBACK=1` extension to reproduce recovery before changing
application source, then verify Copy/Save recovery/cancellation, alert semantics,
late success/error after request/response/unmount, overlapping operations and
the normal success-icon timer. Clipboard/dialog/write boundaries are controlled;
other native IPC/HTTP/history remain actual. OS clipboard/picker/write and all
remaining editor/XPath/provider/platform/shared UI/UX/CSS requirements remain open.

Commands: `bun run check`, `bun artifacts/playwright/freeze-response-feedback-baseline.mjs`,
then set `INSOMNIUM_RESPONSE_FEEDBACK=1` and run
`bun tests/ui/json-response-filter.js`. Retain the old executable/build state
before correction and require a fresh production probe after application edits.

Fresh build: `bun tests/ui/build-recovery-copy-probe.js`; source freeze/build
binding: `bun artifacts/playwright/freeze-response-feedback.mjs` and
`bun artifacts/playwright/bind-response-feedback-build.mjs`.
Feedback audit: `bun artifacts/playwright/audit-response-feedback.mjs artifacts/playwright/json-response-filter-1791601149652`.
Acceptance freeze after the default-only correction:
`bun artifacts/playwright/freeze-response-feedback-acceptance.mjs`.
Regression audit:
`bun artifacts/playwright/audit-response-feedback-regressions.mjs artifacts/playwright/json-response-filter-1791601261476 artifacts/playwright/json-response-filter-1791602462836`.
Independent output: `artifacts/playwright/response-feedback-regression-audit.json`;
owned cleanup: `artifacts/playwright/response-feedback-cleanup.json`.

OS clipboard/picker/write, full keyboard/assistive-technology/platform acceptance,
mutable streaming-body cases, XPath/XML and every original migration/shared UI/
UX/CSS gate remain required. The tests control only side-effect boundaries;
native IPC/HTTP and mounted state remain actual. No full migration claim.

Official sources consulted before choosing Svelte state/lifecycle:
[$state/raw](https://svelte.dev/docs/svelte/$state),
[$derived](https://svelte.dev/docs/svelte/$derived),
[onDestroy](https://svelte.dev/docs/svelte/lifecycle-hooks#onDestroy).
Existing saved custom-protocol IPC adapters inform the controlled Save boundary;
no dependency/generator or native backend changes are currently needed.
