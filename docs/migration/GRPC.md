# gRPC migration

Saved proto sources and reflection support unary, server/client/bidirectional calls, metadata, TLS and persisted histories. [PARITY.md](PARITY.md) retains the complete acceptance scope; implementation and bounded receipts do not establish full compatibility.

## Native contract

- `load_grpc_schema` accepts an explicit relative proto tree or reflection connection and returns descriptors, method paths/types/stream flags and examples. Invalid examples report `exampleError` without hiding methods. Discovery/worker registration retains cancellation and drain ownership.
- `connect_grpc` captures method/descriptors/JSON mode/connection configuration. Unary/server streams send one body then close their sending side. Client/bidi streams use `send_grpc_message` and explicit Commit EOF. Cancellation and owner changes retire the correct call.
- Tauri Channel events carry sequences acknowledged through `acknowledge_grpc`; ACK timeout is 30 seconds, outbound capacity one. Terminal publication, worker retirement and renderer ACK drains retain separate ownership.
- Metadata permits 128 rows/256 KiB, valid gRPC names and printable ASCII text. Protocol overrides are rejected. Binary metadata uses Base64; status details remain separate from message content.
- Received status messages use grpc-js `decodeURI`, preserving reserved escapes and returning the whole raw message on malformed escapes/UTF-8 without changing status code. Binary details use the shared tolerant Base64 decoder without panic; empty/repeated headers remain metadata without duplication. Trailers-only responses emit no initial metadata; OK trailers exclude grpc-status/grpc-message, which stay in separate status fields. The opt-in Tonic feature covers OK/error and reflection/retry decoding. Existing regressions (2 tests, 5 original wire shapes), all-targets compiler and scoped format checks pass; receipt: `artifacts/grpc-status-delivery-verification-20261022.json`. Full malformed-wire/native/platform acceptance remains open.
- Receive metadata follows grpc-js key/text admission and keeps each key's valid value prefix before its first invalid value. Invalid status text is removed before Number conversion; Unicode whitespace cannot fabricate OK. The old message/binary-details pre-decoders were removed: initial grpc-message stays raw and repeated binary details reach the shared decoder intact. Existing Number normalization already handles legal `00`/`007`; no new parser was introduced. Actual pinned Metadata API reference, the same two Rust tests/12 wire paths with stronger existing controls, Windows/Linux all-targets compiler and scoped format pass: `artifacts/grpc-metadata-admission-verification-20261022.json`. No files/functions/wire cases added. Eight Linux inputs match before/after; container stopped. Native/platform/package/legal acceptance remains open.
- Receive boundaries follow grpc-js: initial `grpc-status` remains metadata until END_STREAM, and a declared message length above20MiB returns RESOURCE_EXHAUSTED with the peer/limit sizes before reserving a payload buffer. The opt-in Tonic reader waits for real trailers; an internal extension preserves the actual trailers-only boundary for application delivery. Initial status7 previously returned premature PERMISSION_DENIED/no body; the existing success path now preserves body/metadata/final OK. Initial-status evidence: `artifacts/grpc-initial-status-verification-20261022.json`. The same two tests now cover13 wire paths, retaining all12 and adding one five-byte declared-overflow header; Windows all-targets check and scoped format pass. Actual pinned StreamDecoder reference and final proof: `artifacts/grpc-receive-limit-verification-20261022.json`. Linux all-targets release/locked/offline compiler also passes on source `053acaa0`;11 native inputs and exact source archive match before/after, no-mount container stopped/PID0. Evidence: `artifacts/grpc-receive-linux-20261022/verification.json`; cached resources are compiler-only. No new test files/functions or UI matrix. Native UI, Linux runtime and broader malformed-wire/platform acceptance remain open.
- Reflection supports v1/v1alpha fallback, correlated queries, transitive dependencies, duplicate/service validation and per-service source scopes.
- Missing grpc-status follows grpc-js HTTP fallback codes/messages and retains trailer metadata; clean EOF maps separately to INTERNAL. END_STREAM headers do not commit retries as initial metadata. Declared frame-size errors on non-200 responses prefer the HTTP error; decompression and protobuf deserialization remain separate. Existing status regressions pass (2 tests, 5 retained wire shapes plus 4 missing-status paths), along with all-targets compiler/formatting: `artifacts/grpc-missing-status-verification-20261022.json`. Hyper-discarded reset reasons and broader native/platform acceptance remain open.
- Received compression follows grpc-js's exact flag1 test; other flags carry raw bytes. Corrupt deflate/gzip returns INTERNAL with codec-specific details, and decompressed overflow returns RESOURCE_EXHAUSTED while retaining the20MiB bounded output. HTTP fallback no longer masks these compression errors. Actual pinned compression-filter API verifies four reference results; the existing two Rust tests retain13 paths and add three distinct corrupt-codec/decoded-overflow paths, with flag2 in the original success path and HTTP503 in the corrupt-deflate path. Windows/Linux all-targets and scoped format pass;10 Linux inputs/archives stay exact and the container is stopped. Evidence: `artifacts/grpc-compression-status-verification-20261022.json`. No new test files/functions or UI matrix. Native UI, compression-header admission/truncation and complete wire/platform acceptance remain open.
- Exposed peer RST_STREAM and h2 transport I/O failures use grpc-js's status/message mapping in channel-only builds, through direct and Hyper-wrapped error chains. Local/library protocol errors and GOAWAY keep existing handling; clean EOF retains its separate fallback. Two existing Rust tests cover 12 wire paths: nine original paths, two peer resets and TCP drop after the actual metadata callback without status/trailers/RST_STREAM. TCP drop previously returned UNKNOWN; it now returns UNAVAILABLE/Connection dropped. No timing wait, new files/functions or UI matrix added. Hyper 1.12.0 preserves CANCEL; NO_ERROR-to-EOF uses the existing fallback, so no Hyper patch is needed. Windows all-targets and Linux all-targets release/locked/offline compiler pass; seven Linux inputs/archive hashes match before/after and the no-mount container is stopped. Evidence: `artifacts/grpc-connection-drop-verification-20261022.json`; prior reset proof: `artifacts/grpc-body-reset-verification-20261022.json`. Regenerated notices retain incomplete coverage/unproven linkage. Simultaneous reset/drop callback precedence and further native/platform acceptance remain open.
- Prior Linux all-targets release compiler evidence: `artifacts/grpc-current-linux-20261022/verification.json`, source `6a8ab48f`, canonical native hashes unchanged before/after, container stopped. It predates the exposed-reset correction. Cached build resources do not prove runtime/package/linkage/legal acceptance.
- Limits: 256 source files/include directories, 2 MiB per file/8 MiB source total, 8 MiB descriptors/method descriptions, 4096 methods; reflection has 1024 services/files and 4096 queries. Wire/rendered JSON messages are limited to 20 MiB, nesting to 64.
- Native Rust handles transport without a Node gRPC sidecar. DNS, CONNECT/proxy, Unix/named-pipe, service config/cache/routing, retry/hedging, weighted/outlier/ORCA behavior and remaining acceptance are specified in [GRPC-SERVICE-CONFIG.md](GRPC-SERVICE-CONFIG.md). Call deadlines are independent of schema/connection timeouts. Request/global TLS validation and CA/client identity follow [TLS.md](TLS.md).

## Schema and JSON behavior

- Default Legacy preserves protobuf.js 7.2.4/Long 5.3.2 profiles. Saved-file and reflected schemas have separate conversion/output semantics: names/defaults/coercions, enum/long/oneof output, maps, Any/WKT lookup and proto2 extensions follow the applicable profile.
- Explicit ProtoJSON uses standard prost-reflect parsing/WKT/Base64 rules and rejects unknown input fields. Mode changes do not rewrite saved bodies.
- Common definitions/JSON declarations are pinned in `src-tauri/vendor/protobufjs-google`, with license/provenance resources. Common precedence, import/include aliases, global source visibility and filtered lookup retain source ownership. Declaration/prototype guards remain source-specific. Resource mapping does not prove installed-package/legal acceptance.
- Request conversion retains authored numeric/string/bytes semantics; nondeterministic or unwritten legacy writer bytes are refused explicitly. Private conversion views do not modify original descriptor pools.
- Legacy responses share one cursor across the whole buffer. Nested/packed lengths control iteration; primitive reads check actual buffer availability. The reader handles 32/64-bit varints, fixed-width values, string clamping, unknown-field skipping and groups.
- Original metadata distinguishes private string-as-bytes and widened int32 map keys. Each message occurrence validates required fields before replacement; singular messages replace, repeated fields append. JSON serialization restores original field/profile semantics.
- Saved-file map entries with omitted enum/bytes values initialize to `0`/`[]`; explicit empty bytes retain `{}`. Reflection options `{}` omit absent entry values. Pinned reference: `artifacts/grpc-map-value-default-reference-20261022.json`; all 54 existing legacy regressions pass in `artifacts/grpc-map-value-default-regression-20261022-final.log`.
- Examples traverse original/private nested/list/map/extension fields. Failed examples stay explicit and must not hide discovery results.

## UI and ownership

- Preserve URL/proto/method selection, request/response tabs, package/method groups, all four RPC controls, sent-message tabs, metadata/trailers and history in the existing layout.
- Proto import is additive and reviewed. Replace/refresh/delete retain IDs, source ownership, validation generations and active consumers; deletion review includes templated selectors. A resource reference does not authorize arbitrary filesystem/network imports.
- Editors/templates, chooser/format/Copy/Save feedback, discovery/preparation and active calls retain their workspace/resource/source owners. Presentation changes do not replace a running call's captured context.
- Previews are bounded and surrogate-safe. Complete authored/request/response values remain available for history, Copy/Save and reload; read-only history stays separate from request editing.

## Evidence and remaining acceptance

- Response-reader evidence: `artifacts/grpc-response-cursor-verification-20261022.json` records 54 existing regressions and Windows/Linux all-targets checks. Two existing fixture lengths changed; expected outputs/assertions did not.
- Windows native integration on source `a0cd3b60`: `artifacts/native-grpc-compression-20261022/verification.json`. Normal-hook production release/no-bundle build and the same95 gRPC cases pass (43 unary/TLS,7 streaming,45 reflection). The existing fixture sends raw flag2 for unary/server/client/reflection responses while duplex retains flag0; the independent HTTP2 control asserts exact2. Initial status7 remains metadata and native UI/IPC receives bodies/final success/reflection results. No cases/files added. Native-hidden host exits0 without force; settings/full profile restore exactly and all1,718 tracked inputs stay unchanged through gRPC. The same binary also passes runner timer/WM_CLOSE/reopen, with one declared post-build runner-script supplement and exact source/profile/process closure. Source archive/bundle and harness snapshots are preserved beside the receipt. Corrupt codec/decoded overflow native UI and complete malformed-wire/same-ID/provider/platform/package/legal acceptance remain open. Prior initial-status receipt: `artifacts/native-grpc-receive-20261022/verification.json`.
- Saved numeric examples: `artifacts/native-grpc-numeric-examples-20261022/verification.json`; shared editor fields: `artifacts/template-session-owner-ui-20261022/verification.json`. These retain their recorded source/scope.
- Complete malformed/error equivalence, retained source/schema/JSON/Any/editor/template/stream variants, provider/proxy/config/routing races, worker/ACK/OS-close lifecycles, accessibility, platforms and packaging/legal remain required by PARITY and the service-config/topic contracts.
- Original fixtures, failed receipts and source hashes remain evidence. Rebase provenance is in `artifacts/docs-cleanup-20261022/history-map.json`; a historical receipt does not verify a later build.

## Source references

- `src-tauri/src/grpc_schema.rs`: compilation, modes, codec and response reader; `grpc_legacy*.rs`, `grpc_defaults.rs`, `grpc_example.rs`: schema/JSON/lookup/default/example behavior.
- `grpc.rs`, `grpc_transport.rs` and related modules: native registration, transport/config/routing lifetimes.
- `src/lib/grpc*.js`, `proto-management.js`, `GrpcPane.svelte`, `ProtoManager.svelte`: UI, saved data and ownership.
- Official behavior references: [Reader](https://raw.githubusercontent.com/protobufjs/protobuf.js/protobufjs-v7.2.4/src/reader.js), [BufferReader](https://raw.githubusercontent.com/protobufjs/protobuf.js/protobufjs-v7.2.4/src/reader_buffer.js), [decoder](https://raw.githubusercontent.com/protobufjs/protobuf.js/protobufjs-v7.2.4/src/decoder.js), [Tonic](https://docs.rs/tonic/latest/tonic/client/struct.Grpc.html).

## Existing evidence links

These anchors preserve references from parity/topic documents. Historical receipts retain their original bounded scope; no remaining acceptance requirement is waived. Execution diaries are omitted.

<a id="bundled-legacy-field-names--2026-10-22"></a>
<a id="copy-feedback-retains-its-source-message--2026-10-22"></a>
<a id="current-embedded-proto-root-correction"></a>
<a id="current-large-sent-event-retention-correction"></a>
<a id="current-native-base64-refusal"></a>
<a id="current-native-grpc-any-order"></a>
<a id="current-native-grpc-any-target"></a>
<a id="current-native-grpc-any-url"></a>
<a id="current-native-grpc-base64"></a>
<a id="current-native-grpc-bytes-arraylike"></a>
<a id="current-native-grpc-json-editor"></a>
<a id="current-native-grpc-json-refusal"></a>
<a id="current-native-grpc-long"></a>
<a id="current-native-grpc-map"></a>
<a id="current-native-grpc-message-order"></a>
<a id="current-native-grpc-numeric"></a>
<a id="current-native-grpc-oneof"></a>
<a id="current-native-grpc-overflow"></a>
<a id="current-native-grpc-reflection-arrival"></a>
<a id="current-native-grpc-reflection-profile"></a>
<a id="current-native-grpc-reflection-service"></a>
<a id="current-native-grpc-surrogate"></a>
<a id="current-native-large-grpc-preview-export"></a>
<a id="current-native-large-sent-history"></a>
<a id="current-native-proto2-extension-examples"></a>
<a id="current-native-saved-proto-schemaexample-acceptance--2026-10-22"></a>
<a id="grpc-cancellation-follows-request-ownership--2026-10-22"></a>
<a id="prepared-proto-preview-retains-its-owners--2026-10-22"></a>
<a id="presentation-preferences-retain-active-grpc-context--2026-10-22"></a>
<a id="proto-deletion-review-includes-dynamic-source-selectors--2026-10-22"></a>
<a id="proto2-extension-conversion"></a>
<a id="record-agent-grpc-method-containment-20261013"></a>
<a id="record-agent-proto-native-fields-prep-20261013"></a>
<a id="record-agent-proto-pending-fields-fix-20261013"></a>
<a id="record-current-grpc-assertions-and-quarantine-restoration"></a>
<a id="record-current-grpc-drive-root-repair"></a>
<a id="record-current-grpc-initializer-provenance"></a>
<a id="record-current-grpc-observer-restoration"></a>
<a id="record-current-grpc-package-preflight-and-root-refusal"></a>
<a id="record-current-grpc-terminal-observer-preparation"></a>
<a id="record-current-original-grpc-native-acceptance"></a>
<a id="record-current-proto36-native-acceptance"></a>
<a id="record-grpc-compatibility"></a>
<a id="record-grpc-inventory"></a>
<a id="record-grpc-method-containment-root-acceptance"></a>
<a id="record-grpc-rendering"></a>
<a id="record-proto-clientwidth-native-checkpoint"></a>
<a id="record-proto-focus-root-acceptance"></a>
<a id="record-proto-pending-fields-root-acceptance"></a>
<a id="save-response-feedback-follows-the-complete-call-snapshot--2026-10-22"></a>
