# Saved UI test execution

Owner requires Bun-only reusable Playwright JavaScript scenarios with shared helpers and headless execution. Browser-use and ad-hoc browser automation remain prohibited.

CA bundle acceptance75477b8 extends the existing HTTP mTLS scenario with unrelated
root first / required root second, reversed order, and invalid base64 CA PEM.
Pinned reqwest0.12.28 uses rustls-tls (Cargo.toml); its upstream vendored
Certificate::add_to_rustls iterates every PEM certificate already. No backend
change or rebuild was needed. Final saved run47753/1791415294120 exited0 and
passed12 groups on the unchanged current release. Both bundle orders each deliver
one authenticated POST/200 with exact peer CN/fingerprint/body; malformed CA
fails with native builder error and TCP/HTTP0. All prior negative/recovery/redirect,
resource/history preservation and four-setting restoration checks also pass.
Result/acceptance/settings-restored/fixture observations and bundle-second /
malformed-CA Timeline images inspected. Native hidden PID82016 exits0; owned
fixture closes successfully and no task processes remain. Compiler0/0, scenario
Prettier and whitespace checks pass. This proves app-private HTTP bundles on
Windows, not Git/provider/proxy/other protocol/platform or full TLS parity.

HTTP mTLS capability997f0a7: `bun tests/ui/http-client-certificate.js` reuses the
current successful artifacts/native-recovery-copy-probe/build-state.json by
default. Production app/release1791413164927/1791413519384 unchanged; fixture Rust
is compiled separately from saved fixtures/client-certificate.rs against cached
release rustls/sha2/serde_json/x509_parser rlibs. Windows helper uses the existing
Git OpenSSL, D:/home/.cargo rustc, VS2017 MSVC14.16 and SDK10.0.19041 paths.
No new package/native application dependency; no Node/Python/browser-use.

Per-run private CA/server/client and wrong-issuer client keys stay in the owned
artifact directory. Rustls WebPkiClientVerifier requires client authentication;
actual peer DER provides CN/SHA256 fingerprint, exact POST body is observed.
Independent Bun TLS client validates both listeners and TCP/HTTP counters before
reset. Real Preferences save/reload/Send checks missing identity, trusted client,
hostname mismatch, untrusted client, untrusted server, malformed PEM, successful
recovery and cross-origin redirect. Missing/mismatched identity yields no peer
certificate; wrong issuer UnknownIssuer; client rejects server with UnknownCA.
Malformed PEM has zero TCP attempts. Trusted/recovered sends each reach one
authenticated POST/200 with pinned identity/body. Redirect source receives one
POST; destination TCP/HTTP0 and native Timeline shows its blocked-origin reason.
All request resources unchanged; failures preserve exact saved history; success
uses a fresh response ID even when history stays20/limit20. Finally restores and
verifies CA/identityHost/identityPem/validateCertificates and closes native server.

Final88017/1791414644939 terminal0 passes9; initial65018/1791414550560 also passes9.
Final result/acceptance/settings-restored/fixture observations and trusted-client /
redirect Timeline images inspected: current buildPath, hidden owned PID51024,
visiblefalse/app exit0. Compiler0/0, Bun Prettier, Rustfmt and whitespace pass;
all task processes closed. Earlier Bun observer failure/typing/history waiters
are excluded and explained in STATUS. Scope is exact IPv4 hostname/private-CA
Windows HTTP mTLS; Git/provider/proxy/other protocol/legacy certificate/platform
and full migration/UX remain open. No TLS bypass or OS trust-store modification.

Official sources consulted for the fixture/verifier and existing native identity:
https://docs.rs/rustls/latest/rustls/server/struct.WebPkiClientVerifier.html,
https://docs.rs/rustls/latest/rustls/server/struct.ServerConnection.html,
https://docs.rs/x509-parser/latest/x509_parser/certificate/struct.X509Certificate.html,
https://bun.sh/reference/node/https/createServer,
https://bun.sh/reference/node/tls/TLSSocket/getPeerCertificate,
https://docs.rs/reqwest/latest/reqwest/tls/struct.Identity.html,
https://docs.openssl.org/3.4/man1/openssl-req/ and
https://docs.openssl.org/3.4/man1/openssl-x509/.
Bun's request.socket peer API was absent in actual fixture execution, so the
accepted observer uses Rustls. Native vendor/reqwest/src/tls.rs and http.rs
were inspected for PEM identity semantics; an initial versioned docs URL failed.

Typography capability555b317 shares helpers/typography.js between existing
`bun tests/ui/nocturne-theme.js` and `bun tests/ui/nocturne-native-theme.js`.
All matching caption nodes must retain9px, follow font-size-9→13px, then restore;
actual ::picker(select) metrics must retain12px/18px, follow font-size-12→14px
with21px line height, then restore. Both use finally cleanup. Old native
1791413059784/1791413071792 terminal1 reproduce caption/picker refusal separately,
with app exit0; neither is acceptance. Static88374 passes, then final all-matching
71172 terminal0/result passed covers dark/light1440/900/760 and both GraphQL
columns. Current production builder65005 terminal0/release1791413164927 /
1791413519384/result0/hash7496115646056370522 accepts native26643 /
1791413525045 terminal0. Native result/acceptance inspected: current buildPath,
owned hidden PID93548/visiblefalse/app exit0, all caption/picker contracts in both
themes, all Git count badges and existing12 surface/workflow captures, native
author validation/full preservation and unchanged HEAD. Static dark GraphQL/
light760 and native dark completion/light Git900 images inspected. Final check0/0,
Prettier and whitespace pass; all handles closed. Commands: bun run check/build,
`bun tests/ui/build-recovery-copy-probe.js`, both saved scenarios above with
INSOMNIUM_UI_BUILD_STATE=artifacts/native-recovery-copy-probe/build-state.json
for native. Sources consulted:
https://www.w3.org/TR/css-variables-1/#using-variables and
https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::picker.
Static evidence is result.json (no acceptance.json); native uses both. This does
not close full migration/UX/style/workflow/provider/platform/release gates.

Completion token capability1a73fad reuses `bun tests/ui/graphql-editor.js` with
the current INSOMNIUM_UI_BUILD_STATE below. Old-artifact1791412214638 terminal1
reproduces padding2!=6. Production builder45124 terminal0 creates release
1791412265664/1791412618347/result0/hash7496115646056370522. Final GraphQL79785 /
1791412775289 terminal0 passes17: initial real network-schema completion padding
2px/options0-4px/shadow2-3-5/.2, overrides6px/0-9px/custom shadow and restoration;
existing local SDL import checks both persisted themes/backgrounds and the same
token contract, with popup/option radii3/2 and relative font retained. Theme
settings invalidate fetched-schema identity, so themes use local SDL rather than
assuming network cache remains valid. Earlier51921/59031 failures are excluded;
STATUS records their investigation. Original native16 groups and2 authenticated
HTTP events retained. Current Source Control43659/1791412792492 passes14. Exact
tools terminal0, result/acceptance/current build/app exit0/owned hidden hosts
inspected; cropped completion light/dark screenshots inspected. Final compiler,
Prettier and whitespace checks pass; no live handles. Commands include
`bun tests/ui/build-recovery-copy-probe.js`, `bun run check`, saved scenarios above.
Official CSS variables and upstream completion styles consulted before edits:
https://www.w3.org/TR/css-variables-1/#using-variables and
https://raw.githubusercontent.com/codemirror/codemirror5/master/addon/hint/show-hint.css.
Full migration/UX/editor/platform/release gates remain open.

Source Control token capabilityc4ad941 reuses `bun tests/ui/git-source-control.js`
with INSOMNIUM_UI_BUILD_STATE=artifacts/native-recovery-copy-probe/build-state.json.
Old-artifact1791411647568 fails at status11!=14; current production release
1791411683590/1791412037242/result0/hash14189652431715471952 accepts1791412051562,
exact tool1780 terminal0/app exit0/current buildPath/owned native-hidden. All14
groups pass, including initial/dark-light mono11px/radius0px defaults, shared
font-size-11→14px/button-radius→7px propagation/restoration and existing native
diff/stage/commit/author/branch/remote/split/dark-light1440/900/760. Dark760 and
light1440 screenshots inspected. Compiler0/0, saved scenario format and whitespace
checks pass; whole GitPanel formatting warning predates this change. CSS variable
and scoped ownership documentation reused:
https://www.w3.org/TR/css-variables-1/#using-variables and
https://svelte.dev/docs/svelte/scoped-styles. Build command:
`bun tests/ui/build-recovery-copy-probe.js`. This acceptance covers the3 changed
declarations; full migration/UX/debt/platform/provider/release gates stay open.

Git TLS discovery capabilityf30e195 reuses `bun tests/ui/git-remote-lifecycle.js`.
Set INSOMNIUM_REMOTE_PUBLIC_TLS=1 and the current INSOMNIUM_UI_BUILD_STATE to opt
into read-only public network checks; default execution remains local. It reads
octocat/Hello-World anonymously through native IPC and independent Git ls-remote,
then checks native certificate refusal at wrong.host.badssl.com/expired.badssl.com,
classified independently by Bun as ERR_TLS_CERT_ALTNAME_INVALID/CERT_HAS_EXPIRED.
Full workspace bytes/data/local refs/info are preserved after each case; no Push,
token, TLS bypass or trust installation. The existing native cancel/pre-cancel/UI
responsiveness/30s timeout cases still run. Final1791411327755/tool40451 passes9;
untrusted mounted Push regression1791411376365/tool85139 passes5, all terminal0.
Public endpoints require network access and can change; native provider-auth/HTTPS
upload/mTLS/proxy/other-platform and server-side negative counters remain unproven.
Sources consulted before implementation: https://git-scm.com/docs/http-protocol,
https://docs.rs/git2/latest/git2/struct.RemoteCallbacks.html#method.certificate_check,
https://badssl.com/ and https://github.com/chromium/badssl.com. No Node/browser-use
invoked; native source/artifact unchanged by these outer saved scenario changes.

Editor token capabilityf0fae8e: saved `bun tests/ui/nocturne-theme.js` reproduces
fixed12px editor text ignoring a shared font change, then passes after adoption of
font-size-12 and editor-popup-shadow. Both themes check original12px/19.2px line
height and original shadow, override to14px/custom shadow, then restore in finally.
`bun tests/ui/git-diff.js` passes read-only/syntax/decorations/theme-width contracts.
Current production native release1791410465778/1791410824138/result0 accepts saved
GraphQL16 and Source Control13 groups. Final GraphQL1791410899736 also verifies
actual schema documentation popup radius/shadow/editor-font propagation, restores
tokens and rehovers for a popup-element screenshot before type navigation/cleanup.
Final result/acceptance records and screenshot inspected; all exact tools terminal0.
This closes these editor metrics only, not every editor/debt/domain/platform gate.
Sources consulted before implementation:
https://www.w3.org/TR/css-variables-1/#using-variables and
https://svelte.dev/docs/svelte/scoped-styles. Commands: bun run check/build,
bun tests/ui/build-recovery-copy-probe.js, and the saved scenarios above with
INSOMNIUM_UI_BUILD_STATE=artifacts/native-recovery-copy-probe/build-state.json
for native scenarios. No browser-use/Node/npm/Python invoked.

Multipart/CSS ownership capabilityb909b48: existing static nocturne-theme checks actual part options inline/stacked Field layout, original margins, spacing token propagation and keyboard filename override in both themes; native curl-import-multipart adds same real product file-field layout before unchanged exact byte/MIME/filename Send/reload checks. Existing gRPC theme checks message font token propagation with actual streaming; Runner lifecycle covers duplicate-style cleanup. Fresh release1791408489150/1791408847193/result0/hash16841563805098405804: native gRPC1791408872899/Runner1791408889289/multipart1791408900329/theme1791408908299 all pass/exits0, exact native66729 terminal0. Static38138 terminal0/check0 errors0 warnings. Full debt/workflow/migration gates remain; current evidence and handoff in STATUS. References: [CSS variables](https://www.w3.org/TR/css-variables-1/#using-variables), [Svelte scoped styles](https://svelte.dev/docs/svelte/scoped-styles).

Field required capability820aee4: rerun `bun tests/ui/design-system.js` for5 native required controls, missing-value submission refusal, complete and optional-empty submission, reactive required-again, explicit false override and FilePicker error association alongside existing component contracts. `bun tests/ui/nocturne-theme.js` passes dark/light1440/900/760 after production frontend build. Fresh release1791407772794/1791408129110/result0/hash7242600500128488022 accepts native-theme1791408164309 actual Preferences/Git author inherited ID/required and malformed-email refusal before persistence IPC/full workspace preservation, plus Source Control1791408176998/Push1791408187629. Final native60943 terminal0/all3 app exits0; current exact artifact required for later native replay. Official [HTML required](https://html.spec.whatwg.org/multipage/input.html#attr-input-required) and [Svelte context](https://svelte.dev/docs/svelte/context) consulted. This does not close full design-system/UX/migration gates; STATUS owns handoff.

Native admission scenario `bun tests/ui/git-push-admission.js` now includes exclusively owned receiptless operation-directory/sentinel refusal before Push network/snapshot and retirement adoption, full bytes/data/ref preservation, exact fixture-only nonrecursive removal and fresh observed tombstone without upload.1791407379525 passes9 groups/tool5115 terminal0/app exit0 on the current unchanged release. Not initial write/disk-full/powerloss/product UI acceptance. Exact checkpoint/remaining gates in STATUS.

Provider token saved modes: set `INSOMNIUM_PUSH_UI_CASE=github-token` or `gitlab-token`, then `bun tests/ui/git-push-ui.js` using successful current `INSOMNIUM_UI_BUILD_STATE`. Release1791406630663/1791406984947/result0 accepts6 groups each: actual selector/password-only credentials, documented pair challenged by owned smart-HTTP receive-pack, exact commit/tree/full private state, legacy token persistence after reload/no resend, fresh Inspect/unchecked retirement. Synthetic tokens only; no real provider account/scopes/expiry/SSO acceptance. Core Git/Basic/native Push/admission regressions and exact result records are in STATUS.

Saved `INSOMNIUM_PUSH_UI_CASE=tls-untrusted; bun tests/ui/git-push-ui.js` creates an exclusive owned-untrusted-tls directory under scenario artifacts. Helper invokes existing Git OpenSSL with Bun.spawnSync: `openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -noenc -keyout <owned>/server.key -out <owned>/server.pem -days 1 -subj /CN=owned-git-tls.invalid -addext subjectAltName=IP:127.0.0.1 -addext basicConstraints=critical,CA:FALSE`. Bun.serve uses key/cert BunFiles; no trust installation, TLS bypass or owner credentials. Actual UI Review must refuse Http/Certificate with requests/POST/credential0/no review dialog/no intent/exact whole bytes/data/refs/private Send retention. Correct/save URL explicitly to owned original HTTP fixture, fresh review and normal authenticated Push/Inspect/retirement succeed. Acceptance captures actual TLS error/strict scope; final1791406353242 passes5 on unchanged current release. Trusted TLS/mTLS/expiry/hostname/provider/proxy/platform are independent remaining gates in STATUS.

Saved `INSOMNIUM_PUSH_UI_CASE=discovery-redirect` configures persistent initial worker discovery redirect only after real authenticated review. `INSOMNIUM_PUSH_REDIRECT_STATUS=307` (default) or301 selects tested status; same owned sink/counter fixture as post-redirect. Capture actual UI completion/error and counters in discovery-redirect-observed.json, assert submitted/resultnull/no original POST/absent remote/full state-private Send preserved and measured zero target Authorization/PACK/POST. Restore endpoint explicitly before fresh Inspect/unchecked retirement; target request count stays unchanged through recovery. Final3071791406092266/3011791406102074 pass6, target requests0 in this runtime. This does not claim alternate-origin credential callback execution; one-shot redirects can retry original endpoint successfully and are documented separately in STATUS. No production/native/embedded source changes.

Saved `INSOMNIUM_PUSH_UI_CASE=post-redirect` uses actual Basic-auth discovery/POST and a second owned loopback-origin sink. `INSOMNIUM_PUSH_REDIRECT_STATUS=307` (default) or308 selects tested redirect response before server receive-pack executes. Server helper restricts Location to plain127.0.0.1 HTTP URL without userinfo; sink records only request/POST/auth-header-presence/body-size counters. Assert sink0 throughout reload/Inspect/retirement, absent original ref, durable finished/unknown receipt/full workspace-private Send retention and no extra upload. Final3071791405676658/3081791405686877 pass6 each. Same-artifact Basic-auth/admission regression terminal0; initial GET/other redirect codes/chains/TLS/platform remain independent gates in STATUS.

Saved auth refusal modes `basic-push-refused` and `basic-post-refused` first authenticate actual UI reviews, then respectively return401 on worker discovery or only receive-pack POST. Assert bounded refusal attempts, no server Git execution/absent ref/authenticated POST0, durable submitted-resultnull or finished-unknown receipt, full data/local refs/private Send retained, reload without retry. Fixture restores auth before fresh explicit Inspect/unchecked acknowledgment/retirement; final authenticated/denied-POST counts prove no extra submission through recovery. Final1791405467334/1791405477523 pass5/6; synthetic Basic server-policy scope only. Current same-artifact success/Inspect401/new-branch regression and exact handle/remaining scope recorded in STATUS.

Saved `git-push-ui.js` modes `basic-auth` and `basic-inspect-refused` fill the actual Remote authentication/username/password UI with per-run synthetic credentials. Owned receive-pack helper accepts optional Basic configuration, challenges unauthorized requests with401 and records counters only (no credentials/headers). Assert real authenticated discovery/POST and independent exact server tree/full state/private Send preservation. Refused Inspect temporarily rejects all auth, requires bounded challenge delta<=4/no observed-state review/no upload/unchanged receipt-intent-full bytes-server/error omits synthetic secret, then fresh explicit Inspect/unchecked acknowledgment/retirement after fixture acceptance resumes. basic-auth1791405145784/basic-inspect-refused1791405183778 pass4/5; same-origin synthetic Basic scope only. Callback reference and exact remaining transport/provider/fault scope are in GIT-PUSH/STATUS.

Saved `git-push-ui.js` modes `equal` and `fast-forward` seed actual owned server Git objects/ref before product review. Equal requires the already-had-commit status, durable finished/unchanged receipt, zero receive POST. Fast-forward advances only the scenario local ref to an existing child fixture commit, requires accepted/finished receipt, one receive POST, independent exact server commit/tree/old-tip ancestry. Both assert the saved expected remote OID, full live data/local refs/private Send retention and fresh unchecked Inspect/retirement without upload. Equal1791404985405/fast-forward1791404995486 pass4 each; new-branch/non-fast-forward regressions pass. Exact terminal handles and remaining full scope in STATUS.

Additional saved `git-push-ui.js` modes `snapshot-owner-changed` and `snapshot-owner-missing` alter/remove only the exact owner marker of the scenario-owned submitted outgoing stage at the actual receive-pack server gate. Assert real server accepted pinned tree, native completion refuses promotion, durable submitted intent survives reload/no resend, Inspect refuses before network/no observation, direct native retirement refuses without deletion/full-state changes. The fixture restores captured exact original owner bytes before fresh unchecked Inspect/explicit cleanup and also in finally on failure. Acceptance records mode, all refusal messages and controlled-filesystem-fault scope; final1791404817622/1791404827698 pass6 each on current release. No spontaneous disk failure/power-loss/adversarial replacement claim. Relevant implementation checks: src-tauri/src/git_remote_job.rs verify_owner/recovery_identity and src-tauri/src/git_fetch_cleanup.rs reclaim_push. Full remaining gates/checkpoint in STATUS.

Saved `INSOMNIUM_PUSH_UI_CASE=receipt-write-failed; bun tests/ui/git-push-ui.js` owns a Windows read/write-sharing handle denying replacement of the exact existing submitted Push receipt. The real server executes Git successfully; finished receipt write fails with actual OS5, original submitted bytes/resultnull/full state remain, reload never resends. After fresh unchecked Inspect, another handle denies initial retirement tombstone replacement: receipt/intent/full bytes/owned snapshot remain, release/fresh unchecked review/explicit retry retire without upload. Final1791404248519 passes6; current native9/restart/completed-server Stop4 regressions pass and all tool/app handles terminal. This exercises actual Windows replacement refusal, not every write phase/diskfull/powerloss. Official sharing/rename reference: https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew. Exact evidence/remaining scope in STATUS.

Saved `INSOMNIUM_PUSH_UI_CASE=partial-upload; bun tests/ui/git-push-ui.js` adds an owned loopback HTTP proxy forwarding actual Git advertisements. Its receive endpoint destroys the actual socket after a bounded PACK prefix, saves that exact prefix and submits it to real `git receive-pack --stateless-rpc .` against the disposable server repo. A 2 MiB random committed description keeps the outgoing pack large while live workspace data remains unchanged. Require incomplete request/no complete-body event, real unpack refusal, absent remote ref, durable finished/unknown receipt, unchanged whole live state except intent/local refs/private Send, reload without resend, fresh unchecked Inspect and explicit retirement without another POST. Real Git may exit0 while reporting `unpack unpack-objects abnormal exit` and `ng refs/heads/main unpacker error`; report-status/ref checks are essential. This verifies owned streaming-disconnect/incomplete-input boundaries, not provider/platform/power-loss/all pack offsets.

Official references consulted: https://git-scm.com/docs/pack-protocol and https://bun.sh/reference/node/net/Socket/destroy. Only Bun executes the JavaScript scenarios. Current runtime evidence and commit/remaining-gate handoff are in STATUS.

Current review/Inspect test capability90b68d0: latest history-before-confirm1791403342857/inspect-failed1791403333218/inspect-stop1791403267698 pass4 each on unchanged current release probe. Final replay4510 and helper regression91940 terminal0; nine result files and actual completion/cancellation/discovery-abort/POST counters inspected. No live handles; compiler0/0/targeted formatting pass. Exact regression IDs, no-compact-tool handoff and remaining full scope in STATUS.

Additional saved `git-push-ui.js` modes: `INSOMNIUM_PUSH_UI_CASE=history-before-confirm` explicitly completes the owned held native response while a review remains open, requires durable200/full-state invalidation/zero native Push IPC on stale confirmation and a fresh review before upload; `inspect-failed` returns actual HTTP503 on independent remote discovery; `inspect-stop` holds the actual advertisement response and requires native Stop/disconnect. Each passes4 on current release1791402139954/1791402495453/result0. Receipt/intent/current full data/server/private Send invariants and fresh observed-state retirement are asserted. Shared held-http exposes completion counters and release only of its own responses; separate server advertisement failure/hold/abort counters avoid confusing discovery with receive-pack. Official Bun HTTP response reference: https://bun.sh/reference/node/http/ServerResponse/end. Final regression process/evidence and remaining full scope in STATUS.

Current capability sources12c9a2a/f98deb2 and release build1791402139954/1791402495453/result0. Full sequential regression50776 terminal0: product normal/save-refusal/lost-save-success/lost-retire-success/state-replacement, restore/merge/Clone retained-copy and Source Control/checkout/Pull/Clone/Fetch/restart pass. Native admission8 also passes;15 result.json records inspected with status passed/current build-state/app exit0. Headless contract12 acceptance.json inspected. No live handles remain. Exact IDs/remaining scope/truthful no-compact-tool handoff in STATUS.

Saved `bun tests/ui/git-push-contract.js` runs12 headless production coordinator groups with injected adapters; its scope is recorded in acceptance.json and does not substitute for native product acceptance. `INSOMNIUM_PUSH_UI_CASE=retire-state-replaced` reuses git-push-ui.js, mounts the full production App through the existing minified native fixture and replaces live Svelte data after actual native retirement success before returning its reply. Release build1791402139954/1791402495453/result0/hash6138653783074166181 accepts1791402534402 and1791402641786,4 groups each. Latest private edit/current cleared intent/full persisted data/server commit/held Send cancellation0 verified. Native git-push-admission1791402555534 passes8 including actual advertisement-to-negotiation ref change/second advertisement/stale/no POST. Current sequential regression handle and remaining gates in STATUS.

For cross-feature regressions, explicitly set `INSOMNIUM_UI_BUILD_STATE=artifacts/native-recovery-copy-probe/build-state.json` before running saved scenarios; some retain older feature-probe defaults. Source Control1791401564148 used the older native-unified-diff default and failed at absent Preferences Git tab, excluded from current-artifact evidence. Corrected current-artifact Source Control1791401614788/checkout1791401624759/Pull1791401640884/Clone1791401655345/Fetch1791401664142/restart1791401669373 and restore1791401681989/merge1791401692813/Clone1791401703935 retained-copy pass. Exact batch handles68335/46635 terminal0; result files inspected. No live native build/app/scenario/server handles remain; source/test topic commits in STATUS.

Current release build1791401011344/1791401382184/result0/hash3495617236535378001 accepts `bun tests/ui/git-push-admission.js` (1791401390375 passes7). Product modes `INSOMNIUM_PUSH_UI_CASE=non-fast-forward`, `source-before-confirm`, `source-advanced`, `completed-stop` reuse `git-push-ui.js` and pass3/3/3/4 in1791401405859/1791401419390/1791401437526/1791401448661, all tools terminal0. These cover exact typed non-force refusal/actionable guidance, source changes before confirmation and after pack submission, and real server-completion Stop with preserved independent remote tree/no resend. Owned helper `completedHeldReceives` distinguishes post-Git-completion hold from before-execution hold; it never fabricates report-status. Current sequential regression handle and remaining gates in STATUS.

Saved `bun tests/ui/git-push-lifecycle.js` defaults to parent; `INSOMNIUM_PUSH_LIFECYCLE_CASE=close` selects real Windows WM_CLOSE/drain. Each runs first process and reopen sequentially against the same persisted operation/owned receive-pack server. Parent1791400651123/reopen1791400653829 passes4; close1791400667456/reopen1791400670240 passes3, all exact tools terminal0. Parent mode verifies surviving-worker lease refusal before controlled response EOF; close verifies actual disconnect and exit0. Fresh unchecked product review/explicit retirement restores full baseline/local refs without upload. Held response occurs before server Git execution; no partial-upload/server-success/power-loss/provider/platform proof. Current release artifact unchanged; Bun server/streams reference: https://bun.sh/docs/runtime/http/server.

Push mode stop1791399280822 and timeout1791399409063 pass4 each on release build1791397873072/1791398319882/result0. Set INSOMNIUM_PUSH_UI_CASE=stop or timeout and run the existing git-push-ui.js. Timeout uses the unchanged actual300s supervisor, asserts timed-out error/>=290s wait, and sets only the private held-Send fixture timeout600s. Actual response stream cancellation/one POST/no server ref/full state/reload/no resend/explicit retirement are verified. Timeout tool59931 terminal0; whole scenario304s. Do not run another native scenario while it waits. Bun server reference: https://bun.sh/docs/runtime/http/server. Broader lifecycle/provider/platform gates remain open in STATUS.

Current retirement acceptance: default release build1791397873072/1791398319882/result0/hash6986498663655754654. Native1791398375318 passes9 including actual Windows payload-delete failure/retired Inspect/explicit retry and real restart1791398383699 passes. Product normal1791398399342/unknown1791398409795/rejected1791398419977, retire-lost1791398430029, retire-save-failed1791398556351 and retire-save-lost1791398566335 pass. Mode names map to INSOMNIUM_PUSH_UI_CASE and reuse git-push-ui.js/IPC helpers. All sessions terminal; exact remaining regression handles/gates in STATUS. Earlier prepared-only statements below are historical.

Current same-artifact regressions pass: restore-copy1791398652831, merge-copy1791398664688, Clone-copy1791398904667, normal Clone1791398935511, Source Control1791398944382, checkout1791398954287, Pull1791398970648, Fetch1791398984360/restart1791398989992. All handles terminal. Saved Clone baseline setup now uses the mounted Active environment combobox, avoiding global Ctrl+S handlers on both hidden bootstrap and mounted fixture. Initial setup failure1791398676313 excluded; production source unchanged. Final check0/0; broader Push lifecycle/fault/provider/platform/release gates remain required.

Pending retirement acceptance: saved git-push.js extends native9 with real Windows payload-delete refusal/tombstone/markers/Inspect/explicit retry and a second actual process restart replaying a retired operation. Product git-push-ui.js normal/unknown/rejected modes assert native receipt and directory removal; additional INSOMNIUM_PUSH_UI_CASE=retire-lost uses the existing controlled lost-success IPC helper and requires reload/fresh unchecked review/no upload. Prepared only until fresh builder90615 settles successfully; STATUS records exact source/artifact/handle boundaries. JavaScript tools remain Bun; native scenarios sequential.

Current Push correction acceptance: default production-profile build1791395709183/1791396388236/result0/hash3522658132530992228. UI normal1791396408333 passes3, HTTP503/reload1791396460016 passes4, hook-rejection1791396487637 passes3; geometry/saved observation screenshot verifies corrected shared Field spacing. Native1791396519243 passes8 including actual post-negotiation server-ref race, unchanged independent concurrent ref and fresh Inspect/no resend. All Push sessions terminal0. Retained-copy regressions for minified fixture are tracked in STATUS; previous pending-correction references below are historical.

Same-artifact minified fixture regressions now pass: restore-copy1791396576097, merge-copy1791396643822, Clone-copy1791396666653. Current Source Control1791396723779, remote checkout1791396754495, Pull1791396791681, Fetch1791396833777/restart1791396853259 pass sequentially; batch57572 terminal0. No live handles remain. This does not replace outstanding Push retirement/lifecycle/fault/platform/provider or release-packaging evidence.

Latest Push evidence: build1791393417050/1791394039187/result0; normal product UI1791394158655 passes3, unknown HTTP503/reload UI1791394185553 passes4, native contract1791394240220 passes7 including actual pre-receive hook rejection. Result artifacts record native-hidden owned windows and exit0. Subsequent shared Field acknowledgment spacing correction requires a fresh probe and saved UI replay; it is not visually accepted yet. See STATUS for remaining gates; earlier unrun/six-group entries describe previous checkpoints.

For an explicit native probe build after observed compiler allocation failure, set `INSOMNIUM_UI_LOW_MEMORY=1` and run `bun tests/ui/build-recovery-copy-probe.js`. The saved builder passes `-- --config profile.release.package.insomnium.opt-level=1 --config profile.release.package.insomnium.codegen-units=16` to Cargo through Tauri's runner arguments (`bun x --bun tauri build --help`). It records the exact override in build-state.compilerProfile. This applies only to the probe invocation, retaining the production Cargo manifest/profile; a passing probe is UI/native behavior evidence at that profile, not final production release/performance acceptance. Default invocation retains the production release profile.

References: [Cargo profile overrides](https://doc.rust-lang.org/cargo/reference/profiles.html#overrides), [Cargo configuration](https://doc.rust-lang.org/cargo/reference/config.html). Recorded memory-failure builds and current process identities are in STATUS; require exact terminal0 and finished/result0 before native replay.

Recovery native fixture builds and their retained-copy hash verifier now use Bun minification through the existing shared component fixture builder; other component fixtures retain the default unminified bundle. [Bun bundler](https://bun.sh/docs/bundler) documents `minify: true`. This addresses measured embedded fixture size, not a proven memory fix until a successful build. Require native retained-copy restore/merge/Clone regressions and current Push scenarios on the matching new hash.

Browser previews and component fixtures use `launchUiBrowser` in `tests/ui/helpers/preview-app.js`. Its explicit `headless: true` was already enabled. There is no headed fallback or environment override. Reverified for the owner's headless request on 2026-10-08: `bun tests/ui/git-merge-contract.js` terminal0; `artifacts/playwright/git-merge-contract/result.json` passed and acceptance.json all9 groups passed. Audit found no other browser launch in saved JavaScript scenarios; native CDP attachment follows the separate hidden-host rule below.

Native scenarios use the isolated Tauri executable and attach Playwright through `connectOverCDP` to its WebView2. This attaches to an existing host; it does not launch a headless browser. The shared `native-app.js` now finds and hides its own probe window before CDP/scenario execution. Only one top-level `Tauri Window` owned by the spawned PID is accepted; PID ownership is rechecked immediately before `ShowWindow(SW_HIDE)` and `IsWindowVisible` verifies the hidden state. It never picks by title, broadcasts, hides another application or changes production configuration/capabilities. Existing builds can be used; no rebuild is required for this outer helper change.

Each native `result.json` records `renderingMode: native-hidden` and the exact owned PID/window with `visible: false`. This is a hidden native host, not a claimed WebView2 headless runtime. The host may briefly appear while it is created, before the helper can hide it. Native OS file-picker scenarios still operate real OS dialogs with their saved, PID-scoped helpers; hiding the host does not replace those dialogs with mock acceptance. Screenshots and page assertions continue through Playwright.

The shared WM_CLOSE helper now accepts the exact owned hidden Tauri window. Saved `bun tests/ui/git-merge-close.js` passes close1791377624461 (4groups), reopen1791377631454 (2), known-pending parent-stop1791377633643 (1), and startup recovery1791377638470 (2). These are Windows owned-window/lifecycle checks, not OS shutdown, midwrite crash or power-loss acceptance. All owned applications exit as specified and handles are released. Saved native Pull uncertainty1791377578393 also passes5 groups while the host is hidden, with full workspace/ref/index and fresh persisted HTTP200 checks.

Official references: [Playwright CDP attachment](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp), [Microsoft ShowWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-showwindow), [Microsoft IsWindowVisible](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-iswindowvisible). SW_HIDE sets visibility; ShowWindow's return value describes previous visibility, so the helper verifies actual post-call state separately. Existing Win32/Bun FFI fixture infrastructure reused; no initializer or production permission extension.

Additional current hidden-native regressions: Fetch5+4+4, original Pull1791377729177 (8), divergent1791377807266 (5), and retained-copy1791377844226 all pass. The retained-copy saved scenario still verifies an actual OS picker cancellation/write refusal/exact full copy and required review, authoritative recovery/no duplicate/fresh persisted200. No host visibility fallback or mock picker was needed; all owned handles/servers are released.
# Clone saved native scenarios — 2026-10-07

Run `bun tests/ui/build-recovery-copy-probe.js` and require its exact process terminal0 plus build-state finished/result0 before testing. Run native scenarios sequentially. `bun tests/ui/git-clone.js` defaults to normal; set INSOMNIUM_CLONE_CASE to design, empty, invalid-parent, collision, multiple, truncated, stop, install-uncertain, write-refusal, parent-stop or admission for the saved feature cases. `bun tests/ui/git-clone-retained-copy.js` exercises actual OS copy/review recovery through the shared embedded fixture. Exact accepted artifacts/limitations are in GIT-CLONE.md and STATUS.md; browser headless/PID-scoped hidden native rules still apply.

# Push saved native command contract — 2026-10-07

New saved `bun tests/ui/git-push-ui.js` (2026-10-08) compiles but has not run. It mounts actual product Remote/review/confirm/Inspect/required acknowledgment/stop-tracking controls against the shared real receive-pack helper; asserts full live snapshots/local refs/server tree and a real private held Send stays active. It saves push-review.png and push-observation-review.png for inspection. Require a fresh trustworthy artifact with this frontend, not the previous native-command-only artifact. Wrapper43706 ended1; observer57716 subsequently captured owned Cargo ExitCode0/all recorded children terminal. Fresh builder30518 started only after that proof, running start1791393417050/native launcher71532/hash11580360768184140976. Require its exact terminal0/finished/result0 before starting this UI scenario. Source freeze/process identities and remaining full-scope gates are recorded in STATUS.

`bun tests/ui/git-push.js` uses the successful isolated recovery-copy probe and shared PID-scoped hidden native helper. Require its exact fresh build terminal0/finished/result0 first; run sequentially with all other native scenarios. Shared `helpers/git-receive-pack.js` serves actual native Git CLI receive-pack/upload-pack from an exclusively created repository beneath the saved scenario output, with ambient Git config removed. It never uses real remote accounts or edits a source repository as a server.

Six groups cover new branch/independent complete server tree/full local bytes-refs-HEAD preservation, same-operation repeat/fresh Inspect/no resend, equality/no upload, normal advance/exact server ancestry, stale expected OID/no upload, and actual completed receive-pack followed by HTTP503/unknown receipt/fresh server inspection without a second upload. Run1791392039742 passes6 on build1791391574460/1791392013022/result0; session91009 terminal0, hidden PID63720/window3215190/visiblefalse/exit0. Same-artifact Fetch1791392084284/restart1791392092313 and Clone1791392104319 regressions pass, all handles terminal. It calls native commands through the saved mounted probe and does not prove product Push controls, private review, held Send, rejection/races or broader lifecycle/platform/fault boundaries. Exact current evidence and remaining gates are in STATUS/GIT-PUSH.
