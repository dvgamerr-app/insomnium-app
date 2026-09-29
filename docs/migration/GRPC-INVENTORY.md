# gRPC migration starting inventory

Updated 2026-09-24: native core, legacy JSON adapter and Svelte/resource integration implemented. 64 native,97 legacy differential and33 mock-IPC checks passed. PARITY remains PARTIAL; native UI/IPC and remaining compatibility are not verified. See STATUS/BUILD.json for packaging.

## Proto management implementation and remaining acceptance

Re-read archived ui/components/proto-file/proto-file-list.tsx and network/grpc/proto-loader.tsx during release packaging. The original renders nested directories/files, re-discovers top-level directories, re-uploads individual files and deletes directories. Re-upload preserves the file ID while replacing basename/source after validation. Directory refresh merges existing names and adds new entries; it does not remove old files missing from the chosen directory. The old descendant lookup is broader than immediate children; do not reproduce accidental cross-directory matches.

1. IMPLEMENTED: ProtoManager.svelte nested saved browser in GrpcPane, per-file replace and per-directory refresh/delete. Directory rename is not evidenced as an original control in this list.
2. IMPLEMENTED: explicit bounded selection, relative-path preview, root-relative refresh into the selected directory, ID/reference/unknown-field/absent-file preservation. Reject duplicate/path/type collisions before mutation. Compile every file in the affected candidate root through load_grpc_schema before committing replacements; editable invalid imported legacy sources are retained. A dependency change cannot commit if an unchanged service no longer compiles.
3. IMPLEMENTED: subtree deletion shows descendant-file count and affected requests, with explicit confirmation. Requests retain visible missing references; context changes cancel calls. Replacement validation joins shared shutdown/cancel tracking and checks a saved-proto fingerprint before commit, preserving unrelated request edits. Persistence failure is reported as an in-memory change that is not saved.
4. DIRECT INSPECTION PASSED:75 compiled-workspace/model checks including the previous33; native Rust compiler used for successful refresh/rename and broken-dependency rejection. Svelte0/0, formatting and frontend build passed. No saved test scripts. Actual native selection/reload/layout/IPC remains pending; package state is in STATUS/BUILD.json.

Official sources read before this step: https://svelte.dev/examples/file-inputs (file bindings), https://svelte.dev/docs/svelte/each (keyed lists), https://v2.tauri.app/develop/calling-rust/#channels (existing compiler invocation), https://v2.tauri.app/plugin/dialog/ (multiple/directory picker) and https://v2.tauri.app/plugin/file-system/ (scoped reading). HTML File inputs provide bounded explicit reads; native absolute paths are not required merely to refresh saved resources. No new permissions/dependencies were added.

## Method presentation and reflection examples implemented

Read ui/components/dropdowns/grpc-method-dropdown/grpc-method-dropdown.tsx, the body section of grpc-request-pane.tsx and main/ipc/automock.ts during proto-manager packaging. The original groups methods by package, shortens displayed paths to /Service/Method when a package exists, retains the full-path tooltip and shows the four streaming-type tags. This dropdown source does not implement a search field; previous generic references to method-search were not evidence of a required legacy control.

The original body uses the shared CodeEditor with JSON mode, Nunjucks support and prettify; no protobuf-specific completion prop is passed here. Common editor/template completion remains part of the wider editor/template migration. Sent client messages appear as timestamp-ordered Stream N tabs. As of September28, GrpcPane has Body/Stream N tabs with read-only sent content and timestamp; the bounded Sent log remains available. Native UI acceptance is pending.

The example action replaces body only when clicked. Local-proto examples serialize an empty dynamic message with defaults. Reflection now uses the bounded generator described below. Original automock instead supplies sample scalar values (Hello, true, numeric values by scalar kind), one repeated item, nested/map examples, first numeric enum and UUIDv4 for string names beginning/ending in id. It has a shared per-name/type visit counter and skips directly self-recursive fields. Its map/oneof and Buffer examples can be unsendable after JSON conversion; inspect the exact main/ipc/grpc.ts example-return path and compare fixtures before deciding how to retain useful original behavior without creating invalid messages. Do not change request bodies automatically on schema load or method selection.

September28: implemented package grouping/short-path/full-path tooltip/type labels in Svelte using keyed optgroups;10 inline Bun cases and Svelte0/0/frontend build passed. Sources read before editing: https://svelte.dev/docs/svelte/each and https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/optgroup . Actual native dropdown/tab interaction remains pending.

Further archived evidence from main/ipc/grpc.ts: local loadMethods returns only type/fullPath (lines60–68); reflection constructs mockedRequestMethods[methodName]().plain (line106) and forwards example (line128). Thus legacy samples apply to reflection. Current native empty-message defaults also offered for local proto are an extension, not an original equivalence claim.

September28: grpc_example.rs implements reflection samples, validated through the legacy parser before optional ProtoJSON rendering. First declared oneof member and byte arrays intentionally correct unsendable archived examples; over-visited optional fields are omitted. Full type names prevent collisions. Limits are four visits per name/type, depth16,1024 fields and128KiB. Failed examples keep method discovery usable with exampleError.15 native cases and5 archived comparisons/independent wire decodes passed. Local-default extension remains unchanged.

Next: shared editor/template migration and real sent-tab interactions, then JSON adapter edges/native acceptance. Official sources read before edits: https://docs.rs/prost-reflect/latest/prost_reflect/struct.FieldDescriptor.html , https://docs.rs/prost-reflect/latest/prost_reflect/struct.MessageDescriptor.html and https://docs.rs/uuid/latest/uuid/struct.Uuid.html#method.new_v4 . Existing uuid dependency already supports v4.

## Original evidence

Paths relative to `_backup/legacy-electron/packages/insomnia/src`:

- `models/grpc-request.ts`: GrpcRequest / greq; name, URL, description, protoFileId, protoMethodName, body.text, metadata rows (name/value/description/disabled), metaSortKey, isPrivate. Default body is `{}`. No ordinary HTTP authentication field is defined here; metadata/rendering must be inspected before sharing HTTP auth behavior.
- `main/ipc/grpc.ts`: start/sendMessage/commit/cancel/closeAll, method discovery from saved proto files or server reflection; unary, client-streaming, server-streaming and bidi are all explicit method types. Reflection carries enabled metadata and selects TLS using parseGrpcUrl. Original protobuf loader uses keepCase, longs as strings, enum names, defaults and oneof flags. Its JSON representation needs deliberate mapping; standard protobuf JSON is not automatically equivalent.
- `network/grpc/proto-loader.tsx`: validate/import/update individual files and recursive .proto directories into saved protoText records; write-proto-file reconstructs the saved hierarchy. Inspect remaining file/import-resolution code before porting. Do not treat arbitrary external filesystem imports as already authorized by a resource reference.
- Additional inventory paths located: models/proto-file.ts, proto-directory.ts, grpc-request-meta.ts; network/grpc/parse-grpc-url.ts, write-proto-file.ts; ui/components/panes/grpc-request-pane.tsx, grpc-response-pane.tsx; proto-file/proto-file-list.tsx, buttons/grpc-send-button.tsx, main/ipc/automock.ts. Their contents still need detailed review.

## Official starting sources

- https://docs.rs/tonic/latest/tonic/client/struct.Grpc.html — returned tonic0.14.6; generic dispatcher takes a codec/path, supports all four RPC styles and separate encoding/decoding size limits.
- https://docs.rs/prost-reflect/latest/prost_reflect/ — runtime descriptors/DynamicMessage candidate. Compare serde options and well-known types to original loader behavior.
- https://docs.rs/protox/latest/protox/ — Rust proto compiler candidate; inspect in-memory resolver and version compatibility with prost-reflect before adoption.
- Guessed https://github.com/hyperium/tonic/tree/master/examples/src/dynamic failed to open. Find an actual maintained working dynamic client/example rather than assuming this path exists.

## Work sequence

1. Complete archived request/response/proto/import/rendering/status/trailer/cancellation/close inventory. Map preserved imported resource types into current collection tree without dropping legacy records.
2. Inspect official working dynamic-client and reflection examples, crate versions/features and TLS/proxy transport configuration. Use documented cargo info/add only after deciding compatible packages. No Node gRPC sidecar or code generation runtime.
3. Implement native descriptor/proto compilation and reflection, bounded request/response codecs, metadata (including binary metadata), statuses/trailers and all four streaming lifecycles. Reuse cancellation/shutdown/Channel flow control where appropriate; an HTTP request body is not a replacement for gRPC framing.
4. Port original request/proto/service-method/response UI into Svelte JavaScript, with collection persistence, imports and environment rendering.
5. Inspect real compiled native code against disposable local service/reflection fixtures, then Tauri UI/IPC/TLS/reload acceptance when a surface is available. Do not create saved development test scripts without owner request. Update PARITY/STATUS with exact evidence and gaps.

## Native implementation

- grpc_schema.rs: protox0.9.1 memory-only resolver, explicit include directories plus Google well-known types; prost-reflect0.16.5/prost0.14.4 dynamic codec. Up to256 files,2MiB each/8MiB aggregate,4096 methods,20MiB protobuf/JSON messages. No external protoc or filesystem import resolution. Default legacy mode delegates JSON adaptation to grpc_legacy.rs; explicit protoJson remains available. Known edge differences are in GRPC-COMPATIBILITY.md.
- grpc_transport.rs: tonic0.14.6 channel with TLS roots/optional CA/identity; four RPC shapes through generic streaming dispatch with schema cardinality checks. Text/binary metadata, statuses/trailers, gzip decoding. Reflection v1 with Unimplemented fallback to v1alpha and bounded transitive descriptors. Protocol header overrides rejected. No proxy or disabled-certificate-validation option yet.
- grpc.rs: load_grpc_schema/connect_grpc/send_grpc_message/acknowledge_grpc; shared cancel_http network registry and deadlines. One outbound queued message; each incoming event awaits sequence acknowledgement. Finish only closes the sender. Local proto compilation runs on a blocking worker; cancellation stops waiting but cannot interrupt an already running compiler thread.
- Official sources additionally read: https://docs.rs/protox/latest/protox/struct.Compiler.html , https://docs.rs/prost-reflect/latest/prost_reflect/struct.DynamicMessage.html , https://docs.rs/tonic/latest/tonic/struct.Streaming.html , https://protobuf.dev/programming-guides/json/ , https://github.com/grpc/grpc-proto/blob/master/grpc/reflection/v1/reflection.proto and v1alpha/reflection.proto . Installed crate source confirms generated reflection types are available without server feature.
- Final clippy/fmt and Svelte check passed. Protocol/TLS, differential and mocked-IPC evidence is in GRPC-COMPATIBILITY.md. Tauri IPC/UI remains unverified; BUILD.json records the last verified release separately from source progress.

## Frontend and JSON decisions (implemented)

1. Read protobuf.js official README, ext/README.md and src/type.js before choosing an adapter. Dynamic Type generation uses util.codegen; the WebView retains strict CSP. Implemented a native JSON adapter around prost-reflect encoding, with explicit legacy/protoJson modes. No production protobuf.js dependency or binary IPC mode was added.
2. Compared pinned protobuf.js7.2.4/Long5.3.2 source and behavior, including Electron structured clone. Installed those packages only under ignored artifacts/grpc-legacy-reference using Bun --exact --ignore-scripts. Added ryu-js1.0.3 through documented Cargo commands for JS number formatting. 97 differential cases passed; edge differences remain explicit.
3. Added grpc-model.js/grpc.js/GrpcPane.svelte; connected model.protocolFor, addRequest, execute and page routing. Saved hierarchy is retained; imports are additive with relative-path preview and root isolation. ProtoManager/proto-management now add tree/replace/refresh/delete workflows. Shared editor/template support and original method grouping/example behavior remain open.
4. Registered discovery/calls in workspace.running/completions, rendered environment-dependent inputs, serialized Send/Commit and added schema cache/context invalidation. Immutable method/config snapshots and context changes prevent sends through stale connections. Required onStarted/started Channel notifications close the cancellation-registration race. Browser guidance requires desktop execution.
5. Next: inspect native UI/IPC/ACL/backpressure/reload and original layout; close JSON coercion/WKT/extension edges and shared editor/example/method-grouping parity. Keep other PARITY work moving if no UI surface is available.

Additional official sources read before these changes:

- https://raw.githubusercontent.com/protobufjs/protobuf.js/protobufjs-v7.2.4/src/converter.js and wrappers.js — pinned fromObject/toObject and Any behavior; installed field.js and Long5.3.2 source supplied defaults/coercion details.
- https://docs.rs/prost-reflect/latest/prost_reflect/enum.Value.html and struct.FieldDescriptor.html — dynamic values/defaults.
- https://docs.rs/ryu-js/latest/ryu_js/ — ECMAScript number serialization.
- https://www.electronjs.org/docs/latest/tutorial/ipc and api/ipc-renderer — structured-clone IPC semantics.
- https://bun.sh/docs/pm/cli/add — exact and ignore-scripts flags.
- https://v2.tauri.app/develop/calling-rust/#channels and https://svelte.dev/docs/svelte/$derived — native channels and derived UI state.

## Follow-up inventory during ES512 packaging

Read the remaining main/ipc/grpc.ts: unary/server streaming send an initial JSON body; client/bidi start an empty outbound stream, accept explicit sendMessage actions and then commit to close only the sending side. All support cancel/closeAll. Response data, final status/details/metadata, errors and end are separate events. Preserve that distinction and clean up every terminal path. The old nextTick write workaround and incomplete error cleanup should not be copied literally. Metadata rows retain order and disabled flags; binary metadata needs explicit treatment because the original passes strings.

parseGrpcUrl lowercases input, strips grpc:// for plaintext or grpcs:// for TLS, and treats an unprefixed address as plaintext. Preserve service/method case in the migration. The original native client uses createSsl defaults or createInsecure; this path does not pass the HTTP custom-CA/client-identity settings.

write-proto-file reconstructs saved trees in a temporary cache and uses every created subdirectory as an include directory, making sibling-name resolution potentially ambiguous. ProtoFile stores name/protoText; GrpcRequestMeta stores pinned/lastActive. Prefer a bounded in-memory resolver if supported, preserving saved hierarchy and validating imported names.

common/render.ts renders the request with description separately and optional skipBody, then each client-stream message independently. grpc-response-pane shows unary responses in tabs and streaming responses in timestamped stacked JSON editors with auto-scroll and a status/details header. The request pane resets transient responses on request/environment/Git changes and has method/proto management. Detailed controls/template completion still need mapping.

Official working reference located and read: https://github.com/grpc/grpc-rust/blob/master/examples/routeguide-tutorial.md and https://raw.githubusercontent.com/grpc/grpc-rust/master/examples/src/routeguide/client.rs . It demonstrates all four RPC forms and documents cargo run --bin routeguide-server / routeguide-client; these commands have not been executed here. It uses generated messages, so dynamic descriptor/codec mapping remains separate work. Also read https://docs.rs/protox/latest/protox/struct.Compiler.html . tonic-reflection0.14.6 top-level docs expose generated pb types and the server module; guessed v1 client pages did not resolve. Inspect installed source before assuming a generated reflection client is exported. The old Granc client source path returned404 and must not be treated as a working reference.
