# Native gRPC plugin helper acceptance

The reusable `tests/ui/helpers/plugin-grpc-native.js` fixture owns a Bun HTTP/2
server and genuine plugin tags. Both tags read the actual workspace and saved
HTTP request, modify only the detached guest URL, send by saved ID with
ExtraRenderInfo, check native response history, and read the real response body.
`grpcurl` resolves the connection address; `grpcbody` resolves protobuf input.
There are no mocked plugin services or guest-purpose bypasses.

The working `tests/ui/plugin-template-tags.js` integrates this fixture behind
`INSOMNIUM_PLUGIN_HELPER_GRPC=1` and `INSOMNIUM_PLUGIN_HELPERS=1`. This fixture topic
is committed separately; that main scenario's wider helper/OAuth/protocol
integration and the production helper feature remain uncommitted.

## Accepted scope on 2026-10-11

- Compiler `82578` and final `30130` exit zero: no errors or warnings.
- Native `87609` exits zero; saved scenario output
  `artifacts/playwright/plugin-template-tags-1791684892949`, restoration
  `artifacts/playwright/plugin-workspace-helper-restoration-1791684892420`.
- Combined acceptance passes 26 checks / 12 terminated plugin workers / 29 actual
  HTTP requests, one WebSocket connection / two payloads, plus two actual gRPC
  calls / three protobuf messages. Retained seven OAuth cases and populated-cookie,
  root HTTP, ownership and automatic catalog recovery cases also pass.
- Local proto import and Load methods resolve the connection through actual
  helpers. Unary `/helper.Sample/Echo` receives `plugin-render-accepted` and status
  zero. Connected `/helper.Sample/Collect` independently renders and sends two
  messages, Commit closes the sender, and the joined response finishes with status
  zero. Seven child HTTP requests carry four `grpcurl` and three `grpcbody` bodies.
- Independent `artifacts/audit-plugin-grpc-helper.mjs` checks the actual recorded
  protobuf paths/messages/end states, child HTTP methods/bodies, native hidden
  host exit0/visiblefalse, workers, histories, cookie projection/disk, OAuth form,
  token context, active token preservation and no-wire cancellation. Both original
  workspace buffers, plugin store and all 653 original cookie files are restored;
  only the owned new cookie file is removed after native exit.
- Executable SHA256
  `20ab757ea334962177322637e29efa134d311e5d6f9d67e82b10220b44ee81c6` is reused from
  the successful OAuth production build, not claimed as a fresh gRPC build.
  The 63-source live manifest extends the prior 62-source manifest with this
  fixture; changes are restricted to this fixture and the main saved scenario.
  Every previously frozen application source is identical to the built snapshot.
  This is a bounded manifest, not a claim that every transitive gRPC source was
  independently frozen at the earlier build.

The first native run `62270` / `1791684828885` exited one after the server received
the correct unary message. Its fixture waited for request half-close before
responding, leaving unary pending. The corrected fixture responds upon the unary
message, following the existing saved gRPC fixture, while Collect waits for Commit.
Original first-run snapshots are preserved under first-live-source-snapshot and
first-live-source-freeze.json. Both runs restore the original owned-profile files.

## Remaining gates

gRPC reflection discovery, prompt Cancel/late send refusal/recovery, metadata,
server streaming/bidirectional methods, concurrent owners, ancestry/deadline and
other provider/platform cases still need their own helper acceptance. Broader
preview, synchronous app facade, DOM/events/onHide/private compatibility,
clipboard restoration, native chooser platforms and all original migration items
remain required before the deferred shared-input UX/UI/CSS phase.

Use the saved native scenario through the byte-preserving runner
`bun artifacts/run-plugin-grpc-helper.mjs`, with helper, cookie, protocol, OAuth
and gRPC flags enabled separately in PowerShell. Its build record selects only
the existing isolated probe executable. Native hosts hide before CDP and report
`native-hidden`; browser fixtures continue through fixed-headless launchUiBrowser.

Official references consulted before fixture implementation:
[Bun HTTP/2 compatibility](https://bun.com/docs/runtime/nodejs-compat#node-http2)
and [HTTP/2 server stream API](https://nodejs.org/api/http2.html).
JavaScript tooling and scenarios run with Bun only.
