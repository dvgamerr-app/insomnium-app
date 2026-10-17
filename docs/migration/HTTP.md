# HTTP migration

## Raw and formatted stream event display — 2026-10-17

Binary text display follow-up: binary/Ping/Pong events offer Base64 (existing default) or UTF-8, persisted per request as streamBinaryEncoding. UTF-8 preserves BOM and uses replacement characters for invalid UTF-8, matching legacy Buffer.toString display intent; bounded previews decode only a prefix with multibyte lookahead. Copy/complete-reader use the full selected representation, while Save always decodes the original Base64 bytes. Malformed Base64 displays a local decode error. Toolbar controls scroll horizontally in narrow panes. JSON formatting expansion is also capped at the 64 KiB visible preview, with complete original data still available. Reference: https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/ignoreBOM .

Direct codec controls pass BOM, multibyte/surrogate boundaries, invalid UTF-8 and malformed Base64. The existing saved stream-message-reader scenario passes UTF-8 binary display, copy input through a controlled browser clipboard boundary, encoding reload, formatting expansion and unchanged Base64 history alongside prior controls. No system clipboard/native large-copy acceptance is claimed.

StreamPane now offers Formatted/Source/Raw event display for SSE and WebSocket, persisted per request through existing request_meta.previewMode. Source uses the shared read-only editor with JSON mode for valid small JSON and plain text otherwise; imported source preferences retain this distinct view. Source receives only the bounded preview, and contextual minimum-height overrides allow it to fit short stream panes. The default retains current automatic JSON formatting. WebSocket requests now pass the existing preview-mode setter's model-type guard. Raw preserves original whitespace/escapes; formatted JSON preserves large numeric tokens. Save retains original bytes; Copy uses original text or the selected binary encoding rather than the formatted/truncated preview. Saved history is unchanged. This restores the three preview choices found in legacy websockets/event-view.tsx; complete style/layout/platform parity remains open.

Compiler/build pass. Existing saved headless stream-message-reader.js passes both protocols: complete read-only message/tail/Escape controls, exact Raw/Formatted JSON with 9007199254740993 and Unicode escape, Source editor exact input/read-only state, Raw and Source persistence after reload and unchanged history. Initial reload check exposed the fixture's unconditional reseeding; seed now runs only when storage is absent. Receipts: artifacts/playwright/stream-message-reader-sse/result.json and stream-message-reader-websocket/result.json. No native/network/clipboard or full layout/platform acceptance claimed; remaining PLAN/PARITY gates stay open.

## SOCKS transport enabled — 2026-10-16

The application now enables the pinned reqwest `socks` feature for its shared HTTP/SSE/WebSocket client. Existing proxy configuration can reach the dependency's SOCKS4/4a/5/5h connector rather than the feature-disabled path. Preferences lists the schemes and explains proxy-side destination DNS for 4a/5h. gRPC proxy behavior is unchanged.

Official pinned source documentation inspected: `src-tauri/vendor/reqwest/src/proxy.rs` (Proxy documentation), `src/connect.rs` (local versus proxy DNS and connector dispatch), and Cargo feature declaration (`socks = []`). `cargo check --locked --manifest-path src-tauri/Cargo.toml` exits0; no dependency/lockfile changes or new test scripts. Actual proxy handshake/authentication/DNS/TLS/cancellation/provider/platform acceptance and packaging/linkage gates remain open; existing binaries predate this feature.

Stream filtering now searches full UTF-8-decoded binary/Ping/Pong data as well as stored Base64, regardless of preview encoding or truncation. Error messages, close reasons and connection URLs are searchable too. Malformed imported Base64 falls back to stored-text matching. The legacy realtime-response-pane.tsx searches decoded Buffer text and error/close text; stored history and export data remain unchanged. Existing headless stream-message-reader.js verifies the mounted Thai binary search and empty-result reset; direct helper controls include a match beyond 64 KiB, case-insensitive error/close and malformed data.

Stream event controls restore legacy All/Message/Open/Close/Error filtering and Clear view using shared UI controls. Message includes SSE and sent records. Selection/details follow the visible list, so Copy/Save cannot target a hidden event. Clear view masks currently retained event IDs only, allowing later unique events without deleting history or Export log data; the mask resets when the response ID changes or the pane reloads. Counts show visible versus retained events. Maintained headless stream-message-reader.js verifies message/open/close filters, combined close-reason search, Clear view with disabled transfers, unchanged persisted history and reload restoration for SSE/WebSocket. Actual live-arrival/native/platform acceptance remains open.

## Desktop Copy integration — 2026-10-16

Native large-Copy attempt — 2026-10-17: FAILED, not acceptance. One current product-only integration build artifacts/native-stream-copy-20261017 finishes exit0 (~6m45s). Native-hidden host69344 runs a temporary opt-in in the maintained reader scenario; the first20MiB text Copy changes Windows clipboard sequence9600→9605, but GetClipboardOwner returns0. The proposed owner-PID adoption cannot authenticate this writer, and the existing sequence guard refuses restoration. Original clipboard formats/bytes were captured in memory but NOT restored; disposal then cleared the only snapshot, so this attempt cannot recover the original clipboard. Text completeness was not verified and binary did not run. Receipt artifacts/playwright/stream-copy-native-1792198335280/acceptance.json is failed. App/profile buffers restore exactly (resource-manager-restoration-1792198335242/result.json); host exits0 and is absent. The unverified opt-in/helper changes were removed to prevent repetition. No product code changed. Do not repeat this mutation until the exact ownerless production writer has a proven safe receipt/restoration route or runs in a disposable environment. Capture-only preflight is insufficient. Reuse the new binary for unchanged production code; no new build/audit matrix is justified.



Windows native Copy refuses embedded NUL before calling the clipboard plugin, because CF_UNICODETEXT ends at NUL. The existing transfer error displays the refusal; binary events can use Base64 or Save for complete bytes. Other hosts and browser clipboard behavior are unchanged. Contract: https://learn.microsoft.com/en-us/windows/win32/dataxchg/standard-clipboard-formats . Direct Bun checks cover no-write refusal, complete 1 MiB Unicode text/Base64, and unchanged other-host/browser dispatch using controlled clipboard adapters; this is not OS clipboard acceptance.

Stream event and HTTP response Copy now share `src/lib/clipboard.js`: Tauri uses the already-installed clipboard-manager `writeText`, browser preview retains `navigator.clipboard`. Stream Copy passes the complete selected event data, independently of its64KiB display preview, and clears stale copy errors before retry. Existing Rust plugin registration and write permission are reused; no dependency, layout or Rust change. `bun run check` passes0errors/0warnings; `bun run build` passes. Actual OS clipboard/large-payload acceptance remains open; compiler/bundler results are not native clipboard evidence. Official API: https://v2.tauri.app/plugin/clipboard/ .

Updated 2026-10-15. Native transport, cookie management, multipart, proxy/TLS settings and streams have scoped implementations/receipts. Windows manual body/send/cancel/history has bounded acceptance below; complete legacy-cookie/proxy/platform/stream compatibility stays required.

See [current status](STATUS.md), [execution plan](PLAN.md) and [complete parity requirements](PARITY.md). No original scope was removed by consolidation.

## Current WebSocket acknowledgement controls

Saved tests/ui/websocket-ack-native.js uses a separate real Tauri SDK Channel, actual native connect_stream and the real loopback WebSocket peer. Application callbacks/native commands are untouched; these invocations leave application history unchanged. The existing sse-ack-native-probe.js gains optional protocol (default SSE), owned UUID/manual ACK and cancellation controls, retaining original SSE callers.

Four native groups pass: (1)25.015second first-packet hold with3peer frames queued, stale0/premature2/foreign-run ACK controls do not release packet2; matching1 does. Duplicate1/premature3 do not release packet3; matching2 does, followed by real Finished ACK. (2)No ACK yields one sequenced message only and the native command fails at30.010seconds; peer retires, sends after timeout are refused as WebSocket is not connected, and a late ACK has no active run to revive. (3)The retired run ID starts again at sequence1 and succeeds. (4)Cancellation while data is held closes the peer, still waits for the real Finished ordering barrier, then returns Stream cancelled after release (observed7.695ms). These are logical/native delivery and session retirement guarantees, not physicalTCP/OS-close or real renderer/host suspension evidence.

Uses unchanged exact-retention executable SHAcea47a30867bd85a2caf7db977dd0246c3fcc95852a2d00d352cb7ae824b7171/original manifest7b71e8d3. websocket-ack-supplement.json records3test files (receiver plus2new scenario files) and4docs; full pre/post1398source entries/1307regular files and all package/private/tool/asset scopes match. Suite73222 exits0: WebSocketACK1792056967846=4, originalSSEbounds1792057030844=8 (including3default-SSE SDK cases), WSUI1792057192830=6, mixedUI1792057204343=5. Hosts56056/58752/58980/43612 exit0/native-hidden; restorations1792056967608/1792057030597/1792057192586/1792057204118 return exact originalf0b51/d8b032 buffers/protected state. acceptance-audit-websocket-ack.json validates original manifest/executable, exact declared added/changed sources, receipts/profile retirement and2receiver bundles rebuilt byte-for-byte. ACK fixture4upgrades/4closes, forcedfalse/no open/unsettled/errors; strict3-file JS/format/diff checks pass. No application changes or live owned handles.

Remaining: genuine renderer/host suspension, queued client-send/close-edge/backpressure variants, broader size/lifecycle/provider/platform/OS-close and every retained PARITY gate. The4test groups do not replace mounted UI lifecycle acceptance; separate original WS6/mixed5regressions pass. SDK Channel reference: https://v2.tauri.app/develop/calling-rust/#channels. Full migration incomplete; UX deferred.

## Current exact SSE boundaries and large event retention

Native baseline22870/receipt1792055379805 reproduces parsed data loss: an exact9MiB SSE payload appears before EOF, then trailing closed metadata evicts it (0payloads instead of1). Host58300 exits0/native-hidden/profile restored, full declared diagnostic closure passes. Original scenario snapshots and sse-exact-baseline-supplement.json remain immutable under the gzip-members candidate.

appendStreamEvent now protects the newest complete oversized data payload while terminal/status/ping/pong metadata follows. Older entries before that payload are evicted as needed; surrounding metadata remains bounded by8MiB and total event count1000. A newer payload replaces this exception and restores ordinary8MiB retention when small. Raw capture still has its independent strict1000frame/8MiB serialized budget. The global40MiB saved-history budget/notice is unchanged. Direct regression covers terminal preservation, new-payload replacement and1002control frames; native oversized WS/gRPC variants remain unverified even though they share this helper.

Saved tests/ui/sse-exact-native.js verifies6actual native groups:9MiB payload survives terminal, exact raw .bin Save and full reload; a small newer payload evicts the large one; exact20MiB comment line accepts and+1byte refuses; exact20MiB aggregate data-field-line bytes dispatches and+1byte refuses without a parsed oversized event. These ASCII/LF cases bind the current Rust guard: UTF8 line bytes exclude CR/LF delimiters, while the event guard sums data-field line bytes including field syntax. Two exact10MiB data lines therefore produce a payload of20MiB-9bytes (not a20MiB rendered payload). The native .bin export verifies the6275331-byte retained raw suffix; the complete9437184-byte parsed payload is independently verified in durable history/reload. More multibyte/CRLF/boundary variants remain separate gates. Original histories are preserved; only completed owned histories are cleared between independent cases after byte-exact reload verification.

Fresh normal-hook candidate artifacts/native-resource-crud-audit-probe/sse-exact-retention-attempt-1: build98320 exits0/Rust7m19/exeSHAcea47a30867bd85a2caf7db977dd0246c3fcc95852a2d00d352cb7ae824b7171. Native continuation63766 exits0: exact1792056151611=6, SSE1792056221274=8/10durables, WS1792056237569=6, mixed1792056248554=5. Hosts51992/55556/57716/56104 exit0/native-hidden; restorations1792056151366/1792056221049/1792056237341/1792056248330 restore exact originalf0b51/d8b032 buffers/protected state. Original1396source entries/1305regular files and complete package/private/tool/asset closure pass with0overrides. acceptance-audit.json validates original manifest7b71e8d3/executable/receipts/restorations/all6exact cases and rehashes native raw export. Frontend check51033 passes0errors/0warnings; direct checks, targeted formatting/strict scenario JS and diff checks pass. Only5preexisting vendored warnings. No live owned handles.

Remaining: further exact UTF8/CRLF/compression/control-frame size variants and oversized WS/gRPC cases, WS-negative ACK/renderer-host suspension, broader mixed environment/lifecycle/provider/platform/physicalTCP/OS-close and every retained PARITY gate. Full migration incomplete; UX deferred.

## Current mixed HTTP SSE and WebSocket histories

Saved tests/ui/mixed-stream-native.js and its helper verify5bounded native groups. Actual HTTP/SSE Sends alternate twice on the same ordinary request; each mode exposes only its2compatible history entries. Nonlatest HTTP and SSE selections survive reload, including a persisted SSE selection after switching to a separate WebSocket request. WebSocket remains a distinct request type in the current UI, not a third Response mode option. Its real server-originated message arrives while the HTTP request is active, appears when returning to WebSocket, and remains exact after peer close/reload. Request switches, response-mode changes, selections and reloads produce no new fixture requests or upgrades. Original histories are unchanged. No synthetic history/transport interception or product edit.

Initial native1792054729162/session12260 fails after3groups because the scenario looks up the WebSocket history using the authored ws:// URL. Native open_event uses reqwest effective HTTP upgrade response URL; screenshot shows a closed101 session and both actual peer messages. Host57136 exits0/native-hidden/profile restored, diagnostic supplement closure passes. Original failed scenario source/supplement/receipt remain preserved. V2 now matches the exact effective URL independently recorded by the HTTP upgrade peer, retains protocol/message/request-history assertions and changes no product behavior.

V2suite9107 exits0 on unchanged audited gzip-members executable SHA4dc90779bb96131fe31306070d717e175b29def8fe697cbffe547a03bdaaaaca and original manifest71f4ccfa. Explicit mixed-stream-v2-supplement.json records3test files (existing accepted compression scenario plus2new mixed files) and5docs; full pre/post1394source entries/1303regular files and every package/private/tool/asset scope match. acceptance-audit-mixed-stream-v2.json validates original manifest/binary, exact allowed added/changed sources, all receipts/hidden hosts/fixture retirement and original buffers. Mixed1792054870886=5, SSE1792054880225=8/10durables, WS1792054896452=6; hosts55360/57540/21096 exit0/native-hidden, restorations1792054870662/1792054880002/1792054896226 return exact originalf0b51/d8b032 profiles. Mixed fixtures4HTTP/SSE requests plus1upgrade close without forced cleanup/errors; no live owned handles. Strict2-file JS/formatting and diff checks pass after correcting an edit-time await placement.

Remaining: complete mixed environment/lifecycle/failure/provider/platform variants, exact size/single large valid events, WS-negative ACK/renderer-host suspension and all retained PARITY gates. Separate original WebSocket acceptance covers client sends; this mixed scenario adds peer-message background delivery, not new client-send variants. Full migration incomplete; UX deferred.

## Current compressed cancellation and decoded limits

The existing saved sse-compression-native.js now verifies24groups: prior15compressed/SSE/HTTP cases plus gzip/deflate/Brotli cancellation while the real compressor is open and decoded20MiB line/event refusals. Cancellation renders the first event before Disconnect, observes peer abort, closes without an error event and preserves exact raw bytes/reload. Oversized comment lines decode to20971524bytes and multiline data events to22020244bytes from only43–21605wire bytes. All6limits produce durable20MiB errors, never dispatch an oversized event, preserve the exact retained suffix of decoded bytes actually consumed, and respect1000frames/8MiB serialized raw budget. Actual retained raw is4091908/4096000bytes with4121earlier frames dropped. Each large independent case verifies full reload equality before removing only its completed owned histories through the existing native fixture setup; original history remains unchanged.

Uses unchanged audited gzip-members executable SHA4dc90779bb96131fe31306070d717e175b29def8fe697cbffe547a03bdaaaaca and original manifest71f4ccfa. compressed-bounds-v2-supplement.json explicitly records1scenario and5documentation differences from the build; all application/native/dependency/assets/package/private/tool scopes remain exact. Both complete prelaunch and post-suite closure pass across1392source entries/1301regular rows. Native session98450 exits0: compression1792053711654=24, SSE1792054214098=8/10durables, WS1792054231618=6. Hosts53956/38448/55432 exit0/native-hidden; restorations1792053711416/1792054213872/1792054231392 return exact originalf0b51/d8b032 buffers. acceptance-audit-compressed-bounds-v2.json verifies original manifest/exe/supplement, all receipts,9new cases and7binary-export hashes. Native fixture24requests/24closed/3aborts, forcedfalse/no unsettled/error listeners; no live owned handles. Strict JS/Prettier/diff checks pass.

Preserved diagnostic: session46487/receipt1792053426147 exits1 because its120second terminal wait ends while the long gzip comment still has raw4KiB fragments arriving. Screenshot and later v2progress show continued ACKed delivery beyond120seconds before20MiB; no guard failure was established by that timeout. Host57676 exits0/native-hidden/profile restored; full declared diagnostic closure passes. Original scenario snapshot/supplement remain immutable. The corrected test-only wait is300seconds per large terminal/invocation step with progress metadata every5seconds; thresholds/error/raw/reload assertions are unchanged. No product change or throughput/physicalTCP/OS-close claim.

Remaining: exact size boundaries/single large valid-event retention, additional compressed-corruption/transport variants, complete mixed HTTP/SSE/WebSocket history transitions, WS-negative ACK and renderer-host suspension, provider/auth/platform/OS-close and every retained PARITY requirement. Full migration incomplete; UX deferred.

## Current consecutive gzip member correction

Native baseline1792052128332 reproduces a missing second gzip SSE event on the prior binary: first event renders, second member is independently sent, then60sec UI wait fails. Host33872 exits0/native-hidden/profile restored; original build plus declared diagnostic scenario/docs closure passes. Exact diagnostic source is reconstructed and verified against its captured SHA9009d652 in multi-baseline-source-reconstruction.json; failed receipt/source/supplement remain preserved under sse-compression-flush-attempt-1.

Root cause: tower-http0.6.11 constructs GzipDecoder with its default single-member behavior. The local src-tauri/vendor/tower-http patch enables multiple_members(true), so gzip decoding reads through all members and detects invalid later members. This shared dependency affects other reqwest consumers as well as SSE/HTTP; provider/auth/platform acceptance remains separate. Published archive SHA4cfcf7e2740e6fc6d4d688b4ef00650406bb94adf4731e43c096c3a19fe40840 matches the old Cargo.lock. Complete upstream source and MIT LICENSE remain byte-identical except src/decompression/body.rs and added INSOMNIUM-PATCH.md (artifacts/tower-http-patch-delta.json). Cargo root patch reuses version0.6.11; no registry files changed. Notice admission/generation includes the new local patch (770identities/424texts; incomplete/linkage unproven).

Fresh candidate artifacts/native-resource-crud-audit-probe/sse-gzip-members-attempt-1: build65301 exits0/Rust7m44/exeSHA4dc90779bb96131fe31306070d717e175b29def8fe697cbffe547a03bdaaaaca. Suite41649 exits0: compression1792053005605 passes15 (prior12 plus consecutive gzip SSE, corrupt later member with exact first event/raw prefix and actual native HTTP Send of both members), originalSSE1792053024228 passes8/10durables, WS1792053040591 passes6. All3hosts52296/56348/52072 exit0/native-hidden; restorations1792053005378/1792053023995/1792053040364 return exact originalf0b51/d8b032 profile buffers. Original1392source entries/1301regular rows and complete source/package/private/tool/asset closure pass with0overrides. acceptance-audit.json validates manifest/exe/all receipts and rehashes7decoded binary exports. Cargo check67543 exits0/14.55sec; targeted rustfmt, strict scenario JS/formatting and diff checks pass (5preexisting vendor warnings). No live owned handles.

Remaining: compressed cancel/decoded limits, more corrupt-member/transport variants, complete mixed HTTP/SSE/WebSocket histories, exact sizes/WS-negative/renderer-host suspension/provider/platform/physicalTCP/OS-close and every retained PARITY gate. References: https://doc.rust-lang.org/cargo/reference/overriding-dependencies.html#the-patch-section ; https://docs.rs/async-compression/0.4.48/async_compression/tokio/bufread/struct.GzipDecoder.html ; legacy main/network/libcurl-promise.ts sets ACCEPT_ENCODING to an empty string (https://curl.se/libcurl/c/CURLOPT_ACCEPT_ENCODING.html). Full migration incomplete.

## Current open-compressor flush and truncated trailers

Bounded Windows gzip/deflate/Brotli12native cases are verified: valid/corrupt bodies plus two real compressor flushes before compressor.end and HTTP EOF with genuine trailer omitted. The first event mounts while compressor.writableEnded=false; a second flushed event mounts before finalization. Truncated cases retain the exact first parsed event/decoded raw prefix and persist an SSE stream error; full histories survive exact reload. Native Save checks exact decoded bytes for valid and flushed complete streams. Producer writes are not physical TCP framing evidence.

Candidate artifacts/native-resource-crud-audit-probe/sse-compression-flush-attempt-1: build67267 exits0/Rust7m17/exeSHA1bf3b88bac1a50fe5e0509803f10346bcfb2c9f086ccf71653fea698361d44ce. Initial native1792051502304 failed because valid/flush export filenames collided; original failed source/receipt, host56104 exit0 and profile restoration remain preserved. Filename-only one-file test supplement records before89d76dc5/afterd41129ef in filename-supplement.json without changing original build manifest or binary. Native1792051638260 then failed the unchanged Save helper owned-child assertion at Brotli Save; host58344 exits0/profile restored, forced fixture cleanupfalse. Cause is undetermined; no ownership guard/assertion was weakened. One unchanged-source repeat63129 passes: compression1792051760155=12, SSE1792051776709=8/10durables, WS1792051793686=6; hosts55044/53152/38924 exit0/native-hidden, restorations1792051759919/1792051776473/1792051793452 return exact originalf0b51/d8b032 buffers. Full pre/post suite1256source/1186regular-file and package/private/tool/asset closure matches with exactly1declared scenario override. acceptance-audit-filename-v3.json independently validates original manifest/exe/receipts/restorations and the declared supplement. No live owned handles.

Bun preflight3codecs, strict scenario JS, formatting and diff checks pass. Callback typing and edit-time brace failures were corrected before build; no product changes. Remaining: multi-member gzip, compressed cancellation/decoded limits, corrupt-after-valid-prefix variants, actual mixed HTTP/SSE/WebSocket history transitions, exact size/WS-negative/renderer-host suspension/provider/platform/physicalTCP/OS-close and all PARITY. Official references: https://bun.sh/reference/node/zlib and https://github.com/nodejs/node/blob/main/doc/api/zlib.md (Bun runtime only). Full migration remains incomplete.

## Current compressed SSE native acceptance

Windows valid/corrupt gzip, deflate and Brotli are bounded verified by tests/ui/sse-compression-native.js and its saved helper. Each valid complete compressed member is sent as two producer writes while HTTP EOF remains held: the actual mounted event and decoded Raw view appear before EOF. Native .bin Save is byte-exact to decoded UTF8/BOM input; raw history counts decoded bytes, not compressed wire bytes. Corrupt bodies produce durable SSE stream errors without parsed events. All6histories survive exact reload equality. Producer write boundaries do not establish distinct TCP/native decoder reads, and complete-member-before-EOF is not incremental compressor-flush acceptance.

Fresh normal-hook candidate artifacts/native-resource-crud-audit-probe/sse-compression-attempt-1: build99049 exits0/Rust7m39; exeSHA32fddb0bc6cc04e9c40eee0475e9e5d16b50c4c00408068baef1ce57f8ecadb6. Native continuation29351 exits0: compression1792050599269 passes6, originalSSE1792050611308 passes8/10durables, WS1792050628531 passes6. Hosts48644/564/56460 exit0/native-hidden. Restorations1792050599033/1792050611078/1792050628276 return exact originalf0b51/d8b032 profile buffers. acceptance-audit.json validates original1256source entries/1186regular rows,0overrides and exact full source/package/private/tool/asset closure after all3native suites. Fixture preflight, strict fixture/2scenario checking, Prettier and diff checks pass. Only5preexisting vendor warnings. No production transport change; no live owned handles remain.

Remaining: truncated/corrupt-after-valid-prefix streams, true incremental compressor flush, multiple members, cancellation/limits while decoding, mixed HTTP/SSE/WebSocket actual histories, exact boundaries/WS-negative/renderer-host suspension/provider/platform/physicalTCP/OS-close and every retained PARITY gate. Official references: https://bun.sh/reference/node/zlib and https://docs.rs/reqwest/0.12.28/reqwest/struct.ClientBuilder.html. Full migration incomplete.

## Current native SSE bounds and ACK deadline

A lost data acknowledgement previously exhausted30seconds, then connect_stream unconditionally sent Finished and started another30second acknowledgement wait before retiring its run/ACK registrations. The real held-receiver baseline at artifacts/playwright/sse-bounds-native-1792047337508 retires its peer body after30113ms but leaves the invocation pending beyond45000ms. Exact failed receiver/scenario/baseline Rust bytes and timeout-finding.json are retained in artifacts/native-resource-crud-audit-probe/sse-bounds-diagnostic-attempt-4.

Delivery.can_drain now becomes false on channel send failure, acknowledgement receiver closure or acknowledgement timeout. Only an unusable delivery skips Finished; ordinary EOF, transport/protocol errors and cancellation retain their existing ordering barrier while delivery is usable. Original error propagation, cookie flushing, socket/ACK/run cleanup and IPC schemas remain unchanged. This fixes the duplicate wait without adding a new timeout or dependency.

Audited candidate artifacts/native-resource-crud-audit-probe/sse-bounds-ack-attempt-1: build96688 exits0/Rust7m41, executable SHA4ee3decbc90b2804e1e94dca39244283e4937979ff92cfb63c35b2969cfb84f1. Suite60682 exits0. Main receipt artifacts/playwright/sse-bounds-native-1792049088066 passes8groups:1,260,079 exact raw bytes from a large producer write, actual64KiB fragmentation with14nonzero offsets, raw1000frames/parsed1000events with exact suffix export, actual8MiB serialized raw retention plus parsed sublimit-event retention, durable20MiB line/event refusals and exact reload, then real Channel25second held-ACK release, missing-ACK invocation failure at30004.035ms and successful reuse of the retired run id. Five groups use real app controls/history/export; three use a separate real SDK Channel receiver with intentionally controlled ACKs. No application callback, transport or native command is replaced. Normal release still receives/ACKs Finished. The receiver bundle is rebuilt byte-exactly from its saved fixture and installed SDK. Host54436 exits0/native-hidden; restoration1792049087829 restores exact originalf0b51/d8b032 buffers and protected state. Fixture8requests/8bodyclosures/3aborts retires without force/open/unsettled/errors.

Same-candidate original SSE8groups/10durable checkpoints pass in1792049242166 (host51408/restoration1792049241927), and original WebSocket6groups pass in1792049258569 (host56056/restoration1792049258342). Both hosts exit0/native-hidden and original buffers/protected inventory restore exactly. Expected intentional SSE transport-error stderr is retained. One complete original source/package/private/tool/asset closure after all serial scenarios passes1254source entries with0overrides; manifest SHA8d33ed54f13c03edd79f3558b7d40fa64ea128ef2a00bc207d66c45c1bd6174a remains unchanged. acceptance-audit.json also compares every original closure key, verifies all3restorations and rebuilds the receiver bundle exactly. No live owned handles remain.

Checks: nativecheck27841 exits0/18.07sec with5preexisting vendored warnings; targeted rustfmt, strict3new UI script/fixture checks and Prettier pass; saved headless sse-raw-history passes (receipt copied into candidate). Commands: bun run native:check; bun x --bun tsc --noEmit --allowJs --checkJs --strict --skipLibCheck --target esnext --module esnext --moduleResolution bundler --types bun tests/ui/sse-bounds-native.js tests/ui/helpers/sse-bounds-native-cases.js tests/ui/fixtures/sse-ack-native-probe.js; bun tests/ui/build-resource-crud-probe.js artifacts/native-resource-crud-audit-probe/sse-bounds-ack-attempt-1. Saved suite invokes sse-bounds-native.js with INSOMNIUM_SSE_BOUNDS_NATIVE=1 and audited build/profile ownership, then existing sse-runtime-native.js and websocket-runtime-native.js, followed by original strict closure verification.

Failed diagnostics1-3 remain immutable:1792045857008 waited for peer closure during debugger pause;1792046257484 exposed an intermediate10ms elapsed snapshot race, corrected by awaiting Connect/final persistence before exact comparison;1792046526692 showed debugger pause did not establish actual ACK withholding. Those are diagnostic evidence, not current-source acceptance or proof of renderer-suspension failure. The real receiver then isolated the duplicate deadline in diagnostic4. Initial builder EEXIST refused before producer start; preparation was moved intact within verified artifact paths to sse-bounds-ack-preparation-1 before the successful fresh build. No failed receipt or assertion was overwritten or relaxed.

Remaining: genuine renderer/host suspension, exact size boundaries/single large valid event exceptions, WS-specific negative ACK variants, compressed/mixed protocol cases, provider/platform/physicalTCP/OS-close and every retained PARITY gate. Parsed retention here uses sublimit individual events; no universal strict8MiB single-large-event claim is made. Full migration remains incomplete and UX redesign stays deferred. Official documentation consulted before implementation: https://v2.tauri.app/develop/calling-rust/#channels; the abandoned debugger observation used https://playwright.dev/docs/api/class-cdpsession and https://chromedevtools.github.io/devtools-protocol/tot/Debugger/.

## Current live raw SSE capture

Native response bytes are captured before SSE parsing, as Base64 fragments of at most64KiB with transport chunk/offset metadata. Raw and parsed events share the existing single acknowledged delivery sequence; cancellation/30second acknowledgement timeout remain in force. These are decoded HTTP response bytes, not TCP framing or compressed wire bytes. Comments, BOM, CRLF, splitUTF8 and unfinished events survive binary export independently of parsed events.

SSE histories retain a separate rawEvents array, capped at newest1000 fragments and8MiB of actual serialized array bytes including Base64/metadata. rawReceivedBytes counts captured bytes; rawRetainedBytes counts retained decoded bytes. rawDropped produces an explicit partial-capture notice; Export raw writes only the retained suffix as sse-raw.bin. Raw view joins fragments before UTF8 decoding; first/changed-owner display is immediate and subsequent live renders are throttled250ms. Invalid persisted frame metadata/Base64/order/size refuses export. Raw packets do not duplicate parsed rows or their size accounting. The existing global history admission policy still applies.

Verified candidate: artifacts/native-resource-crud-audit-probe/sse-raw-capture-attempt-1, build6090 exit0/Rust7m37; executable SHAd1c561e05d2c1b65b9be684338ae2501b0d49cfc6592071177a8d629cd127ea6. Compiler70474 passes0/0; strict changed-scenario checks pass. Saved headless sse-raw-history proves exact139byte export, splitUTF8/BOM/comments/framing/unfinished bytes, reload, partial1000byte suffix export,1003→1000 count cap, actual8MiB JSON cap,5metadata and3sequence refusals. Three existing legacy-import headless regressions raw-timeline-current pass.

Native runtime43286/receipt1792042791204 passes8groups/10durablecheckpoints, live Raw beforeEOF, actual owned native .bin Save dialog, exact bytes at EOF/cancel/error/reload and no parsed duplication. Host45532 exits0/native-hidden; restoration1792042790182 restores exact originalf0b51/d8b032 buffers. Fixture11requests/11bodyclosures/4aborts retires without force/open/unsettled/errors. Actual Raw screenshot inspected. Intentional transport-error stderr is expected. Original native13505/receipt1792042701815 failed because the saved dialog helper only allowed .json, not because byte capture failed; host40504 exited0 and original profile/source closure passed. Immutable failed receipts remain. A two-file test-only supplement explicitly allows .bin while default.json/output containment/owner/no-overwrite safeguards remain; test-binary-save-supplement.json records exact before/after hashes and originals. Original before-cargo.json is unchanged. Corrected closure binds1251source entries with exactly those two declared test changes, all application/package/private/tool/asset scopes unchanged.

Legacy SSE5872 and HTTP/WebSocket native regressions95786 also pass with closure and exact profile restoration; see IMPORT-EXPORT.md#current-byte-exact-legacy-timelines and candidate acceptance-audit.json. No live owned handles remain. Scope is bounded Windows acceptance, not native large-fragment/overflow/slow-WebView/provider/platform/physicalTCP/OS-close or universal loader/linkage proof. Standalone timeline portability is separately bounded-verified in IMPORT-EXPORT.md#current-standalone-legacy-timeline-portability; all other retained PARITY gates remain required.

Commands: bun run check; bun tests/ui/sse-raw-history.js; bun tests/ui/legacy-response-import.js; bun tests/ui/legacy-websocket-import.js; bun tests/ui/legacy-sse-import.js; bun tests/ui/build-resource-crud-probe.js artifacts/native-resource-crud-audit-probe/sse-raw-capture-attempt-1; saved sse-runtime-native.js with INSOMNIUM_SSE_RUNTIME_NATIVE=1 and explicit audited build/profile ownership. Official references consulted before implementation: https://docs.rs/futures-util/latest/futures_util/stream/trait.StreamExt.html#method.then and https://v2.tauri.app/develop/calling-rust/#channels.

## Current SSE runtime lifecycle

SSE saved history now follows the same environment policy as HTTP/WebSocket: valid nonlatest choices persist, reload and environment switches select only compatible history, and a completed run reconciles its captured environment after retirement. HTTP↔SSE mode changes resolve destination-compatible history or clear the pane; active runs and same-environment unsaved terminal results remain protected. The model keeps one selection per request: HTTP-mode reload prunes an incompatible SSE choice, so returning SSE chooses its newest compatible history. No separate per-protocol preference is claimed.

Windows native-hidden receipt artifacts/playwright/sse-runtime-native-1792039116538 passes8groups/10durablecheckpoints: incremental data beforeEOF, splitUTF8/BOM/CRLF/multiline/custom/default events/id inheritance/reset/retry/comments/emptydata, exact renderedPOST/header/query, HTTP403/MIME refusal/freshretry, heldheaders/openbody cancellation/no lateevent, A→emptyB EOF/cancel, A transporterror restoring populatedB, nonlatest/filteroff/reload, HTTP-empty-mode/reload/SSE fallback, and live deletion without resurrection. Host43820 exits0; restoration1792039116290 restores exact originalf0b51/d8b032 buffers and protected state. Fixture11requests/11bodyclosures/4aborts retires without force/open/unsettled/errors. Intentional fixture transport-error stderr is expected. The live multiline screenshot was inspected. Body/listener retirement does not prove physicalTCP or OS-close lifecycle.

Compiler48362 passes0/0, strict scenario type check passes, actual model12controls pass (artifacts/sse-history-selection-green.json) and existing parser regression passes23chunkwidths/leadingempty/interiorBOM. Original model RED drops valid SSE selection; declared-drift native1792038385885 reproduces staleA after switchB on the older WebSocket candidate, with host45248 exit0/restoration1792038385651 passing. Both remain historical evidence, not current acceptance. Read-only source review corrected protocol-toggle and intermediate HTTP completion-timing findings before freeze.

Audited normal-hook candidate artifacts/native-resource-crud-audit-probe/sse-runtime-attempt-1: build24969 exits0/Rust7m44, executable SHA dd2fc219cf6bd9801c6f98cf133b4d5bd28577457b6d0f2f842a6e82224ef41a. Native wrapper26854 exits0; native-run.json proves runtime, exact-source post-native closure and profile restoration. All1245captured source entries/other package/private/tool/asset scopes remain exact; no test-source supplement was needed.

Regression wrapper14107 exits0 with strict post-regression closure: WebSocket native1792039177281 passes6groups (host26908 exit0/restoration1792039177056), HTTP native1792039189016 passes body36/controls19/seededhistory6 (host27012 exit0/restoration1792039188549, all54sockets retire without force), and headless legacy-websocket-import-sse-runtime-regression passes3portable/7refusals/1003→1000/binary/selection/budget controls. Both native regressions restore exact originalbuffers and protected state. No owned build/native/profile/fixture handles remain.

Commands: bun run check; bun x --bun tsc --noEmit --allowJs --checkJs --strict --skipLibCheck --target es2022 --module esnext --moduleResolution bundler --types bun tests/ui/helpers/sse-runtime-native-cases.js tests/ui/sse-runtime-native.js; bun tests/ui/sse-bom.js; bun tests/ui/build-resource-crud-probe.js artifacts/native-resource-crud-audit-probe/sse-runtime-attempt-1; saved sse-runtime-native.js with INSOMNIUM_SSE_RUNTIME_NATIVE=1 and explicit build/profile ownership, then websocket-runtime-native.js, response-history-native.js and legacy-websocket-import.js. Official references: https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation and https://bun.sh/docs/runtime/http/server.

Remaining: legacy raw chunkNDJSON/body/timeline preservation/import, mixed ordinaryHTTP/SSE histories, broader size/backpressure/timeout/provider/platform cases and all retained PARITY gates. Archived curl.ts records decoded raw chunks and framing/comments; parsed event acceptance does not close that requirement. Legacy does not automatically reconnect, so no EventSource retry scheduling/Last-Event-ID replay is inferred. Universal loader/linkage/OS-close and full migration remain unverified.

## Current manual HTTP workflow

Verified source:7a0e9e3. Ordinary HTTP now persists actual transport errors/Cancel, rejects a late successful native reply after abort, retains history per request/optional environment, and persists nonlatest selection in a separately validated responseSelections map. Public environment filtering updates both history and displayed selection. Preflight refusals remain history-free; deleted requests cannot resurrect; streams/introspection remain unchanged. Global40MiB serialized safety admission remains. Configured maxHistory1..100 corrects legacy's incidental preinsertN-plus-new-row count; bucket counts precede global budget admission.

Legacy evidence: main/network/curl.ts:273–284; models/response.ts:181–193; ui/routes/request.tsx:81/414; response-history-dropdown.tsx:57; settings/general.tsx:191. References consulted: [AbortSignal.throwIfAborted](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted), [Playwright input actions](https://playwright.dev/docs/input), [Bun HTTP server](https://bun.sh/docs/runtime/http/server), [HTTP response close events](https://nodejs.org/api/http.html#event-close_2). Fixtures execute with Bun only; shared browser launch remains headless, native host hidden before CDP.

Compiler24524 passes0 errors/0 warnings. Controlled receipt plugin-dom-render-owner-http-workflow-1792000002 retains original20/stream2 plus HTTP6 (late IPC after Cancel, durable failure hydration, no-send preflight, deleted-owner resolve/reject and save failure after success);42 workers retire. Earlier0001 passed before selection extension (41 workers); failed0000 retains the plain-JS Svelte rune mistake, corrected with JSON state projection. Initial compiler26123 annotation errors were corrected;16913/66992 also passed within their earlier scope.

Normal-hook build91016 at artifacts/native-resource-crud-audit-probe/http-workflow-attempt-2 exits0/Rust6m55 with full source/package/private-input closure. Executable SHA4e83e47347f716c8b8b2297e654e0ab90bd17c9ed2f844d034e7b8852b0c03bc. Native67507 at artifacts/playwright/response-history-native-1792004571680 passes original seededhistory6 unchanged,36 actual manual-body rows (JSON/text/XML/form/multipart/binary ×dark/light1440/900/760 CSS profiles), and18 controls. Controls cover file refusal/no partial upload, held Cancel/fresh recovery, actual503/404/200 keyboard selection/reload, destroy/timeout/partial headers, perrequest/environment quota/filter/reload, captured Send during edit/switch, aggregate budget and deletion without resurrection. All54 actual connections close without forced destruction. Host39808 exits0/native-hidden; restoration1792004571456 restores exact f0b51/d8b032 original buffers, protected inventory and selective fixture cleanup. Independent read-only audit confirms receipt counts and ownership.

Both10MiB persisted replies compare full text/base64 and actual SHA256 to independently generated fixture bytes. The18MiB unsaved case proves visible200, size/content-length/token and budget refusal, but does not compare/hash the complete unsaved native body. CSS widths are not physical OS-picker/AT/platform acceptance. Layout checkpoint covers the manual-entry state, not whole WebView/beforebirth storage. Explicit window destroy is not OS-close lifecycle acceptance; universal loader/linkage/all-birth/callback-drain/legal/platform gates remain open.

CRUD regression91711 at artifacts/playwright/resource-manager-native-1792004773396 passes original6/field24/correction6/collection6, one actual Send/abort; host43064 exits0/native-hidden with exact baseline restoration. Full post-HTTP closure91280 and post-regression72066 pass before any source/doc edits. No native/profile/build handles remain.

Immutable first build69654/http-workflow exits0/Rust6m40; native55411/receipt1792002717530 fails at ambiguous Preferences after body36/file4. Host39808 exits0,36 sockets retire, restoration1792002717304 returns exact baseline, and source recheck18980 passes. Preferences is now scoped to Main navigation; fresh attempt2 replays all cases. Failed receipts remain failed and retained.

## Current WebSocket runtime lifecycle

Windows native-hidden acceptance is bounded-verified for the saved websocket-runtime-native.js scenario. Connect and send upgrades once and preserves exact rendered Unicode JSON (including large integer text), headers/query/subprotocol; saved text/binary/ping payloads and actual pong/peer bytes match. Invalid JSON has no handshake; invalid base64 and oversized ping leave the connection usable. Peer close code/reason, durable403/retry, held-handshake cancellation/no late Send, nonlatest choice/reload/filter-off, and deleting a live request without history resurrection are verified.

Fixed an environment completion defect: changes during a live A connection preserve its pane, but completion now reconciles only that request against the current environment. A→empty-B peer-close and client Disconnect both select empty B; returning A restores its histories. Same-environment terminal results are left intact, including unsaved responses; the overbudget and populated-B/error/concurrent-request variants remain runtime verification gaps.

Compiler75213 passes0/0; strict targeted JavaScript check passes; normal-hook build43163 finishes0/Rust7m40. Candidate artifacts/native-resource-crud-audit-probe/websocket-runtime-attempt-1, executable SHA cd0800c7ae65fb55227b27b9360f4d564cb40092e5a4a222c1ea076d46bbbad5. Original run82221/receipt1792037836062 fails at ambiguous Preferences after four groups; strict post-native closure passes and original failure stays immutable. One test-only selector change scopes Preferences to Main navigation. test-selector-supplement.json reconstructs the exact captured original23363 bytes/SHAaf7feafa840c67bb48199de7ebbc11dfddb42302ecf2336e45a554b890b98efc; current test23470 bytes/SHAc20925dc502ed2ff806a59c67bbad3c4e4219887e75946afb1134b18084611d4. Original before-cargo manifest remains unchanged. This is an explicit harness generation supplement, not unchanged original test bytes.

Corrected run74929 exits0; receipt artifacts/playwright/websocket-runtime-native-1792037919014 passes6 groups. Host22132 exits0/native-hidden. Restoration1792037918779 restores exact originalf0b51/d8b032 buffers and protected resources. All7handshakes/5opened/5closed/1heldabort retire without force/errors/open/unsettled peers. Post-selector closure98802 passes all1242 source rows with only the exact declared test-file override and all other source/package/private/tool/asset scopes unchanged; native-run-selector-supplement.json records the result. Independent read-only audit verifies host/restoration/retirement and reconstructs the test delta. Actual events screenshot inspected. Headless legacy-websocket-import regression exits0 (3portable/7refusals/1003→1000, binary/budgets/selection roundtrip). No product source changes followed native closure.

RED diagnostics used the older legacy-WebSocket candidate with declared source/scenario drift:1792037114436 reproduces stale A after switchB, host45248 exits0 and restoration1792037114210 passes. Earlier selector/message failures1792037034227/1792037049141/1792037088402 remain failed evidence. No original receipt is relabeled.

Commands: bun run check; bun x --bun tsc --noEmit --allowJs --checkJs --strict --skipLibCheck --target es2022 --module esnext --moduleResolution bundler --types bun tests/ui/helpers/websocket-runtime-native-cases.js tests/ui/websocket-runtime-native.js; bun tests/ui/build-resource-crud-probe.js artifacts/native-resource-crud-audit-probe/websocket-runtime-attempt-1; INSOMNIUM_WEBSOCKET_RUNTIME_NATIVE=1 with explicit build-state/profile ownership then bun tests/ui/websocket-runtime-native.js; bun tests/ui/legacy-websocket-import.js. Official references: https://bun.sh/docs/runtime/http/websockets, https://playwright.dev/docs/input, https://docs.rs/reqwest-websocket/latest/reqwest_websocket/, https://svelte.dev/docs/svelte/$state.

Limits: loopback Windows scope; no universal WebSocket/provider/platform, loader/linkage, OS-close or complete migration acceptance. Explicit native window destruction is cleanup. SSE, broader protocol/legacy/provider and every remaining PARITY gate stay open.

## Topic records

<a id="record-agent-cookie-fields-20261013"></a>

<details>
<summary>AGENT-COOKIE-FIELDS-20261013</summary>

# Cookie Field validation — isolated verified candidate

Preceding preparation4b2ef6a/STATUS3d7bcc4; immutable724-file36-RED proof remains intact. Production changes only CookieManager.svelte; no CSS/shared primitive/backend/parser/quota/provider/dependency edits or native/profile/root build.

Only exact captured scheme/raw-byte-limit messages from a pending change_cookie command and actual form patch receive local Field errors. Form owner, exact submitted URL/raw/previous identity and existing workspace/disposal scope still gate publication. Admission/pre/post-command or non-form errors stay global; no substring matching. Explicit Cookie URL/Set-Cookie value labels preserve exact accessible names and descriptions in both states. Default7px is retained; existing explicit-caption weight400→500 is the sole approved normal visual change.

Correction only clears that authoritative local error when native URL validity plus HTTP/HTTPS protocol, or raw UTF8 length at/below8192, resolves its condition. This does not prevalidate/refuse a command, parse cookies, rewrite raw values, or change backend rules. Unrelated global feedback survives local correction. Edit/New/success reset the local owner; existing scope disposal suppresses late results. Original busy behavior and raw previous edit keys are preserved. No autofocus/autoscroll or global style workaround.

## Verification

SAME saved `bun tests/ui/nocturne-native-theme.js --cookie-component` final562ec7 exits0: six dark/light1440/900/760×600 profiles resolve all36 original failures with original assertions intact. Added gates verify still-invalid corrections retain errors, non-form known-message failures remain global, unrelated global operation error survives local correction, held New-cookie ownership and actual Escape/disposal suppression. Actual malformed native HTML URL validation still prevents invoke; trusted Input Enter issues exactly1 request per refusal case. Raw/URL/previous keys and no jar/committed-write mutation on refusals remain exact. These are controlled component outcomes, not native Rust/jar acceptance.

Portable `cookie-normal-geometry.json` is exactly derived from immutable36-RED data. Whole normal dialog, both fields and controls retain exact rectangles/fonts/colors/backgrounds,7px and caption colors; actual caption glyph position/height is exact, with approved weight/glyph-width changes measured separately. Each new local feedback rectangle fits every actual clipping ancestor, no horizontal overflow, bottoms431.890625/559.890625 within600. Only existing error-space expansion occurs; no geometry assertion was relaxed.

Full original shared-control `bun tests/ui/design-system.js`16582 passes with original Field/FilePicker/Select/dialog/theme/focus/serialization/multipart assertions. Cookie phase marker was subsequently tightened to the native await only; this component is not imported by the shared fixture, and unchanged helper/control bytes remain bound. Final compiler5007 passes0errors/0warnings using approved preview5493 verification-only supplement; restored3839 byte-exact and excluded from offered changes. Normal old-worktree four fetch-option errors remain disclosed. Final `bun run build`de3d30 passes,49 emitted frontend files frozen. All checks were serialized with source frozen while live.

Original entire current-root native entry reconstructs whole-LF exactly after removing only the Cookie import/early-exit branch; no native body/assertion/restoration edits or execution. Default shared fixture body reconstructs whole-LF exactly after removing only optional Bun plugins passthrough. Alias stays confined to the exact CookieManager importer; no global Tauri/workspace replacement, parser or unknown-command transport. Four preparation negatives/first36-RED and all prior Resource/Namespace/Environment/Multipart proofs remain immutable. Historical failure.png files are preserved in their negative archives, excluded from final-pass output maps.

## Frozen handoff

`artifacts/cookie-field-proof/final-v2/audit.json` SHA **3f5552dc7c9df47f4031cec790cab51bf7107b954f14de12417c4a79c4c765a2** independently rehashes824 files:285source,402harness,49frontend,80outputs,8verification. Maps sourceHashes→source/, harnessHashes→harness/, frontendHashes→build/, outputHashes→scenario/, verificationHashes→verification/. `guards.json` SHA **63e2d90207ef4c83caeb88cf5557a6da48f446d745413133e6c90dd68f979024** binds nine intended paths: one product, seven preparation fixture/helper paths, one golden JSON; final report is offered separately. Cookie raw root-before6ba64655/own-before0ac9ff05 and entire normalized equality are archived in verification. No unrelated isolated product/preview/STATUS overlay; full source/assets are an isolated generation, not current whole-root/native runtime acceptance.

The first824-file final proof remains immutable. Final-v2 corrects only guard metadata: ownBefore now binds the actual consumed724-file preparation, distinct from rootBefore. Product/source/output hashes and verified gates are unchanged.

References read: existing Field/local Nocturne contracts; [HTML URL validity](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/url), [URL protocol](https://developer.mozilla.org/en-US/docs/Web/API/URL/protocol), [TextEncoder UTF8](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder), [Svelte lifecycle/proxies](https://svelte.dev/docs/svelte/lifecycle-hooks), [Bun fixture plugin hooks](https://bun.sh/docs/bundler/plugins). No new subsystem/dependency initialization.

Handles:none; profile:none. Root independent integration/current-root replay, fresh native exact Rust error/UTF8/scheme/precedence/jar/restoration, OS/AT/platform/private/full UI/migration remain OPEN. An old bf5e executable cannot accept these changes. STATUS records verified topic/evidence and explicit handoff because `/compact` is unavailable.


</details>

<a id="record-agent-multipart-fields-20261013"></a>

<details>
<summary>AGENT-MULTIPART-FIELDS-20261013</summary>

# Multipart file row validation and removal focus — isolated verified candidate

Worktree `insomnium-agent-ui-next`, preceding checkpoint8125b76. Only production paths are `src/lib/components/KeyValueEditor.svelte` and `src/lib/styles/features/key-value.css`. Root/native90664 and original profiles were untouched. No shared primitive/API/token/editor/upload quota/provider/backend changes.

The editor uses existing Field's explicit empty-label div, nested existing display:contents wrapper and native FilePicker. Indexed `File value N` accessible names stay exact while visible filenames remain unchanged; Select stays outside Field context. Feature-owned rules hide only that empty caption, retain display:contents and wrap feedback below its controls with full basis/order. Valid row/control geometry, fonts, colors and backgrounds exactly match the frozen original six-profile measurement. Error rows expand; file/type controls keep their original sizes.

Only errors thrown within readUpload's limit/read stage become row-local Field errors. Admission and later onchange exceptions remain form-level. Captured original row/selection/workspace scope still guard every result. Success clears only its own file error; unrelated invalid rows keep theirs. Name/disabled changes transfer errors to the actual accepted parent row, including its Svelte state proxy; external row replacement prunes stale feedback. No errors or identities enter persisted rows. Caller exceptions after a caller has already changed state remain subject to the original current-row suppression guard; this feature does not redefine caller transaction semantics.

Focused removal waits for Svelte tick then targets the same-index survivor, previous survivor, or Add when empty. Unfocused removal does not request focus. Existing data/callback structure, multipart options, serialization help and all original saved control assertions remain intact.

## Evidence and exact mapping

Final `artifacts/multipart-field-proof/product-candidate/final-v2/audit.json` SHA **1a452788a7403fc45d407265d4809a7ff1dd581bfcdd102fe5a435eccc62b11f** independently rehashes785 files:285source,396harness,49frontend,51outputs,4verification. Map sourceHashes→`source/`, harnessHashes→`harness/`, frontendHashes→`build/`, outputHashes→`scenario/`, verificationHashes→`verification/`. `guards.json` SHA **953a95464fd7eea23f81dcb422d4b091869f6fd0a87c652ca2f27eded69fe36d** lists seven source/harness delta guards and both original root/own hashes. New helpers and experimental fixture have ABSENT original guards. Preserve all other source baselines; these isolated whole-tree assets are not a current-root Event/native generation claim.

SAME `bun tests/ui/design-system.js`30915 exits0: original full suite plus six dark/light1440/900/760×600 multipart profiles, actual20MiB+1 refusals and actual bytes, controlled owned-File read failures, same-row correction, other-row retention, name/disabled cloning, external resets, public workspace admission, actual editor disposal, stale reads, callback exceptions and three keyboard removal routes. Original saved scenario body is whole-LF identical after removing only appended multipart imports/block. The final aggregate assertions still demand zero production and zero experiment failures. Frozen-original valid geometry comparison is exact. Actual production error bounds are independently measured at all six profiles: file/type width, height and font stay exact, feedback has no horizontal overflow and remains within600px, indexed names stay exact and the Type selector remains outside file error context. Preliminary785-file proof under final/ and prior58332 pass remain immutable; final-v2 adds those actual-production receipts without product changes. Experimental composition remains explicitly experimental rather than an alternate production implementation.

Final compiler93195 exits0 with0errors/0warnings using the parent-approved verification-only preview helper5493d735; final build3417a3 exits0 after restoring preview3839c23 byte-exact. Both helper bytes are frozen under verification. Normal unsupplemented old-worktree check has four preexisting fetch-option errors; this helper is neither staged nor offered as a feature delta. Compiler21177's six experiment-helper string-index errors were corrected only with a const-tuple JSDoc, with all assertions intact.

Immutable negatives:63-file6aa138ab,66-filecf575330,69-file044bed8a and unwrapped29130 geometry failure remain unchanged. New strict row-clone negative27840 at `product-candidate/row-clone-negative` retains KeyValue SHA9cb81691, source and failure screenshot. Temporary spread-object ownership failed unchanged Name/disabled assertions; corrected code uses actual accepted rows[index]. Initial91750 pass predates pruning; it is archived separately, not final acceptance. Final output omits the historical failure.png already archived in the row-clone negative; final result.json says passed.

Official references read before implementation: [Svelte lifecycle/tick](https://svelte.dev/docs/svelte/lifecycle-hooks), [bindings](https://svelte.dev/docs/svelte/bind), [state proxies and raw state](https://svelte.dev/docs/svelte/$state), [native focus](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus). Existing local Field/FilePicker API and Nocturne ownership docs were read. No subsystem/dependency was initialized.

All handles terminal, no browser/server/profile/native process remains. Root independent integration/replay, fresh native file-picker/OS failure, assistive technology/platform/private and full migration remain OPEN. This does not accept native behavior against an older executable. STATUS records the topic checkpoint and explicit handoff because `/compact` cannot be invoked in this interface.


</details>

<a id="record-cookie-fields-root-acceptance"></a>

<details>
<summary>COOKIE-FIELDS-ROOT-ACCEPTANCE</summary>

# Cookie field correction accepted on root — 2026-10-13

CookieManager associates only exact URL-scheme and raw-byte-limit errors from its actual pending form command with the relevant existing Field. It preserves submitted raw values/previous keys and the workspace/disposal scope; stale form owners cannot publish local feedback. Correcting the authoritative HTTP/HTTPS or UTF8 byte-length condition clears that local error while unrelated global feedback survives. Other parser, disk, admission and non-form failures remain global. Edit/New/success reset local ownership. Backend parsing/quota/command behavior is unchanged.

Root independently rehashed824 candidate files/nine raw root guards/report and reconstructed the entire original native entry and default fixture body before integration. Product changes only src/lib/components/CookieManager.svelte. Existing Field explicit labels provide exact Cookie URL/Set-Cookie value accessible names and associated descriptions; default7px remains. The approved caption400→500 is the sole normal visual change. No CSS/global primitive/backend/dependency/provider change.

Current root compiler12430 completed0errors/0warnings. Serial2219 completed the SAME saved nocturne-native-theme.js --cookie-component, full design-system.js shared-control regression and actual frontend build, all terminal0. All1008 current source inputs stayed frozen;49 frontend assets and complete scenario outputs archived. Independent artifacts/cookie-fields-root-proof/root-audit.json proves six dark/light1440/900/760 profiles, eighteen controlled refusal cases resolving all36 original association/correction failures, actual Input Enter exactly1 invocation, native HTML malformed URL noinvoke, raw8194UTF8bytes/previous identity/no jar or committed-write mutation on refusal, exact normal geometry/styles except approved caption, relevant-invalid correction retention/global error preservation/new-owner/disposal suppression. Local feedback bottoms431.890625/559.890625 fit actual clipping ancestors and viewport with no horizontal overflow. Narrow dark scheme/light byte-limit screenshots were visually inspected.

The transport alias is confined to the exact CookieManager importer; workspace code and other core imports remain real, without global Tauri replacement. Refusal outcomes and combined precedence are explicitly preset from inspected Rust ordering, not execution of native Rust. The original724-file/36-RED measurement and four preparation negatives remain immutable. Agent final-v2 corrects only consumed own-before metadata, preserving firstfinal/product/output bytes. Root initial auditor used full tests/ui prefixes inside the harness directory instead of the manifest's harness-relative paths; the refusal occurred before adoption and was corrected without changing candidate bytes or assertions.

Current native error/UTF8/scheme/precedence/jar persistence/restoration, OS/AT/platform and broader production workflows remain open. Historicalbf5e lacks this feature. A fresh native generation must include this current source closure; the separately accepted managed-read implementation still requires original61+62 actual binding refusal/UI0. Root handles:none; native profile untouched. All original migration/UX/private/distribution/SDK/Event/FIFO/fullnotice gates remain open. Topic commit and STATUS handoff recorded; /compact cannot be invoked by this interface, and no compaction is claimed.


</details>

<a id="record-cookie-model-snapshot"></a>

<details>
<summary>COOKIE-MODEL-SNAPSHOT</summary>

# Native cookie model snapshots

The request snapshot continues to omit expired cookies. Model readers can opt into
`snapshot_request_cookies({ workspaceId, includeExpired: true })` to inspect every
entry currently retained in the jar. The command retains its main-window ownership
guard and snapshot size limits. Callers omitting the option keep the existing
request behavior.

The disk loader uses `cookie_store::serde::json::load_all` so an expired entry
already present in a persisted file remains available to model readers after a
fresh native process. The pinned cookie_store 0.22.1 serializer documents that
`load` skips expired cookies, while `load_all` loads both expired and unexpired
entries. Primary API: <https://docs.rs/cookie_store/0.22.1/cookie_store/serde/json/fn.load_all.html>.
The installed crate source was consulted; the web fetch was unavailable.

`PersistentJar::save` also serializes `iter_any`, retaining session and expired
entries through subsequent writes. This follows legacy `common/cookies.ts` and
`network/set-cookie-util.ts`, which serialize `store.getAllCookies` after adding
response cookies. The request snapshot and provider continue filtering expired
cookies independently. Broader cookie editing and actual request-header/provider
parity remain required migration gates.

## Subsequent-write persistence acceptance

The saved restart scenario supports `INSOMNIUM_COOKIE_RESTART_WRITE=1`: load the
controlled three-entry file, add an unrelated cookie through native `change_cookie`,
inspect the resulting file and model, then launch a second fresh native process.

- Prior production `4d956946` fails at the disk assertion: live model four,
  request snapshot three, persisted file three. Native `1791678025285`, restoration
  `1791678025154`, and `artifacts/plugin-cookie-write-negative-1791678025285`
  preserve the negative control and exact 54-source/harness snapshots.
- New production `05b8f4ad4821ad5f201b4772766dc5a5c190b403ad26c86c124e54d55d4d3dfd`
  passes native `1791678453748`, subsequent restart `1791678454838`, restoration
  `1791678453617`: persisted/model four, request three, original expired timestamp
  unchanged through the unrelated write and fresh process.
- Independent audit verifies the initial backup bytes, written file, both native
  results and hidden hosts, current/exact 54-source snapshots, original plugin
  store and both workspace files, plus all 653 original cookie files. It removes
  only the two absent-before, scenario-owned cookie files after owned native exit.
- Compiler passes with zero errors/warnings; Windows release build exits zero.
  Linux locked Cargo check passes in 18.27s with 275 actual source files matching
  the host, excluding four generated schemas explicitly. Evidence lives under
  `artifacts/native-plugin-cookie-persistence-probe` and
  `artifacts/linux-cookie-model-persistence-*`.
- Genuine guest helper rerun `1791678473871` / restoration `1791678473356`
  passes 13 checks, nine terminated workers and nine native requests, with
  populated cookie attributes, live expiry and exact owned-state restoration.
- Retained H2/metadata/history/restart `1791678513193` / `1791678521334` /
  restoration `1791678513011` passes nine cases, 27 workers and 30 native requests.
  Both suites have independent current/exact 54-source audits.
- Isolated staged-topic Linux locked check passes in 18.76s with 272 source files
  bound to the checkout before Cargo generates platform schemas. The pre-check
  manifest contains no generated schema files. The
  isolated Windows check was not rerun after the preceding topic's libclang
  discovery failure; full candidate Windows release/runtime evidence is separate.

The library documents `iter_any` for all retained entries and `matches` for
unexpired request-compatible entries:
<https://docs.rs/cookie_store/0.22.1/cookie_store/struct.CookieStore.html>.
The legacy model read matches the store's all-cookie operation:
<https://github.com/salesforce/tough-cookie/blob/master/api/docs/tough-cookie.store.getallcookies.md>.
The next section records separate acceptance for clear/delete/replacement,
response-driven writes and actual provider headers. Broader platform/migration/helper
parity remains required.

## Native provider acceptance

`INSOMNIUM_COOKIE_RESTART_PROVIDER=1` runs the existing saved restart scenario
with reusable `tests/ui/helpers/cookie-provider-cases.js`. Run it separately from
the write mode. It uses an owned loopback Bun HTTP fixture and the same unique
collection/main/previous files already protected by the restoration wrapper.

Production `05b8f4ad` passes 11 groups and 12 real native HTTP requests:

- Expiry, foreign-host and exact path-boundary filtering; expired entries remain
  visible to the model but absent from native Cookie headers, including when an
  explicitly supplied model snapshot contains them.
- Send off/store on, store off, cookies entirely disabled, actual response cookie
  persistence with HttpOnly, redirect-local cookies without model persistence,
  and explicit Cookie header precedence.
- Replace an existing cookie, refuse a stale snapshot generation before any wire
  request, delete an expired model entry, and clear the model/file/header. A
  second fresh native process confirms clear remains empty on disk.

Evidence: native `1791678832786`, fresh restart `1791678834794`, restoration
`1791678832680`. Independent audit checks all wire header pairs, snapshots,
persisted bytes, stale native error, original backup, both hidden/exit-zero
processes, both workspace files, plugin store and all 653 original cookie files.
The 55-source snapshot explicitly binds the two changed harness files to the
unchanged production source/binary. Compiler reports zero errors/warnings.
Retained write/restart regression `1791678872082` / `1791678872964` / restoration
`1791678871974` also passes with an independent 55-source audit.

Initial scenario `1791678749004` incorrectly expected Secure exclusion on
loopback HTTP. Pinned cookie_store `utils::is_secure` explicitly treats localhost
and loopback IPs as secure, so the corrected fixture expects Secure transmission
there. Subsequent `1791678796739` reached stale-generation rejection but failed
because Playwright flattened the native structured rejection to `evaluate: Object`;
the saved fixture now captures that native error inside the page and asserts its
actual message plus absence of a wire request. Both failures preserve owned-state
restoration and their source snapshots; neither is claimed as a product fix.

These gates are accepted for the controlled Windows loopback fixture only.
Non-loopback insecure exclusion, HTTPS transmission, actual domain suffix
matching across subdomains, equal-path ordering, concurrent/provider/proxy/platform
cases, import/edit UI and full helper/migration parity remain required.

## Verification on 2026-10-11

- Old production `d5a04def` negative control: persisted fixture has three entries;
  fresh native request/model snapshots both return two. Evidence:
  `artifacts/playwright/plugin-cookie-restart-native-1791677130952` and restoration
  `plugin-cookie-restart-restoration-1791677130846`; independent restart audit passes.
- New production `4d95694614ad04bba082e1e3098663bab707a653fe6951e6e9a711bb2e036e0d`:
  the same saved `tests/ui/plugin-cookie-restart-native.js` returns request two,
  model three with the original expired timestamp. Evidence: native
  `1791677644754`, restoration `1791677644597`, independent 54-source audit.
- Genuine mounted Send/guest helper rerun: `plugin-template-tags-1791677659246`,
  restoration `plugin-workspace-helper-restoration-1791677658727`; 13 checks,
  nine terminated workers and nine native requests. Host-only/default-path/session,
  suffix/explicit-path/persistent, Secure/HttpOnly and live expiry are independently
  checked in guest model, native snapshots and owned persisted fixture bytes.
- Both original workspace files, plugin store and all 653 original cookie files
  remain unchanged. Only scenario-owned fixture files are removed after owned
  native exit. All native hosts are hidden before CDP and report `native-hidden`.
- Windows release build exits zero; Linux locked Cargo check exits zero in 7.35s,
  with 275 actual source files matching the host (four generated schemas explicitly
  excluded). Exact snapshots and audits are retained under
  `artifacts/native-plugin-cookie-restart-probe` and `artifacts/linux-cookie-model-restart-*`.
- Retained HTTP metadata/H2/history/restart passes nine cases, 27 terminated workers
  and 30 native requests; native `1791677698553`, restart `1791677706722`, restoration
  `1791677698353`, independent 54-source audit.
- Retained Windows save chooser passes 12 groups (`1791677743512`), and explicit
  host destroy passes (`1791677854723`), with owned exit and original workspace
  restoration. Clipboard remains untouched by these scenarios.
- Isolated staged-topic Linux locked Cargo check passes in 9.50s. The isolated
  Windows check fails bindgen's libclang discovery; this is recorded separately
  from the successful full candidate Windows release/native tests. The topic
  checkout and check evidence remain under `artifacts/native-cookie-model-staged-check.json`.

Run the restart scenario with Bun and an explicit current build-state path plus
`INSOMNIUM_COOKIE_RESTART_FIXTURE` pointing to the controlled three-entry fixture
under `artifacts/playwright`. The scenario refuses paths outside that directory,
uses a unique absent collection file, and restores owned state after native exit.
This checkpoint does not complete the full plugin helper feature or migration.


</details>

<a id="record-cookie-rendering"></a>

<details>
<summary>COOKIE-RENDERING</summary>

# Cookie request rendering and isolation

## Per-request native cookie isolation — 2026-09-29

- Inspected original common/render.ts getRenderedRequestAndContext and libcurl-promise.ts cookie initialization: each request begins with a cookie snapshot, then learns redirect cookies. Current native CookieProvider instead reread the collection's shared store on every hop, allowing concurrent requests to change its outgoing cookies.
- CookieProvider now clones the current CookieStore when the provider is created. Outgoing cookies read that private store. Received Set-Cookie updates the private store when sending is enabled, even if persistence is disabled. With store enabled, only received cookie deltas merge into the live collection jar; an old snapshot never replaces newer unrelated entries.
- Existing collection generation invalidation remains: edit/clear/import invalidates older providers, prevents further sends from that snapshot and blocks late response writes. Lock order is consistently collection then private request store. No changes to disk format, Cookie UI or parser scope/expiry matching.
  -8 native inline assertions passed against the actual provider function/struct/trait implementation extracted from cookies.rs, compiled via rustc stdin and existing release dependency rlibs: concurrent isolation, response learning, delta merge preserving a newer session, local-only redirect cookie, no persistence when disabled, store-only mode, later provider visibility, and clear invalidating old sends/writes. In-memory fixture only; no app/user cookie data touched. Temporary executable/PDB removed; no saved test source/scripts.
- Cargo fmt -- --check, cargo check --locked, cargo clippy --locked -- -D warnings and git diff --check passed. Native-only change; no unnecessary frontend rerun or installer. Hidden node_repl direct programs and Bun filesystem operations retained.
- Official docs consulted before editing: https://docs.rs/cookie_store/0.22.1/cookie_store/struct.CookieStore.html (clone/parse/request values). Attempted exact reqwest CookieStore trait page was unavailable; existing provider trait implementation and compiled crate validate its contract. Reused existing subsystem, no generator/dependency needed.
- A guessed src/lib/cookies.js read/search path was absent; rg --files located legacy-cookies.js. No source edit failure.
- This isolates native request-time state; full cookie rendering parity remains incomplete. renderSendRequest currently receives no cookieJar, and workspace ignores its returned cookieJar. Next: expose a bounded native cookie snapshot with generation, render it in the same request session, pass validated rendered cookies as request-local input, and merge only response deltas without writing template-expanded seed values into durable source data. Retain original template-bearing legacy records, cookie flags, secure/domain/path/expiry behavior, cancellation and generation invalidation. Native provider creation currently snapshots after rendering, unlike the original pre-render snapshot.
- Real WebView/native redirects/HTTP/SSE/WebSocket acceptance, cookie template bridge, URL encoding, live SSE raw history and all remaining PARITY rows remain pending. Source newer than BUILD.json; full migration incomplete.

## Cookie snapshot renderer/native bridge — 2026-09-29

- Added main-window snapshot_request_cookies command and registration. Returns unexpired native cookie_store records plus collection generation, with10,000-cookie/8 MiB serialized bound. Snapshot includes native absolute expiry/scope metadata rather than reparsing relative Max-Age on every send.
- renderSendRequest obtains the collection snapshot before constructing its render session when cookies are enabled. Renders it alongside the request with the same environment/dependency/prompt context; preserves the original generation as ownership metadata and attaches the rendered cookieSnapshot to the outgoing request. Cancellation after snapshot lookup prevents rendering/dispatch. Cookie reads do not change UI collection selection or persist expanded source values.
- transport forwards cookieSnapshot; HttpRequest accepts an optional snapshot (older/internal callers fall back to native provider-time snapshots). build_client passes it to CookieProvider, which bounds it again, rejects stale generation and uses it only for the private request store. Received Set-Cookie still merges only response deltas. Cookie-disabled requests omit loading/sending snapshots.
  -40 inline assertions passed:7 compiled workspace/mocked IPC cookie cases (environment render, generation/collection, source immutability, flags/global disable, failure, cancellation),12 WebSocket initial-message regressions,9 User-Agent regressions (native mocks now return empty snapshots),12 actual native snapshot/provider assertions including serde roundtrip, rendered private cookies, source jar retention, oversized/stale snapshots and previous concurrency/redirect/clear behavior. Native probe used rustc stdin and existing dependency rlibs; temporary EXE/PDB removed. No saved test scripts, app/user-state writes or live fixture workers.
- Cargo check --locked, clippy --locked -- -D warnings, fmt -- --check, Svelte0/0, Vite build and git diff --check passed. Bun Prettier/Svelte/Vite and direct Cargo/rustc via hidden node_repl launch rules; no dependency/generator/new installer. Source newer than BUILD.json.
- Consulted official https://v2.tauri.app/develop/calling-rust/ before command work. Cookie documentation page failed to load; inspected installed official cookie_store0.22.1 src/cookie.rs serde contract and previously consulted CookieStore clone/from_cookies docs. Native serde preserves raw_cookie plus path/domain/expiry.
- Remaining cookie parity: legacy cookie_jar resource records containing templates that native import cannot represent are not yet overlaid; native raw_cookie string templating is not proven equivalent to original separately rendered key/value/domain/path fields (attribute delimiters need reconciliation). Manual OAuth token exchanges still use their existing native provider-time snapshot; no explicit cookie template renderer added there. Real WebView/IPC/network/redirect/header/SSE/WebSocket acceptance remains pending. Do not mark full cookie parity verified.
- Next: reconcile legacy structured cookie source/native serialization and template-bearing imports, then URL encoding, live SSE raw history, full runtime/UI/platform/packaging acceptance and every remaining PARITY row. Full migration incomplete.

## Structured cookie snapshot fields — 2026-09-29

- Replaced cookie_store raw_cookie strings in the new snapshot IPC with SnapshotCookie fields: key/value, typed domain/path/absolute expiry, secure/httpOnly. Generic request renderer now sees key/value separately. No frontend source change was needed.
- Provider rebuilds RawCookie through the documented builder, never parsing expanded values as Set-Cookie attributes. It then restores typed scope and expiry explicitly. Rendered header control characters fail before sending. Source/native durable cookies remain untouched; request-local snapshot and delta merge contract retained.
  -24 inline assertions passed:7 compiled frontend snapshot/IPC cases updated for the structured shape and17 native assertions against actual provider/snapshot conversion source. Native cases include prior generation/bounds/isolation behavior plus semicolon/Domain/Path-looking values staying literal, preserved domain/path/absolute expiry/secure/httpOnly, serde roundtrip and invalid-header rejection. This proves internal value/scope preservation, not how a server interprets a semicolon inside an outgoing Cookie header.
- Cargo check --locked, fmt -- --check, clippy --locked -- -D warnings and git diff --check passed. Initial check found two borrowed CookieExpiration values requiring clone; fixed and rerun. Native-only source change; no frontend build repeat or installer. Native probe compiled via rustc stdin with existing rlibs, EXE/PDB cleaned; no saved test source or real-user-state writes.
- Before implementing, consulted https://docs.rs/cookie/latest/cookie/struct.CookieBuilder.html and installed official cookie_store0.22.1 lib.rs/cookie.rs/cookie_path.rs/domain/expiration definitions. Online cookie_store index failed; installed crate source confirmed public reexports, builder conversion and clone/serde behavior. No generator/dependency needed; hidden node_repl/Bun/direct Cargo rules retained.
- This supersedes the prior raw_cookie interpolation limitation. Full legacy cookie parity remains incomplete: imported cookie_jar template records not representable in native persistent storage need structured overlay; tagged native domain/path/expiry representation differs from legacy fields, and template-bearing scope/expiry/import behavior needs reconciliation. Manual OAuth cookie rendering and real WebView/HTTP/SSE/WebSocket/redirect acceptance remain pending.
- Next: legacy cookie source/overlay semantics, URL encoding and live SSE raw history, then full runtime/UI/platform/packaging acceptance and remaining PARITY rows. Source newer than BUILD.json; full migration incomplete.

## Explicit OAuth cookie rendering and legacy-source audit — 2026-09-29

The complete historical OAuth cookie-rendering contract, source audit, evidence and remaining gates are retained in [AUTHENTICATION — manual OAuth rendering](AUTHENTICATION.md#record-manual-oauth-rendering).

</details>

<a id="record-default-headers"></a>

<details>
<summary>DEFAULT-HEADERS</summary>

# Legacy DEFAULT_HEADERS built-in hook

Plugin inventory exposed a missing built-in behavior: rendered environment DEFAULT_HEADERS should add missing headers before transport. The shared Send path now applies this after detached request/environment rendering and disabled row removal, before automatic OAuth/transport composition. Saved resources remain unchanged. Template preview and explicit manual OAuth rendering do not run this Send hook; browser-preview Send does. No native backend, CSS, dependency or generator changes.

Source contract: archived plugins/index.ts getRequestHooks, context/request.ts, common/misc.ts filterHeaders and common/render.ts. Own keys retain order; existing request names win case-insensitively, including duplicate rows. The exact string null omits a default only after the existing-header check, so it never removes an explicit request header. Other values remain literal for existing transport conversion. Disabled rows are removed first, allowing a default to supply that name. A shared name index avoids repeated scans.

Consulted before implementation: [MDN Headers](https://developer.mozilla.org/en-US/docs/Web/API/Headers) for HTTP name matching and transport restrictions. This hook reproduces inspected legacy ordering rather than replacing the application's transport header list with a browser Headers object.

Direct14 assertions passed before index refinement. Final16 differential cases use the extracted actual legacy hook body with controlled request-context callbacks: absent/falsy/empty defaults, explicit duplicates/case precedence, string-null omission, zero/false/empty/actual-null values, case-colliding defaults, literal template output, arrays/string/number input. Result/hashes: `artifacts/playwright/default-headers-differential.json`. This is bounded helper evidence, not every malformed-header/provider case.

```powershell
bun run check
$env:LIBCLANG_PATH='E:/.dvgamerr-app/insomnium-app/artifacts/tools/llvm-20.1.8/bin'
Remove-Item Env:INSOMNIUM_UI_LOW_MEMORY -ErrorAction SilentlyContinue
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_TEMPLATE_DEFAULT_HEADERS='1'
Remove-Item Env:INSOMNIUM_TEMPLATE_OAUTH -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_OAUTH_GRAPH -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_CYCLES -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_SSE -ErrorAction SilentlyContinue
Remove-Item Env:INSOMNIUM_TEMPLATE_ENVIRONMENTS -ErrorAction SilentlyContinue
bun tests/ui/template-response-send.js
Remove-Item Env:INSOMNIUM_TEMPLATE_DEFAULT_HEADERS
bun tests/ui/template-response-send.js
```

Production build24148 exited0 (started1791623121853/finished1791623573225), SHA256 `f7c8655031ecc4030071678cd50f99e33e4697a77f3e72b5ee46a5e5889f834f`. Binding verifies469app/235scenario704paths/probe identity/preserved9fc6a4b7 baseline under `artifacts/native-default-headers-baseline`. Source freeze: `artifacts/playwright/default-headers-source-freeze.json`. Only shared request-render integration/new helper/saved scenario changed from the prior accepted application.

First native artifact1791623588057 failed the expected caller default: the fixture's original env_trs belonged to the foreign collection. Corrected only the scenario after terminal, adding caller Base environment and updating the original foreign Base separately. First-run freeze is preserved as default-headers-first-run-freeze.json; unchanged application/executable verified before refreshing the scenario hash. Native69248 exited0; failed result retained. Final compiler2965 exited0/zero errors/warnings; formatting/diff checks pass.

Final defaults7798/artifact `artifacts/playwright/template-default-headers-1791623651139` exited0/passed3groups/4wire/5workers; native57656 exited0/native-hidden/visible:false. Independent default-headers-audit.mjs checks704source/executable/baseline, direct/absent/foreign literal headers/body/base64, explicit/sentinel precedence, disabled replacement, scalar values and caller/foreign Authorization scope, unchanged saved request headers/descriptions, four durable histories and UI selection.

Same-build ordinary response-template regression68709/artifact1791623681673 exited0/passed19groups/20wire/43workers plus held dependency; native70288 exited0/native-hidden/visible:false. The original audit is preserved; default-headers-http-audit.mjs uses the current freeze. Its copied hardcoded source-count metadata was corrected to derive704 from the verified hash maps. Literal extraction/refusals/trigger/nested/foreign/Cancel/stopped-worker checks pass. Current frontend saved headless workspace12 passed. All three exact owned PID/profile process sets are absent, recorded in `artifacts/playwright/default-headers-cleanup.json`; no live feature handles.

This accepts the covered built-in HTTP Send behavior, not arbitrary custom plugins or all protocol/auth/provider/platform cases. Custom discovery/store/hooks/actions, malformed/non-string header interoperability, assistive/platform/shared adoption/ownership and every original migration/UX/CSS gate remain required. See [PLUGINS.md#record-plugin-compatibility](PLUGINS.md#record-plugin-compatibility).


</details>

<a id="record-multipart-fields-root-acceptance"></a>

<details>
<summary>MULTIPART-FIELDS-ROOT-ACCEPTANCE</summary>

# Multipart file fields: current root acceptance — 2026-10-13

KeyValueEditor now composes existing Field/FilePicker with exact indexed File value N names. Only readUpload limit/read failures attach to the owned row; work-admission and caller failures remain form-level with original current-row suppression semantics. Another row succeeding preserves the invalid row's error; correcting that row clears it. Name/disabled clones transfer feedback to the actual accepted parent proxy, while external row replacement removes stale feedback. No error or identity is persisted. Focused removal returns to same-index/previous survivor or Add after tick; normal callback/data/upload/serialization behavior is retained.

Production changes are limited to KeyValueEditor and feature key-value.css. Empty caption hidden through the explicit existing Field div branch, nested display:contents FilePicker and feedback wrapping preserve valid geometry; only error rows expand. Shared primitives/APIs/tokens, upload quotas, parser/editor/backend/permissions/dependencies are unchanged.

Root independently rehashed785 agent source/harness/build/output/verification files, seven exact raw current-root delta guards and report1645cb3f before adoption. The entire original saved design-system body is equal after removing only two appended imports/four additive test lines. Preview helper is excluded; root existing WIP remains untouched. Immutable63/66/69 negatives and row-clone RED are retained. Read-only LF-block guard first refused CRLF input before any adoption; log-directory preparation failed before scenario launch; root auditor initially used an array index for the recorded errorGeometry object. These instrumentation failures and original scripts are retained in the root proof; no production/scenario assertions were relaxed.

Root compiler2641 completed0errors/0warnings. Serial16983 SAME full headless design-system and actual root build both completed0. All713 source inputs stayed exact through both commands and49 frontend assets were archived. Independent artifacts/multipart-field-root-proof/root-audit.json verifies six dark/light1440/900/760 profiles with zero failures; full original row/control coordinates, sizes, fonts, colors and backgrounds exactly match the immutable V2 negative. Actual production error-state FilePicker183.984375×35/type45.96875×35 and their styles remain exact; feedback18/18/36px has no horizontal overflow and remains below600px. Actual20MiB+1 refusal, accepted AEH/ bytes, controlled owned-File read fault, other-row retention/same-row correction/name-disabled transfer/external reset/public workspace admission/editor disposal/stale-read suppression/caller exception classification and all three keyboard-removal routes pass alongside the complete original suite. Prototype composition remains a separately labeled experiment.

No native host/profile or root process remains. Current bf5e binary predates these product changes, so prior XML/namespace/structural native proofs remain bound to their unchanged generation. Fresh native file picker/OS read failure/assistive technology/platform and full migration/repository/SDK/Event/FIFO/notice/private/distribution/remaining UX remain open. Native freshness correction and authentic archive-bound collector validation proceed in isolated worktrees.

Commit by topic; STATUS contains evidence, remaining gates and handles. This interface cannot invoke /compact; this report is the explicit feature handoff.


</details>

<a id="record-native-cookie-fields-root-acceptance"></a>

<details>
<summary>NATIVE-COOKIE-FIELDS-ROOT-ACCEPTANCE</summary>

# Actual native Cookie field validation accepted — 2026-10-13

The current native CookieManager now has actual Rust/WebView2 evidence for its URL and byte-limit field errors. On fresh app e56723deefd14a53834b23dfdb1ee7b17938022af6dcb7e66af29f7f18def352, the saved scenario captures25 unmodified native custom-protocol replies and verifies18 form refusals across dark/light1440/900/760×600: FTP scheme,8194-byte UTF8 raw value and combined invalid scheme/large raw. Combined failure actually returns the Rust byte-limit error first. Every refusal preserves the exact seeded previous keys, live jar/generation and current/previous disk text. The correct field has its exact accessible name, invalid flag and unique error description; one local alert fits every clipping ancestor. Still-invalid correction retains it, valid correction clears it without invoking a command. Default7px remains.

Six keyboard rows verify native malformed HTML URL causes no IPC, trusted Input Enter issues exactly one real refusal, settled New cookie clears ownership/fields and Escape returns focus. These are actual backend results, not controlled presets. No Tauri/global IPC/fetch/result replacement or network server is used; passive Playwright request/response events are required and observed. The underlying Rust, product and CSS remain unchanged from the already accepted current generation.

V1 session25200 failed before fixture creation because the existing Git inventory exceeds the saved reader's10000-file cap. Its native host exited and all protected profile bytes restored; the complete negative is retained. Metadata inspection identifies13783 files,15865 directories and8504236 bytes, maximum2164811 bytes. The reviewed metadata SHA fdcb53ab7bc5511fbc73bba59adccc80c6729370621530e2efca6ae77a2c2b43 pins every exact path/size including hidden .git. The saved Git-only reader checks the complete metadata set before content reads, streams each file with one64KiB buffer, checks file identity/time/size before and after and rechecks the full set. Unknown/missing paths fail. Cookie inventory bounds and all original cases remain unchanged.

V2 native-hidden34526 completed0,24 rows/25 protocol replies. Independent artifacts/cookie-native-current-root-v2/root-audit.json rehashes consumed current e567 source/runtime harness/receipts/outputs and verifies host exit0/profile release. Root saved driver compares ALL13783 Git byte hashes before native startup and after host exit, strengthening callback-only preservation. Original43 resources/20 history, both exact workspace buffers, plugin store, complete654-cookie filename set/bytes and current3+legacy2 layout keys are restored. Actual newly seeded collection ID/name is registered before saving; only its owned cookie files are retired by the existing preservation helper. No unknown original file is removed.

The existing Nocturne entry gained only an optional cookie-native-fields early branch. Its entire original native body and earlier controlled Cookie branch reconstruct exactly. Executed artifact copies differ only by explicit import rebasing; this test-only runtime supplement leaves the1013-input compiled native product closure immutable. Three saved test paths are now adopted for reuse, and current compiler53258 passes0errors/0warnings with1010 source inputs frozen. Exact test before/after hashes are recorded in saved-test-adoption.json. Metadata baseline stays an owned artifact supplied through explicit source/executable/build/pin environment guards; no generic environment override or arbitrary baseline is accepted.

The entered-response New-owner and modal-disposal races remain explicitly unexecuted. A quick completed refusal is not proof of an entered response still pending during the owner change. Native pixel measurements use WebView2;760 is CSS-emulated viewport coverage, not a physical native minimum-window claim. OS picker/AT/platform/other production workflows, full SDK/Event/FIFO/private/distribution/notice/migration/UX scopes remain open. Source/corpus resource-copy and narrow Cookie acceptance do not imply complete migration.

Root handles:none; profile released. Verified topic commit and STATUS handoff follow this feature. This interface cannot invoke /compact; handoff is recorded without claiming compaction.


</details>

<a id="record-native-cookie-pending-ui-root-acceptance"></a>

<details>
<summary>NATIVE-COOKIE-PENDING-UI-ROOT-ACCEPTANCE</summary>

# Actual native Cookie UI pending ownership — 2026-10-13

Saved native-hidden scenario now verifies New cookie and modal close while the real UI is awaiting a native scheme refusal. Twelve additive cases cover both actions in dark/light at1440/900/760×600. The original24 cases and25 replies remain separately mapped; total37 unmodified replies are observed. Product, Rust, CSS, executable e56723de and sidecar a5ec393d remain unchanged.

Each case uses scripted form.requestSubmit(actualSaveButton), one existing Svelte microtask checkpoint, actual New/close button.click and one reset/unmount checkpoint. The form is HTML-valid. Actual URL/raw/save controls are disabled and Save reads Saving… before action. New clears fields while still pending; close removes the actual modal subtree. Passive request ownership and exposed observer checkpoints require pending-ui→post-action→protocol-response order. No sleep, transport interception, response substitution or delay is added. requestSubmit's actual SubmitEvent reports isTrusted:true, while click isTrusted:false; scripted initiation is not trusted keyboard evidence.

Actual Rust replies reject the exact scheme message with original previous-cookie keys. Live jar generation and both owned disk texts remain unchanged; settled New/fresh reopen has no stale field/global feedback or notice. Root independently checks all12 receipts,36 ordered events,37 replies and the original18 scheme/8194-byte/precedence refusals plus six keyboard/reset cases. Physical Rust entry/reply-production timing remains unobserved, and its gates stay open.

V3 session73374 ended1 because unsupported Playwright page.removeExposedFunction threw in cleanup. It observed24/12 rows but lacked final trace/preservation receipts; root refused full acceptance. Full raw negative and independently verified profile restoration are retained. V4 changes exactly that unsupported cleanup line to a comment documenting the existing owned context lifecycle; all timing/assertion code is identical. The unique exposed binding ends with the owned context. Installed Playwright1.63 types and official [exposeFunction documentation](https://playwright.dev/docs/api/class-page#page-expose-function) were reviewed. Initial root manifest/snapshot-generation pairing refusal is separately retained and corrected using final-relative frozen paths.

V4 root driver44998 authoritatively completed0, native host hidden/exited0. Independent artifacts/cookie-native-current-root-v4/root-audit.json rehashes runtime/source/resource/private authority and archives final outputs. The terminal driver verifies all13783 Git file bytes before startup/after host exit; exact654 original-cookie file set/bytes, both workspace buffers, plugin store,43 resources/20 history and current3+legacy2 layout keys are restored. Profile is released; no live root handles.

Only tests/ui/helpers/cookie-native-fields.js is adopted: b48abe8c→ce743446, additive pending checks plus supported context-lifetime cleanup. Saved entry/Git helper and product remain unchanged. Current root compiler76719 completed0 with0 errors/0 warnings, and1010 current input snapshots are frozen/rehashed. Original compiled1013-input generation and earlier V1/V2/V3 negative/positive evidence remain immutable; this is a declared saved-test supplement.

OS/AT/platform/physical Rust-entry/trusted keyboard races, other production workflows and all original SDK/Event/FIFO/private/distribution/fullnotice/migration/UX gates remain open. Next root topic is exact-three notice transition adoption and deliberate765 recollection; isolated57-group proof is ready, actual root58 remains pending. This interface cannot invoke /compact; STATUS records the topic commit/evidence/gates/empty handles handoff.


</details>

<a id="record-query-row-order"></a>

<details>
<summary>QUERY-ROW-ORDER</summary>

# Mixed query row order

Status: verified implementation, direct checks, full native URL/signing acceptance
and fresh generated-query regression.

Previously, legacy URL construction grouped ordinary query rows before generated
OpenAPI rows. An API-key append in the cURL encoding-off path also reserialized
the preceding query through URLSearchParams. Both could change the raw target
that authentication signs.

The transport now appends enabled row fragments in their displayed order when
generated or explicitly empty-name rows are present. Array expansion stays at
its originating row. Generated nullable omission and represented empty values
retain their existing serializer semantics. Manual rows retain the selected
legacy or form codec. An explicitly enabled empty name survives automatic
encoding. The API-key pair follows the row stream without reserializing it.

The source URL still uses the existing selected URL codec. cURL GET-derived
query data is appended to that source query before the ordered row stream.
Ordinary named rows without generated metadata retain their existing pipeline.
Generated allowReserved fragments keep their existing delimiter behavior.
The source URL, editor layout and CSS are unchanged.

Standards consulted before implementation:

- [WHATWG URL / URLSearchParams](https://url.spec.whatwg.org/#urlsearchparams):
  updating searchParams serializes the list using form encoding.
- [RFC 3986 query component](https://www.rfc-editor.org/rfc/rfc3986.html#section-3.4).

Verification so far:

- `bun run check`: 0 errors, 0 warnings after the final scenario assertions.
- Selected source/scenario Prettier checks pass.
- `query-order-expanded-direct.json`: eight literal target comparisons.
- `query-order-boundary-direct.json`: eight cURL GET/empty-name boundaries and
  52 comparisons against the committed legacy URL codec.
- `query-order-style-direct.json`: 33 existing style goldens in all four
  encoding/cURL contexts (132 targets), interleaved between manual rows, pass.
- `query-order-scenario-preflight.json`: all 82 planned signed/API-key targets
  match independent literal goldens before native execution.

The saved `tests/ui/url-encoding.js` retains 46 original signing regressions and
adds 32 ordered Hawk/OAuth cases across SHA1/SHA256, initial legacy/standard signing,
encoding on/off and ordinary/cURL contexts. Four API-key cases and three
original setting toggles bring the planned total to 85 wire targets and 78
signatures and eight legacy OAuth1 refusal/recovery controls. Its Hawk oracle
also rejects changing only the order of two pairs; OAuth verification retains
its standard sorted normalization. Ambiguous legacy OAuth1 queries must refuse
before TCP delivery. The saved UI explicitly selects RFC 5849 in Auth, verifies
that choice and the unchanged parameters across reload, and then sends the same
rows. Acceptance distinguishes the initial and effective signing modes.

Fresh production probe build: `bun tests/ui/build-recovery-copy-probe.js`,
started 1791522146028. Use its successful build record before running:

```powershell
$env:INSOMNIUM_UI_BUILD_STATE = 'artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/url-encoding.js
```

The corrected native URL run `url-encoding-1791524903364` finished successfully
on this build: 85 targets, 78 runtime signature assertions, seven checks and
eight pre-network legacy refusal/explicit RFC recovery controls. The independent
saved-wire audit rechecks counts, four API-key goldens, all 32 new signatures,
initial/effective signing modes, Hawk pair-order rejection and refusal records.
The native host exited0, its owned processes/profile closed, and the actual
wire fixture port52389 has no listener. No passing URL run was restarted.

The sequential saved `openapi-query-serialization.js` regression1791527884678
passes all44groups on OpenAPI3.2.1 and the same unchanged build (session86758
terminal0; started06:38:04.691Z, finished07:00:36.799Z). Independent-query-audit.json
checks33literal generated targets and11edit/runtime controls, including5
pre-network refusals. Saved assertions verify resources and reload without
resend. Both actual760px linked-help images and geometry were inspected. Native
51152 exited0/native-hidden/visiblefalse; Bun35200, native host, owned WebView
profile and actual wire listener56199 are gone. Selection recoveries0: the
conditional timeout recovery branch was not exercised by this accepted run.
This new run does not claim a fresh check of every other OpenAPI version.
Native scenarios remain `native-hidden`; saved
browser scenarios use the fixed headless helper. This document does not close
any broader migration, platform or UX/CSS requirement.

The first native attempt `url-encoding-1791522580937` failed at a composite
accessible-name lookup after reload. Its screenshot, text snapshot and owned
profile show the correct active GET request. The saved selector now matches the
exact descendant request name and retains method, unique-row, persisted active
ID and rendered-selection checks with a bounded 60-second reload wait. The
failed run is retained and its host/fixture listener closed.

The next attempt `url-encoding-1791522895225` reached 69 targets, completing all
46 original signatures and 16 new Hawk cases, then failed because its first new
legacy OAuth1 query was refused by the existing ambiguity guard. The fixture's
generated `empty=` duplicates the source URL's empty value, and cURL encoding-off
also introduces plus ambiguity. The failure screenshot/text and native
`oauth1.rs` guard confirm the required explicit RFC selection. That attempt is
retained as failed; its host exited0 and listener63527 closed. The saved scenario
now asserts all eight refusals and explicit persisted UI recovery instead of
waiting for a request that policy prohibits. The full corrected retry passed as
recorded above; the earlier attempts remain failures.
Production source/build is unchanged by these test-only repairs.

The first fresh generated-query attempt1791527266978 timed out at the shared
15-second persistence predicate after generation. Its screenshot shows33
requests, and the subsequently read owned profile has exactly33requests for
the precise sourceSpecId. Host exit0/native-hidden and fixture49309closure
were verified. The saved shared helper now allows60seconds for the same exact
sourceSpecId/count predicate; compiler0/0 and formatting pass. The full3.2.1
retry runs on the unchanged production build. URL acceptance remains valid.

The generated-query retry1791527558730 passed the generation wait and three
wire groups, then its15second click timed out after form-exploded-object had
already become the exact persisted/rendered active request. Screenshot and
owned profile confirm this. Native host exited0 and fixture57705closed. The
saved scenario now verifies unique source/name/method selection, skips restored
active rows, bounds clicks at60seconds and only records timeout recovery when
both persisted active ID and rendered class already match. Other errors fail.
Compiler0/0 passes. The full44group retry passed as recorded above; no passing
URL coverage was restarted and the production source/build remained unchanged.

Reproduce the saved generated-query regression after the same fresh build:

```powershell
$env:INSOMNIUM_UI_BUILD_STATE = 'artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_VERSION = '3.2.1'
bun tests/ui/openapi-query-serialization.js
```


</details>

<a id="record-unix-socket"></a>

<details>
<summary>UNIX-SOCKET</summary>

# Unix socket transport implementation notes

## Current evidence (2026-10-01)

- Legacy URL parsing and socketPath IPC are connected; native reqwest unix_socket is cfg(unix). Windows currently refuses explicitly. This is incomplete parity, not a platform exclusion.
- Host has Windows curl8.21.0 with UnixSockets. Only Rust targets installed: wasm32-unknown-unknown, x86_64-pc-windows-msvc. WSL dockerman-backend reports Linux but has no cargo/rustc/bun; it is an infrastructure distro, not an established development runner. No toolchain installed or distro modified.
- reqwest0.12.28 source has a Windows named-pipe connector, not Windows AF_UNIX. Named pipes must not be substituted for the legacy socket path. Its public connector_layer requires Response=sealed Conn and request=Unnameable, so a normal app-owned Tower layer cannot supply arbitrary replacement transport streams.
- uds_windows1.2.1 official source is already downloaded in Cargo registry but not built into app release deps. It exposes real AF_UNIX UnixStream/UnixListener on Windows; dependencies memoffset0.9,tempfile3,windows-sys>=0.60<0.62. Actual connectivity and async/TLS integration are NOT verified yet.

## Next implementation decision

1. Prove Windows AF_UNIX connect/read/write and cancellation with uds_windows against a local listener and curl; run with Rust/Bun only.
2. Validate an asynchronous adapter into the existing reqwest local-transport TLS path. Public connector_layer cannot construct its sealed connection; evaluate a focused version-pinned reqwest patch versus a dedicated Hyper client carrying every existing cookie/auth/redirect/TLS/cancel behavior. Do not replace the client with a smaller HTTP-only substitute or a TCP/named-pipe bridge without preserving the contract.
3. Preserve DNS/proxy bypass, effective HTTP host for TLS/signing/cookies, configured request timeout/cancel, stream behavior and same/cross-origin rules.
4. Establish Unix target compilation/runtime on a suitable owned runner/container; existing Windows cargo check does not cover cfg(unix). Keep this gate open while making Windows progress.

## Sources

- https://docs.rs/reqwest/0.12.28/reqwest/struct.ClientBuilder.html#method.unix_socket
- Installed reqwest0.12.28 src/connect.rs connect_local_transport and src/async_impl/client.rs connector_layer bounds
- https://docs.rs/uds_windows/1.2.1/uds_windows/struct.UnixStream.html
- https://docs.rs/crate/uds_windows/1.2.1/source/README.md

## Windows runtime evidence

2026-10-01: uds_windows1.2.1 compiled and inline native probe passed65536-byte async echo through Tokio from_std after unique socket-handle ownership transfer, pending-read timeout, drop→peer EOF and curl.exe UnixSockets interoperability. Evidence artifacts/unix-socket-reference/windows-uds-probe.json. Connect was synchronous; cancellable connect and TLS are not verified. Root cfg(windows) dependency is staged for integration; reqwest/app routing still needs implementation. No probe socket/process remains.

## Nonblocking connect recipe and evidence — 2026-10-01

Evidence: artifacts/unix-socket-reference/windows-uds-nonblocking-probe.json. socket2 0.6.5 already has a release rlib. Rust probe compiled from stdin.

1. Socket::new(Domain::UNIX, Type::STREAM, None).
2. set_nonblocking(true) BEFORE connect(SockAddr::unix(path)).
3. Return errors except WouldBlock; remember pending state.
4. Safe socket.into() conversion to std::net::TcpStream then Tokio TcpStream::from_std within runtime.
5. If pending, await writable, then fail on any take_error() value.
6. Future owns stream: dropping Pending closes socket. Existing reqwest timeout must wrap this future.
7. Use resulting stream in existing local-transport TLS branch; preserve effective TLS hostname and all HTTP semantics.

Actual pending connect succeeded; explicit Pending future drop produced peer EOF. Missing endpoint returned OS10061. Overloaded listener, TLS, full-app cancellation and non-Windows acceptance remain unverified. Root uds_windows dependency remains staged; final adapter may use socket2 instead.

Sources:

- https://docs.rs/socket2/latest/socket2/struct.Socket.html#method.connect
- https://docs.rs/socket2/latest/socket2/struct.SockAddr.html#method.unix
- Installed socket2-0.6.5/src/socket.rs and src/sockaddr.rs API docs (versioned web fetch failed).
- https://docs.rs/tokio/latest/tokio/net/struct.TcpStream.html#method.from_std
- https://docs.rs/tokio/latest/tokio/net/struct.TcpStream.html#method.writable

## Windows AF_UNIX connected to patched reqwest — 2026-10-01

- Previous goal turn made progress: nonblocking connection/cancellation proof. Revalidated STATUS/PLAN/PARITY and pinned reqwest connector source; consulted Cargo patch documentation before changes.
- Vendored crates.io reqwest0.12.28 at src-tauri/vendor/reqwest with licenses and INSOMNIUM-PATCH.md provenance. Root exact =0.12.28 requirement plus [patch.crates-io] applies to shared dependency graph. Registry untouched.
- Async unix_socket API/path now available on Windows. Connector drops proxies and selects AF_UNIX before named pipe/TCP. socket2 Windows-only dependency creates nonblocking STREAM, awaits writable and checks SO_ERROR; owned stream drops with cancelled future. Existing TLS wrappers reused in a Windows-specific function, preserving effective URI hostname and TLS config; Unix/named-pipe paths untouched.
- Application build_client now enables socket routing on Windows as well as Unix. Token envelopes still clear socket path. Cargo check --offline updated lock to local package; rustfmt and cargo check --locked --offline then passed (reqwest, reqwest-websocket, app). Root uds_windows dependency from earlier fixture proof remains staged.
- NEXT compile release connector and prove real HTTP/HTTPS, proxy/DNS bypass, body/redirect/auth/cookie/stream/timeout/cancel through patched client, then saved native UI scenario/new isolated build. Native executable still predates this patch. Native-TLS feature variant and non-Windows platform compilation/runtime remain unverified. Full migration open; no live build/process/server.

Source: https://doc.rust-lang.org/cargo/reference/overriding-dependencies.html#the-patch-section

## Patched Windows AF_UNIX HTTP accepted; proxy-header leak fixed — 2026-10-01

- Previous goal turn made progress (patched reqwest integration). Revalidated STATUS/PLAN/PARITY and patch provenance.
- cargo build --release -p reqwest initially ambiguous because graph also includes0.13.5; corrected to -p reqwest@0.12.28 --manifest-path src-tauri/Cargo.toml --locked --offline. Release patched crate built.
- First actual HTTP probe exposed Proxy-Authorization despite connector proxy bypass. Fixed vendor async_impl/client.rs to clear client proxy matcher list before Arc construction whenever unix_socket is configured (Unix and Windows). This prevents generated proxy auth/custom headers, retaining manually supplied request headers. Connector-only bypass was insufficient.
- Inline Rust stdin probe against real uds_windows listener passed: exact POST65536 binary body/response, escaped target/effective Host/Bearer header, unresolved .invalid host and dead authenticated proxy bypass, no Proxy-Authorization or custom X-Proxy-Only header, Set-Cookie/replay,302 redirect and chunked response via chunk(). Compile/run exit0, evidence artifacts/unix-socket-reference/windows-uds-http-probe.json.
- Request timeout returns is_timeout and peer EOF after client drop with runtime continuing100ms. Initial cleanup probe stopped driving current-thread Tokio before waiting on server, causing peer read timeout; corrected fixture to let runtime drive background cleanup. This proves cleanup with client drop, not pooled-client reuse or app Cancel yet.
- cargo check --locked --offline passes after fix. No saved non-UI test scripts; only stdin probe and ignored evidence/exe. No live process/server/build.
- NEXT HTTPS certificate/hostname/TLS info acceptance with trusted/untrusted local fixture, then native UI request/cancel/auth/redirect matrix and isolated full build. Unix platform runtime, native-TLS feature and full migration scope remain open.

## Windows AF_UNIX HTTPS certificate validation accepted — 2026-10-01

- Previous goal turn made progress (HTTP acceptance and proxy-header fix). Revalidated STATUS/PLAN/PARITY and consulted official rustls StreamOwned, reqwest tls_info, OpenSSL req/x509 docs before fixture implementation.
- Generated local P-256 CA and server certificate with Git OpenSSL3.5.7 using documented req/x509 commands. SAN uds-only.invalid, CA:FALSE/serverAuth leaf,2-day lifetime. Files are under ignored artifacts/unix-socket-reference; no OS trust-store change. Exact argument arrays stored tls-fixture-commands.json; regenerate after expiry. server.ext specifies SAN, basicConstraints, digitalSignature, serverAuth.
- Inline Rust stdin probe uses real uds_windows listener + rustls StreamOwned and patched reqwest release crate. Three HTTPS cases pass: explicit local CA + correct host returns TLS OK, server sees expected SNI/Host, TlsInfo peer certificate exactly matches fixture DER; trusted CA + wrong host fails NotValidForName; untrusted CA fails UnknownIssuer. Negative handshakes fail before any HTTP bytes, not on timeout.
- Evidence artifacts/unix-socket-reference/windows-uds-tls-probe.json compile/run exit0, no warnings. No product edit/rebuild this turn; no saved non-UI test script. Probe closes listeners/removes socket paths. No live process/build/server.
- NEXT saved Playwright native scenario using fresh isolated app build: original Unix URL syntax, HTTP/HTTPS settings, response, persistence, app Cancel and socket path mapping on Windows. Shared app auth/redirect/cookie semantics and Unix platform runtime still require their acceptance. TLS probe establishes patched client behavior only, not full native UI/migration completion.

- https://docs.rs/rustls/0.23.45/rustls/struct.StreamOwned.html
- https://docs.rs/reqwest/0.12.28/reqwest/struct.ClientBuilder.html#method.tls_info
- https://docs.openssl.org/3.5/man1/openssl-req/
- https://docs.openssl.org/3.5/man1/openssl-x509/

## Native Unix socket Send/Cancel accepted; auth regressions passed — 2026-10-01

- Previous goal turn made progress (saved scenario/fixture) and verified live build. Revalidated STATUS/PLAN/PARITY; continued polling same supervisor33312, never restarted. Build finished exit0 at1790800783641 (~329s), fresh artifact artifacts/native-unix-socket-ui-probe/insomnium-fetch-recovery-probe.exe.
- bun tests/ui/unix-socket.js passed1790800806086: real AF_UNIX slash-rooted Windows path from original http://unix:/socket:/host/path syntax, import/reload retains original URL, exact encoded request target and effective Host, response text, Cancel→peer EOF and successful Send afterward. Three wire requests. Script/native app/fixture exits0; no forced cleanup. Evidence artifacts/playwright/unix-socket-1790800806086/{acceptance,result}.json.
- Existing url-encoding scenario passed1790800826812 on same build (23 Settings/Hawk/OAuth1/AWS wire cases); codecommit passed1790800842685 (6 cases/10 requests including307/303 same/cross-origin). Used INSOMNIUM_UI_BUILD_STATE=artifacts/native-unix-socket-ui-probe/build-state.json. These are TCP regressions, not all auth modes over AF_UNIX.
- No product/test edits this turn. No live build/app/fixture remains. Build handle nativeUnixSocketBuild terminal exit0; authoritative build-state finished/result0.
- NEXT extend saved Unix socket scenario for native HTTPS trust/hostname/settings and auth/redirect/cookie behavior; retain prior patched-client TLS evidence but do not conflate it with UI acceptance. Unix target compilation/runtime, other platform behavior and all remaining full PARITY scope stay open. Deferred UX starts only after full migration.

## Native Unix socket HTTPS Preferences acceptance passed — 2026-10-01

- Previous goal turn made progress (native Send/Cancel and auth regressions). Revalidated STATUS/PLAN/PARITY and inspected Preferences/transport CA and validateCertificates bindings.
- Added saved tests/ui/unix-socket-tls.js: Bun orchestration with embedded Rust AF_UNIX rustls fixture, fresh OpenSSL P-256 local CA/server cert generated each run using previously documented req/x509 commands, no system trust changes. Uses successful native-unix-socket-ui-probe build; no product edits or new app build.
- Through actual Preferences UI, edits Custom CA (PEM)/Validate TLS certificates, verifies persisted settings, reloads then Sends original legacy HTTPS Unix URL. Four cases pass: trusted matching hostname; trusted wrong hostname rejected; unknown issuer rejected; explicit validation disabled succeeds. Fixture verifies SNI/Host on success and zero HTTP bytes before rejection; UI displays actual error sending request for negative cases. Original CA/validation settings restored in finally; original request URL persists.
- Initial run passed1790801006282; strengthened negative UI assertion from broad certificate/TLS regex (could match scenario name) to error sending request, rerun passed1790801034434. Use latter evidence artifacts/playwright/unix-socket-tls-1790801034434/{acceptance,result}.json. Script/app/fixture exit0; no forced cleanup. bun run check passes0 errors/warnings before regex-only assertion tightening.
- No live process/build/server. NEXT native AF_UNIX auth/cookie/redirect/stream acceptance; Unix target compilation/runtime and remaining full PARITY still open. TLS UI acceptance is not proof of full migration. Deferred shared UI/UX remains subsequent phase.

## Native AF_UNIX auth/cookie/redirect routing accepted — 2026-10-01

- Previous goal turn made progress (native HTTPS4-case acceptance). Revalidated STATUS/PLAN/PARITY, inspected frontend auth and native cookie/redirect routing; consulted RFC9110 redirection semantics.
- Extended existing tests/ui/unix-socket.js (same scenario reused) with same-host302+Set-Cookie, cookie replay after page reload, cross-host302, and Basic auth. Fixture records exact HTTP headers over one real AF_UNIX path; verifies original saved legacy URLs stay unchanged.
- Same-host redirect retains Bearer and sends newly received host cookie. Cross-host redirect changes effective Host to other.invalid and omits original Authorization/Cookie even though socket path stays identical. Basic header matches independent Base64 fixture. Cookie replay succeeds after frontend reload; this does NOT prove restart-from-disk persistence. Existing Send/Cancel/Send cases remain.
- bun run check0 errors/warnings; bun tests/ui/unix-socket.js passes1790801156250 (9 wire requests total). Evidence artifacts/playwright/unix-socket-1790801156250/{acceptance,result}.json. Script/native/fixture exits0; no forced cleanup. No product edits or native rebuild; same accepted native-unix-socket-ui-probe used.
- NEXT cover remaining AF_UNIX streaming/protocol and signed/challenge-auth integration as warranted by original contract, and establish Unix target compilation/runtime. Raw unencoded URL fidelity and remaining full PARITY scope remain open; full migration not complete. No live build/process/server.

Reference: https://www.rfc-editor.org/rfc/rfc9110.html#name-redirection-3xx

## Native AF_UNIX SSE parsing and Disconnect accepted — 2026-10-01

- Previous goal turn made progress (native auth/cookie/redirect acceptance). Revalidated STATUS/PLAN/PARITY; inspected protocolFor/StreamPane and official WHATWG SSE interpretation before scenario extension.
- Extended existing tests/ui/unix-socket.js with SSE request and real AF_UNIX chunked event-stream fixture. Payload includes keepalive comment, id uds-1, event update and multiline Thai/ASCII data, divided into2-byte HTTP chunks crossing UTF-8 and field boundaries.
- Native UI Connect receives event; selected event body exactly equals Thai greeting plus newline second line; ID displayed, keepalive absent from event list. Wire verifies GET /sse, Accept:text/event-stream and Bearer. Disconnect results in peer EOF and UI leaves running state.
- bun run check0 errors/warnings; full extended native scenario passes1790801282297 (10 wire requests including previous Send/Cancel/auth/cookie/redirect cases). Evidence artifacts/playwright/unix-socket-1790801282297/{acceptance,result}.json. Script/app/fixture exits0, no forced cleanup. Existing accepted native build reused; no product changes or rebuild.
- NEXT investigate remaining platform acceptance (actual Unix cfg/runtime) and challenge/signed auth gaps against original contract. Current SSE evidence covers parsing/delivery/cancel, not reconnection/Last-Event-ID history or every streaming protocol. Raw URL fidelity and all other full PARITY scope remain open. No live processes/build/server.

Source: https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation

## Owned Linux runner established; reqwest Unix build running — 2026-10-01

- Previous goal turn made progress (native Windows SSE acceptance). Revalidated STATUS/PLAN/PARITY. Windows PATH lacks docker/podman; read-only WSL inspection discovered /usr/bin/docker in dockerman-backend. Docker daemon26.1.5 is operational. No toolchain installed into base distro; unrelated running container untouched.
- Consulted official Docker run/bind-mount docs and Rust official image page. Host rustc1.98.1; pulled matching rust:1.98.1-bookworm successfully. Immutable image rust@sha256:93ce27a88655056a51dbdd8f5f2d7ddc071c7b0070fb288a37b5a285fc83971e recorded artifacts/unix-socket-reference/linux-image.json.
- Created owned container insomnium-unix-acceptance-20261001 (ID ea7163baa47f7c4c8d81c18ef22ad9a965fe2567b81753bd81816d120e4f0485),2 CPUs/2GiB memory; /mnt/e/insomnium bound readonly at /work, CARGO_TARGET_DIR=/target. No published ports. Keeps sleep infinity while acceptance runs. Docker notes swap-limit unavailable; memory limit still applied.
- LIVE build handle linuxReqwestBuild PID28568, result linuxReqwestBuildResult:null and exitCode:null last direct poll. Command: wsl -d dockerman-backend --exec docker exec insomnium-unix-acceptance-20261001 cargo build --manifest-path /work/src-tauri/Cargo.toml -p reqwest@0.12.28 --locked. Continue polling same handle; do not restart on timeout.
- NEXT after build completion inspect result, compile stdin Unix variant of prior HTTP/TLS probe using /target/debug/deps in same container, run actual std::os::unix listener/client acceptance. Rust source via stdin avoids saved non-UI test script. Source is readonly; build caches stay inside owned container. Full Tauri Linux app compilation/runtime remains separate gate.
- Remove only this named owned container after evidence is extracted and acceptance finishes (or recorded terminal failure); never stop/prune unrelated resources. Windows regressions remain accepted, full migration open.

- https://docs.docker.com/engine/containers/run/
- https://docs.docker.com/engine/storage/bind-mounts/
- https://hub.docker.com/_/rust

## Linux Unix socket HTTP/TLS runtime accepted; full-app prerequisites installing — 2026-10-01

- Previous goal turn made progress (owned Linux runner) and verified build wait. Revalidated STATUS/PLAN/PARITY and same linuxReqwestBuild handle: terminal exit0. Compiled patched reqwest/Tokio/rustls libraries exist in /target/debug/deps.
- Adapted prior inline HTTP/TLS probes to std::os::unix::net and /tmp socket files; compiled Rust via stdin inside owned Linux container, no saved non-UI test script. Both compile/run exit0. Evidence artifacts/unix-socket-reference/linux-runtime.json.
- Real Linux HTTP: exact65536-byte POST/response, Host/Bearer, DNS/dead authenticated proxy bypass with no generated proxy headers, cookie/302 redirect/chunked stream and request deadline cleanup. TLS: trusted CA/SNI/hostname/exact peer certificate success; wrong hostname and unknown issuer rejected before HTTP. This proves cfg(unix) patched-client runtime, NOT full Tauri Linux application.
- Retaining owned insomnium-unix-acceptance-20261001 container for next full-app platform gate instead of removing/recreating it. Read-only source mount unchanged. Consulted https://v2.tauri.app/start/prerequisites/#linux.
- apt-get update in container passed. LIVE linuxDeps handle PID22552: apt-get install -y --no-install-recommends libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libclang-dev. DEBIAN_FRONTEND=noninteractive. First9 packages follow Tauri Debian docs; libclang needed by existing bindgen dependency. No packages installed into base WSL/Windows.
- NEXT poll same linuxDeps/linuxDepsResult; after success cargo check --manifest-path /work/src-tauri/Cargo.toml --locked (target /target, use low jobs/debug info if memory requires). If build needs generated source files, copy only required project subtree to owned container workspace rather than make host mount writable. Full Linux compile/runtime, installer/platform matrix and all remaining PARITY scope stay open.
- No native app/server running. Owned container and dependency installation are live; remove only owned container after full platform evidence extracted. Never prune unrelated resources.


</details>

<a id="record-user-agent"></a>

<details>
<summary>USER-AGENT</summary>

# User-Agent transport parity

## Native implicit User-Agent suppression — 2026-09-29

- transport.js now forwards suppressUserAgent from the rendered snapshot to the native HTTP envelope. Direct synchronous composition also recognizes a disabled literal User-Agent row, case-insensitively. Enabled explicit User-Agent rows remain in headers, including an empty value.
- HttpRequest adds a serde-defaulted suppress_user_agent boolean so older/internal envelopes remain compatible. build_client sets its implicit Insomnium agent only when suppression is false. Shared HTTP/SSE/WebSocket HTTP-client preparation receives the flag; gRPC has a separate transport and is unchanged.
- Browser preview rejects suppression without an enabled explicit User-Agent because browser-controlled headers cannot guarantee omission. Desktop dispatch remains native. Existing default identity/version unchanged.
- Read archived common/render.ts suppression computation and main/network/libcurl-promise.ts USERAGENT behavior. Consulted exact-version official docs before editing: https://docs.rs/reqwest/0.12.28/reqwest/struct.ClientBuilder.html#method.user_agent . No new subsystem/generator/dependency.
  -9 inline assertions passed using compiled workspace and built template workers/mocked send_http: no header, disabled mixed-case header, enabled custom header, disabled+enabled coexistence, explicit empty value, unrelated disabled header, direct composer, preview rejection and worker cleanup. No saved test files or real-user-state writes.
- Cargo fmt -- --check, cargo check --locked, cargo clippy --locked -- -D warnings, Svelte0/0, Vite build and git diff --check passed. Bun ran Prettier/svelte-check/Vite through hidden node_repl; Cargo launched directly with documented MSVC/SDK/CARGO_HOME/RUSTUP_HOME/LIBCLANG_PATH child environment. No installer rebuilt; source newer than BUILD.json.
- An archive search included generated source maps and hit its output buffer; narrowed evidence to original render.ts/libcurl-promise.ts. No code mutation failed.
- Native compiler/lint and frontend envelope checks do not prove on-wire omission/redirect/handshake behavior. Real WebView/native HTTP, SSE and WebSocket header acceptance remains pending. Next: rendered cookie snapshot/native jar parity, URL encoding, live SSE raw history, then runtime/UI/platform/packaging acceptance and remaining PARITY rows. Full migration incomplete.


</details>

<a id="record-websocket-rendering"></a>

<details>
<summary>WEBSOCKET-RENDERING</summary>

# WebSocket payload rendering

## WebSocket payload shared renderer — 2026-09-29

- sendPayload now snapshots payload/current collection environment and renders text/JSON/ping with the shared Send session and dependent-response adapter. Binary Base64 remains literal. JSON is validated after rendering. Request URL/auth/body are not rerendered for subsequent messages.
- Each payload operation captures its connection ID, follows its AbortSignal and rechecks matching active/open response/run and resource existence before dispatch. Replaced/closed connections never receive a late rendered message. One payload operation per request is allowed; operation completion participates in shutdown. Payload/environment edits after clicking Send use the captured snapshot; deletion/connection replacement cancels dispatch.
- Native closed events and execute finalization abort the connection owner to release pending prompt/render/dependency work. Existing native message format/size handling is unchanged.
  -22 inline assertions passed:11 compiled payload cases (text/JSON/binary/ping, prompt, duplicate-send guard, Stop, replacement connection, dependency and cleanup),5 actual execute/mocked-native close/shutdown cases,6 dependent OAuth cancellation regressions. Svelte0/0, Vite build and git diff --check passed. No saved test files/dependencies/native edits/installer; workers0, no real-user-state writes.
- Consulted official Tauri channels and MDN AbortController.abort plus archived main/network/websocket.ts and ui/components/websockets/websocket-request-pane.tsx interpolation/send sequence. A guessed archive path was absent and an rg expression had an unmatched parenthesis; located actual file and reran search. No source edit failures.
- Real WebView/Rust WebSocket wire acceptance remains pending; mocked IPC proves frontend ownership only. Automatic connect-and-send behavior from the archive and advanced stream parity still need reconciliation. Next: gRPC discovery/send/client-stream message renderer, streaming dependency completion, native cookie/User-Agent/URL parity and full PARITY acceptance. Full migration incomplete; source newer than BUILD.json.

Official references consulted before implementation:

- https://v2.tauri.app/develop/calling-rust/#channels
- https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort

Commands: Bun directly runs Prettier on request-render.js/workspace.svelte.js; svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings; vite build. git diff --check passes. All program launches use node_repl execFile(shell:false,windowsHide:true); no new generator required for existing renderer integration.

## WebSocket automatic connect-and-send — 2026-09-29

- sendPayload now starts a WebSocket connection when idle. Captures the selected payload at click time, reserves the message operation and tracks its completion for shutdown. An already preparing connection rejects a second Send; an open connection retains the existing message path.
- execute accepts an internal initial-payload operation. Renders the payload before URL/headers/auth preparation, matching archived websocket-request-pane.tsx interpolateOpenAndSend. JSON is validated before handshake; binary stays literal. It uses the shared Send renderer and dependency resolver with the connection owner's cancellation signal.
- Initial payload dispatch happens once on the owning open event. Checks cancellation and payload existence before dispatch; duplicate open events do not resend. Stop, failed handshake, closed connection or missing/deleted payload settle the waiting UI action. Native send acknowledgement resolves Send without waiting for connection closure. Message operation participates in shutdown completion.
- WebSocketMessageEditor enables the idle action as Connect and send and retains Send message for an open connection. Pending connection/message actions stay disabled; manual Connect still opens without sending.
- 28 inline assertions passed:12 compiled Svelte/mocked-native initial-message cases (wait for open, overlap guard, click snapshot, duplicate open, existing send, prompt before handshake, Stop and cleanup, invalid JSON, handshake failure, deleted payload, no leaked runs/workers),11 existing payload regressions and5 connection-close/shutdown regressions. No saved test scripts, real-user-state writes or active fixture workers.
- Svelte0 errors/0 warnings, Vite production build and git diff --check passed. No native edits/dependencies/new installer; source newer than BUILD.json. Commands: Bun directly launches Prettier, svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings and vite build; git diff --check, all via hidden node_repl execFile shell:false/windowsHide:true.
- Official docs consulted before editing: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send and https://v2.tauri.app/develop/calling-rust/#channels . Inspected archived interpolateOpenAndSend and native streaming.rs sender registration before open-event delivery. No generator needed for this existing subsystem.
- Mocked IPC proves frontend ordering/ownership only. Real WebView/Rust WebSocket send/close/provider/UI acceptance remains pending. Next: reconcile live SSE raw history, native cookie/User-Agent/URL parity, then runtime/UI/platform/packaging acceptance and every remaining PARITY row. Full migration incomplete.


</details>

## Current genuine renderer-host suspension

### Genuine renderer and host suspension — verified bounded milestone 2026-10-15

Eight actual Windows native UI cases pass: SSE/WebSocket × owned renderer/host ×5/35seconds. Kernel process image/birth and ancestry/profile guards retain handles; thread snapshots reach a fixed point, verify suspend counts and balance only owned increments. All handles close, watchdogs remain inactive. Renderer CDP evaluation stays pending until resume; host-only suspension permits renderer evaluation. Long renderer peer closures occur30.006seconds(SSE)/30.003seconds(WebSocket) after send, before resume. Short renderer and both host durations recover both messages. Exact durable history reload and earlier-run stability pass. SSE timeout preserves ready parsed event plus observed raw bytes; WebSocket timeout delivered both packets in this run, without a universal unacknowledged-delivery guarantee.

Source/application remainsb2bd65d; executableSHAcea47a30867bd85a2caf7db977dd0246c3fcc95852a2d00d352cb7ae824b7171/originalmanifest7b71e8d393b18cf73ea24dc106bbd621475aeb672edf6018af759f75b555c050 unchanged. Suite17277 exits0: suspension1792058964507=8/SSE1792059149273=8/WS1792059166540=6/mixed1792059178063=5. Hosts47456/24336/30176/56368 exit0/native-hidden; four original profile buffers restore exactly. Declared6test/5doc supplement closes1401source/1310regular files and every other scope. acceptance-audit-stream-suspension-v2.json independently checks original manifest/executable, exact closure, all receipts/profile hashes and every owned suspend/resume increment. Artifacts: artifacts/native-resource-crud-audit-probe/sse-exact-retention-attempt-1/.

V1session64566 fails before any thread call: exact profile guard expected the parent folder. Failed receipt1792058800661 is preserved, host56240 exits0/profile restores. V2 binds the real WebView2 webview-profile/EBWebView path exactly and retains diagnostic command lines before guarding; no ownership assertion weakened. No application edit. Strict3-file JS/format checks pass. No live owned process/profile/thread handles remain. Next queued-send/close-edge ACK/backpressure, further size/mixed/provider/platform and all retained PLAN/PARITY requirements. Full migration incomplete; UX deferred. This interface cannot invoke /compact; this is the explicit feature handoff.


Official references consulted before implementation: [SuspendThread](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-suspendthread), [ResumeThread](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-resumethread), [GetProcessIdOfThread](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocessidofthread), [ToolHelp snapshot](https://learn.microsoft.com/en-us/windows/win32/api/tlhelp32/nf-tlhelp32-createtoolhelp32snapshot), [THREADENTRY32](https://learn.microsoft.com/en-us/windows/win32/api/tlhelp32/ns-tlhelp32-threadentry32) and [WebView2 user-data folder](https://github.com/MicrosoftDocs/edge-developer/blob/main/microsoft-edge/webview2/concepts/user-data-folder.md). This fault injection does not prove physical TCP shutdown, OS-close, arbitrary provider or other-platform acceptance.

## Current WebSocket queued-send and close-edge acceptance

### WebSocket queued sends and peer-close barrier — verified bounded milestone 2026-10-15

Extended the existing separate real SDK Channel receiver with owned nonblocking send-result records; application IPC/callbacks remain untouched. Three new groups pass in addition to the original four: while incoming ACK is held,20text send invocations produce16pending/4queue-full refusals with0peer messages; release drains exactly16successful payloads with exact peer membership, while cancellation rejects all16pending sends as disconnected before sending with0peer messages. Peer close while one message is held does not finish early: matching message ACK allows Closed/Finished, and Finished itself remains held until release. Concurrent IPC submission order is not asserted; this proves exact accepted membership, not a universal authored-order guarantee.

Suite43267 exits0: ACK1792059516328=7/SSE1792059580614=8/WS1792059597033=6/mixed1792059608266=5. Hosts43652/55328/54516/4188 exit0/native-hidden; exact4original profile buffers restore. Original appb2bd65d/exeSHAcea47a30/originalmanifest7b71e8d3 unchanged. Explicit6test/5doc supplement closes1401source/1310regular rows and all other scopes; acceptance-audit-websocket-queue.json independently checks receipts, source/build identity, queue results and profile hashes. Artifacts: artifacts/native-resource-crud-audit-probe/sse-exact-retention-attempt-1/. Strict3-file JS/Prettier/diff checks pass. No application change or live owned handles. Next missing-ACK timeout with queued sends, additional peer-close/send races, binary/control/size/provider/platform variants and all remaining PLAN/PARITY. Full migration incomplete; UX deferred. /compact is unavailable; this is the explicit handoff.

Official sources consulted: [Tokio try_send](https://docs.rs/tokio/latest/tokio/sync/mpsc/struct.Sender.html#method.try_send) and [Tauri Channels](https://v2.tauri.app/develop/calling-rust/#channels). These bounded loopback Windows cases do not establish physicalTCP/OS-close, all close races, queued timeout, provider or other-platform acceptance.

## Current queued WebSocket timeout acceptance

### WebSocket queued-send ACK timeout — verified bounded milestone 2026-10-15

Two added real SDK Channel/native groups pass: held inbound ACK with a full16-entry send queue, both with peer still open and after peer-initiated Close. Twenty concurrent text submissions yield4queue-full refusals and16pending sends; at the single ACK deadline all16reject as disconnected before sending,0succeed/0reach peer. Timings30.017/30.013seconds; one sequenced packet only, no second Finished timeout. Subsequent sends refuse WebSocket is not connected; late matching ACK produces no additional packets. These are exact bounded outcomes, not all close/send race or physicalTCP/OS-close acceptance.

Suite37877 exits0: ACK1792059850925=9/SSE1792059975895=8/WS1792059992673=6/mixed1792060004230=5. Hosts52680/54668/56244/50848 exit0/native-hidden; four original profiles restore exactly. Original applicationb2bd65d/exeSHAcea47a30/manifest7b71e8d3 unchanged; declared6test/5doc supplement closes1401source/1310regular rows plus all other scopes. acceptance-audit-websocket-queue-timeout.json validates source/manifest/executable, all receipts/profile hashes and exact rebuilt receiver bundle. Artifacts: artifacts/native-resource-crud-audit-probe/sse-exact-retention-attempt-1/. Strict3-file JS, scenario formatting and diff checks pass. No application edits or live owned handles. Next binary/control-frame and exact-size/oversized WebSocket/gRPC variants, remaining mixed environment/lifecycle/provider/platform and all PLAN/PARITY. Full migration incomplete; UX deferred. /compact unavailable; explicit handoff.

Official reference: [Tokio bounded try_send](https://docs.rs/tokio/latest/tokio/sync/mpsc/struct.Sender.html#method.try_send). Existing native delivery timeout and16-slot queue are unchanged.

## Current outgoing WebSocket size and control guards

### WebSocket outgoing size/control guards — verified bounded milestone 2026-10-15

Real native SDK Channel group passes UTF8 ping125bytes (62β plus a) with exact peer bytes;126bytes refused with no second ping. ASCII and UTF8 text each20971521bytes, and binary decoded20971521bytes/base6427962028bytes, refuse the20MiB guard with0data messages at peer. Invalid Base64 reports Invalid symbol37, offset0; unknown format reports Unsupported WebSocket message type. A valid3byte binary AP+A then reaches peer and returns through the real Channel, proving the same connection remains usable. No application edits. Exact20MiB success, incoming oversized/fragmentation, complete control-frame and gRPC variants remain unverified by this group.

Suite20361 exits0: ACK1792060247455=10/SSE1792060389056=8/WS1792060405301=6/mixed1792060416317=5. Hosts57644/59852/58928/51528 exit0/native-hidden; exact4original profiles restore. Original appb2bd65d/exeSHAcea47a30/manifest7b71e8d3 unchanged. Declared6test/5doc supplement closes1401source/1310regular rows/all other scopes. acceptance-audit-websocket-send-limits.json checks original manifest/executable, source closure, all receipts/profile hashes, guard bytes and exact rebuilt receiver bundle. Artifacts: artifacts/native-resource-crud-audit-probe/sse-exact-retention-attempt-1/. Strict3-file JS/format checks pass. No live owned handles. Next exact20MiB accepted send/receive, incoming oversize/fragmentation and gRPC plus remaining PLAN/PARITY. Full migration incomplete; UX deferred. /compact unavailable; explicit handoff.

Official control-frame reference consulted: [RFC6455 section5.5](https://datatracker.ietf.org/doc/html/rfc6455#section-5.5). Earlier rfc-editor fetch timed out; IETF copy was read. Application20MiB data limit is a local contract, separate from the RFC125byte control-frame limit.

## Current exact WebSocket transport boundaries

### WebSocket exact20MiB transport boundary — verified bounded milestone 2026-10-15

Four real SDK Channel/native groups pass: UTF8 text (10MiB β characters) and binary (20MiB0xa5) each20971520decoded bytes send to independent peer and echo through the native Channel. Authored bytes, peer capture and both sent/received Channel events have identical independently recomputed SHA256. Incoming text/binary20971521bytes each end with WebSocket failed: tungstenite error; only the earlier ready message reaches Channel. The current error hides the specific capacity cause, so no precise size diagnostic is claimed. Fixture opts into24MiB receive/64MiB backpressure only for these ACK cases; other callers retain defaults. Large payloads traverse the actual Channel; the receiver hashes them locally after delivery and receipts compact peer data to size/SHA256.

Suite9490 exits0: ACK1792060679503=14/SSE1792060851046=8/WS1792060867876=6/mixed1792060879560=5. Hosts45088/51828/41672/56612 exit0/native-hidden; exact4original profiles restore. Original appb2bd65d/exeSHAcea47a30/manifest7b71e8d3 unchanged; declared7test/5doc supplement closes1401source/1310regular files/all other scopes. acceptance-audit-websocket-exact20.json checks source/build/receipts/profiles, independently reconstructed20MiB hashes and exact rebuilt SDK bundle. Artifacts: artifacts/native-resource-crud-audit-probe/sse-exact-retention-attempt-1/. Strict4-file JS/Prettier checks pass. No application edit/live handles. Next actual application large WS rendering/history/reload/retention, explicit fragmented/control-frame variants and gRPC, plus remaining PLAN/PARITY. Full migration incomplete; UX deferred. /compact unavailable; explicit handoff.

Official fixture options consulted: [Bun WebSocket limits/backpressure](https://bun.sh/docs/runtime/http/websockets). Exact20MiB transport success does not establish application UI history retention, fragmented frames, all control frames, physicalTCP/OS-close or other-platform/provider acceptance.

## Current large stream UI correction

### Large stream UI preview and full history — verified bounded milestone 2026-10-15

Fixed StreamPane rendering the full large payload twice in DOM. List summaries now show at most512UTF16 units plus ellipsis; selected detail shows at most65536units, avoiding split surrogate pairs and skipping full-data formatting when truncated. A visible preview notice points to Copy/Save. Full event data, native transport, history, Copy and Save sources remain unchanged. This is a rendering bound, not payload truncation or a layout redesign.

Actual native UI3cases pass:20MiB UTF8 text and20MiB binary mount bounded previews before EOF, retain exact full payload/hash through Closed/late callbacks/reload/selection, and preserve original histories;9MiB payload replaced by a small message returns under8MiB. Each test request is deleted through actual UI and cannot resurrect after reload. Full Copy/Save of these20MiB messages was not separately exercised; existing code paths continue to use selected.data. Explicit fragmented/control frames, outgoing editor large payloads, gRPC and broader provider/platform remain required.

Baseline actual UI receipt1792061279360 stalls first DOM query for over4minutes; owned renderer59128 records243CPU seconds/1.04GB working set. Only exact host54504/path/parent41480/start17:47:59 was force-stopped for diagnostic recovery (exit255, failed evidence); profile1792061279131 restores exact originals and failed suite82094 closes sources. Initial8759 rejected stale prior-doc hashes before launch; v2 refreshed exact declared docs and did not weaken guards. Prior candidate sse-exact-retention-attempt-1 retains both failures/source snapshots/ownership proof. No clean-close claim for forced baseline.

Fresh candidate websocket-large-ui-attempt-1 build65298 exits0/Rust7m25, exeSHA61215395b6c266044e443485ba37600d4408518a802b700e0783844a06fae01c, manifestSHA3db462bb403097895fef04c3a7fac92904af1ff4ab16a5cedfac774205277fe9. Continuation18771 exits0: largeUI1792062383121=3 (19.082seconds total), SSEexact1792062407866=6, SSE1792062467073=8, WS1792062484568=6, mixed1792062496003=5. Hosts55812/56580/54952/54680/55836 exit0/native-hidden; all5profiles restore originalf0b51/d8b032 buffers. Original1403source/1312regular rows and other source/package/private/tool/asset scopes close with0overrides. acceptance-audit-websocket-large-history-v2.json independently reconstructs payload hashes and checks receipts/build/closure/profiles. Compiler55445 passes0/0; frontend build, strict targeted JS/format and saved headless SSE raw history pass. No live build/native/profile handles. Full migration incomplete; UX deferred. Next explicit fragmentation/control-frame variants, full large-event export and gRPC plus remaining PLAN/PARITY. /compact unavailable; explicit handoff.

Official references consulted before correction: [Svelte derived state](https://svelte.dev/docs/svelte/$derived), [Bun WebSocket fixture limits](https://bun.sh/docs/runtime/http/websockets). The bounded preview preserves complete durable payloads; generic incoming tungstenite errors and broad platform/physicalTCP/OS-close requirements remain separate.

## Current full large WebSocket export

### Full large WebSocket event export — verified bounded milestone 2026-10-15

Actual Save stream event/native owned dialogs now verify20MiB UTF8 text and binary before and after reload: four new.bin files each20971520bytes with SHA256 identical to independently offered payloads. Preview remains bounded; complete saved content is preserved. Cancel is exercised before each first Save, then the scenario waits until inspectOwnedDialogs confirms no owned dialog before starting another Save. Clipboard Copy remains unverified for these20MiB payloads.

Initial91693/receipt1792062752218 fails missing export after back-to-back Cancel/Save; helper returns immediately after posting Cancel, so old-dialog selection was possible. Host42760 exits0/native-hidden/profile1792062751993 restores; failed closure remains exact. V2 adds an explicit owned-dialog disappearance barrier without changing production/helper ownership guards. Suite53647 exits0: largeUI1792062909484=3/SSEexact1792062948093=6/SSE1792062999669=8/WS1792063015941=6/mixed1792063026984=5. Hosts35348/53636/56444/28896/59620 exit0/native-hidden, exact5original profiles restored. Unchanged app3ecce5a/exe61215395/originalmanifest3db462bb with declared1scenario/5doc supplement closes1403source/1312regular rows/all other scopes. audit-large-export-v2.mjs reads/hashes all four actual files and validates original manifest/exe/receipts/closure/profile hashes. Artifacts: artifacts/native-resource-crud-audit-probe/websocket-large-ui-attempt-1/. Strict targeted JS/Prettier checks pass. No live handles. Next explicit fragmentation/control frames, large Clipboard Copy and gRPC plus all remaining PLAN/PARITY. Full migration incomplete; /compact unavailable, explicit handoff.

## Current explicit WebSocket frame acceptance

### Explicit WebSocket fragmentation/control frames — verified bounded milestone 2026-10-15

Eight small actual RFC6455 sequences pass through a separate real SDK Channel: text split inside a multibyte UTF8 code point, fragmented binary,125byte ping interleaved before final continuation with exact masked client pong, fragmented ping refusal,126byte ping refusal, unexpected continuation refusal, new data opcode inside fragmented message refusal, and invalid UTF8 across continuations refusal. No partial text/binary event precedes final continuation; valid messages arrive exactly once. Five invalid cases retire with generic WebSocket failed: tungstenite error and0data payloads; specific diagnostics are not claimed. Raw loopback peer authors FIN/opcodes/payloads explicitly, validates client masking, bounded handshake/control reads and exact small writes, and records frame bytes. It does not intercept app callbacks/IPC. This closes no aggregate20MiB fragmented, broad control-frame, application-history, physicalTCP/OS-close/provider/platform gate.

Suite66425 exits0: frames1792063362453=8/SSEexact1792063371570=6/SSE1792063431474=8/WS1792063447852=6/mixed1792063459241=5. Hosts58292/56972/57000/58568/42600 exit0/native-hidden; exact5original profiles restore. Raw fixture8connections/8closures, no forced retirement/errors. Unchanged app3ecce5a/exe61215395/manifest3db462bb with declared4test/5doc supplement closes1406source/1315regular rows/all other scopes. audit-frames.mjs validates original manifest/executable, exact declared deltas, sources/receipts/profiles, sent frame headers/payload bytes/client masking/exact pong and rebuilt SDK bundle. Artifacts: artifacts/native-resource-crud-audit-probe/websocket-large-ui-attempt-1/. Strict3-file JS/format pass after adding explicit buffer/scalar types and optional socket-error code annotation. No live handles. Next aggregate large fragmented messages, broader control/close cases, large Clipboard Copy and gRPC plus every remaining PLAN/PARITY. Full migration incomplete; /compact unavailable, explicit handoff.

Official references consulted: [RFC6455 fragmentation/control frames](https://datatracker.ietf.org/doc/html/rfc6455#section-5.4) and [Bun TCP listener](https://bun.sh/docs/runtime/networking/tcp).

## Current aggregate WebSocket fragmentation boundary

### Aggregate WebSocket fragmentation boundary — verified bounded milestone 2026-10-15

Four added real Channel cases pass: UTF8 text/binary aggregate20971520bytes reassemble once with independently recomputed full hashes; aggregate20971521bytes each refuse with0partial/full data payloads. Every authored data frame is<=32767bytes (641frames/message); text fragments cross UTF8 code-point boundaries. Before final continuation, an interleaved125byte ping/exact masked pong proves native read all prefix frames while no text/binary payload or completed invocation is visible. Native still emits only generic tungstenite error for refused aggregates; no precise diagnostic is claimed. Fixture handles partial TCP writes with retained offsets/liveness/deadlines, compacts large frame evidence to header/payload/wire hashes, and keeps prior small-frame receipts unchanged. No production edit.

Suite65860 exits0: frames1792063764660=12/SSEexact1792063782027=6/SSE1792063832890=8/WS1792063848994=6/mixed1792063860016=5. Hosts20356/57048/58156/39636/51640 exit0/native-hidden; exact5original profiles restore. Raw fixture12connections/12closures without forced retirement/errors. Unchanged app3ecce5a/exe61215395/manifest3db462bb; declared4test/5doc supplement closes1406source/1315regular rows/all other scopes. audit-aggregate.mjs independently reconstructs every data frame/header/wire hash, aggregate bytes/hash, prefix pong and complete/refused packet counts, original source/build/receipt/profile closure and exact rebuilt SDK bundle. Artifacts: artifacts/native-resource-crud-audit-probe/websocket-large-ui-attempt-1/. Strict3-file JS/format pass. No live handles. Next broader control/close/fragmented application-history/provider/platform, large Clipboard Copy and gRPC plus all remaining PLAN/PARITY. Full migration incomplete; /compact unavailable, explicit handoff.

Official references consulted: [RFC6455 fragmentation and limits](https://datatracker.ietf.org/doc/html/rfc6455#section-10.4), [Bun TCP partial writes](https://bun.sh/docs/runtime/networking/tcp#buffering). No physicalTCP/OS-close, all fragmentation patterns or other-platform guarantee is inferred.

## Complete WebSocket/SSE event reader — 2026-10-16

Large events retain the64KiB preview and offer Open complete stream event. Shared MessageReader.svelte presents an exact captured string in read-only CodeEditor inside a bounded-height DialogShell, with editor preferences, navigation/search and Escape dismissal. New history/connection identity clears the reader; subsequent events do not replace its captured text. Copy/Save and original history remain unchanged. Binary/control payloads keep their existing stored representation; no decoding behavior changes.

Saved headless tests/ui/stream-message-reader.js passes SSE and WebSocket exact complete Unicode text, attempted typing without mutation, Ctrl+End reaching the actual tail, Escape and unchanged history. Receipts artifacts/playwright/stream-message-reader-{sse,websocket}/result.json. Existing grpc-history-app regression passes the extracted reader too. Final build/check43741exit0/0errors/0warnings and scoped diff pass after nullable-selection typing correction. Native wire/WebView/binary/larger20MiB performance/provider/platform and original broader gates remain open. No native rebuild or live handles; no full-migration claim.

## URL-encoded Content-Type precedence — 2026-10-16

The URL-encoded sender now adds its default Content-Type only when no enabled rendered header with that name exists. Explicit mixed-case/custom/charset/empty values remain authoritative; disabled headers still allow the default. Form serialization is unchanged. This also preserves HAR postData MIME charset metadata through actual preparation. Multipart retains its existing native-boundary path.

Reference: https://learning.postman.com/docs/use/send-requests/create-requests/parameters/ (manual Content-Type precedence). Inline Bun exercises actual prepareRequest and prepareRenderedRequest across5header/default/disabled controls, asserting exact header cardinality/value and unchanged field=a+b body, plus HAR charset import-to-preparation. All pass. Build/check60782exit0/0errors/0warnings and scoped diff pass. No new scripts or repeated UI matrices; native/wire/provider/platform and original broader gates remain open. No live handles.


## Stream transfer feedback ownership — 2026-10-16

Shared SSE/WebSocket StreamPane now binds Copy event, Save event, Export raw and Export log failures to the captured response/event/tab/data generation and newest transfer operation. Selection/history changes, newer operations and unmount suppress stale results; current-owner failures remain visible. Existing network/raw-capture errors stay independent. Payload selection and exact binary/raw export paths are unchanged.

Existing sse-raw-history now defers clipboard failure, changes history and checks suppression, then verifies a same-owner failure is visible. Clipboard override is restored. Original UTF8 framing/BOM/raw complete+partial Save/reload/unchanged history assertions remain and the maintained script exits0 in~3.04s. Receipt artifacts/playwright/sse-raw-history/result.json. Final compiler92924 exits0/0errors/0warnings; build exits0. Initial inline edit had a duplicate declaration and refused before writes, then was corrected. No new test/artifact scripts/dependencies/native build/profile changes or owned live handles. This exercises SSE/browser history with controlled clipboard failure; WebSocket/native clipboard/file-dialog races/provider/platform and full migration remain open. /compact unavailable.


Stream history event selection (source parent 21580751): changing the response identity now clears StreamPane selectedId as well as the complete-message dialog. The next history starts at its latest event rather than accidentally reusing an equal event ID from the prior history; same-response event arrivals do not trigger this reset. Existing SSE raw-history scenario adds one separate seeded two-event history with a colliding first ID and asserts that its last event is displayed, then restores the original flow. Original raw Save/reload/unchanged history and deferred clipboard assertions pass; script exits0 in~3.00s. Compiler92385 exits0/0errors/0warnings; build exits0. No new scripts/dependencies/native build/profile/live handles. This is controlled browser history evidence, not native/provider/platform acceptance. Custom plugin request hooks still require request context and pre-transport integration per the existing PLUGINS contract; no hook scaffold/integration claim was added. Full migration remains open. /compact unavailable.
