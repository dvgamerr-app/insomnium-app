# gRPC render integration

## gRPC shared renderer integration — 2026-09-29

- gRPC discovery/call preparation now scopes the collection and renders URL/metadata through the shared Send session, including prompts and finite HTTP dependencies. Unary/server-streaming messages render after method discovery; client/bidirectional messages render on each explicit Send. Discovery and half-close do not evaluate message bodies.
- grpcConnection/grpcSchemaRequest/grpcContext/grpcBody accept explicit resolved inputs, avoiding a second interpolation of literal output. Existing synchronous composition remains for compatibility. grpcSourceContext supplies a noninteractive hash for UI/stale-call checks; excludes this request's body/method/modified fields so editing a streaming message remains possible. Method changes are checked separately.
- Schema cache stores both raw source context and resolved connection context. Repeated templates that resolve differently force discovery again. Metadata/environment/proto/settings changes discard stale preparations or close live calls; conservative changes to other source resources also invalidate. External dynamic inputs/history are not replayed during UI context checks.
- Client-message operations track shutdown completion, follow the connection signal, reject changed/closed/replaced runs before dispatch and clear sending state. Status/completion aborts pending render work. No native schema/codec/transport logic changed.
  -40 inline assertions passed:15 compiled gRPC/mocked-native cases (reflection, cache, unary, skipped discovery body, prompt Cancel, client messages/half-close, Stop, changed endpoint, dynamic metadata dependency, cleanup),7 composition/source checks (legacy compatibility, resolved literals, local proto and body/context edits),11 WebSocket regressions and7 OAuth introspection regressions. Svelte0/0, Vite build and git diff --check passed. A pure-probe tool call had a quoting syntax error before execution; corrected and rerun. No saved test scripts/new dependencies/native edits/installer; workers0, no real-user-state writes.
- Read official grpc.io core-concepts/reflection docs and archived grpc-request-pane.tsx getRenderedGrpcRequest/getRenderedGrpcRequestMessage/reflection interpolation before implementing. Existing subsystem reused; no generator needed. Bun directly runs Prettier, svelte-check with existing flags and vite build; git diff --check. Hidden node_repl program launch rules retained.
- Real WebView/native gRPC wire/proto/codec and call-end cancellation acceptance remains pending; mocked native checks prove frontend composition/lifecycle only. Source newer than BUILD.json. Next: streaming dependency completion and remaining stream behavior, native cookie/User-Agent/URL parity, then full runtime/UI/platform/packaging acceptance and other PARITY gaps. Full migration incomplete.

Official references consulted before implementation:

- https://grpc.io/docs/what-is-grpc/core-concepts/
- https://grpc.io/docs/guides/reflection/
