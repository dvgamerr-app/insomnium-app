# Hawk compatibility

Implemented 2026-09-24; real native UI/provider acceptance remains pending.

## Behavior

- Legacy auth type `hawk`, ID/key/algorithm/ext/validatePayload and disabled flag are preserved. SHA1 and SHA256 use existing RustCrypto hmac 0.12/sha1 0.10/sha2 0.10 dependencies. The inspected official hawk 5.0.1 crate has only SHA256/384/512; it was downloaded with cargo info for research but was not added as a dependency. No Node runtime/library or new crypto implementation is included.
- Frontend fields use existing environment rendering. New Hawk selections default to SHA256 and actual-request mode; imported Insomnium records without a mode retain legacy behavior. Malformed boolean/mode/algorithm values stop the request with a visible error.
- `legacy`: hashes rendered saved body.text with body.mimeType when validation is enabled. Absent/null text omits the hash; an empty string gets the empty payload hash. Form/multipart/binary do not automatically hash their wire bytes. GraphQL retains its saved JSON text. Host/port come from the request URL, ignoring manual Host, as in the original adapter.
- `standard`: hashes actual native body bytes and effective Content-Type, including empty bodies, binary and encoded multipart. A manual Host controls signature host/port. Duplicate Host or payload Content-Type fails visibly. Default ports follow HTTP/HTTPS; query order, duplicates, escapes and a trailing question mark are retained by the current URL representation.
- `postman`: imports authId/authKey/extraData/delegation/includePayloadHash into canonical fields, retains original fields, timestamp/nonce/app and sets this mode explicitly. Uses URL host/port and the explicit Content-Type before automatic body headers. Empty/multipart bodies omit payload hashes; other bodies use wire bytes. Matches the inspected Postman ext normalization (first backslash replacement), while ordinary Hawk uses global replacement. Postman's unused user field stays retained without affecting the signature.
- Optional nonce/timestamp inputs support imported fixed values; blanks produce fresh secure six-character nonce and Unix seconds per signature. Optional app/dlg follow the Hawk/Oz normalized suffix; delegation requires an application ID. Key is raw UTF-8, not a base64-decoded key. Ext uses quoted-header escaping; non-printable/non-ASCII attributes and unsafe ID/nonce/app/dlg quoting are rejected. Header limit is 4096 bytes; key is bounded to 64 KiB and buffered/legacy bodies to 20 MiB. Generated Authorization is marked sensitive.
- Enabled manual Authorization (including empty/duplicate/environment-rendered names) bypasses Hawk preparation/native signing. Disabled Hawk also bypasses unused credentials. Browser preview requires the desktop app for generated Hawk. The UI explains that Validate payload signs the request; it does not verify responses.

## Transport and compatibility limits

HTTP/GraphQL, SSE and WebSocket use the same native signer. Digest executor arguments are grouped into Auth through HttpRequest.signing(), preserving the existing authentication rules. OAuth2 token/browser envelopes clear Hawk configuration. No command/capability was added.

The executor buffers once, recomputes same-origin signatures after redirects, removes Authorization on every hop and signs only the original origin. POST 301/302 and non-HEAD 303 conversion drops the body and suppresses stale legacy payload hashes; actual mode signs the new empty body. The original curl path reused an already calculated header; this deliberate correction supports effective redirected method/URI/body. Existing cancellation/deadline, cookie and client certificate policies remain shared. WebSocket signing uses the HTTP(S) handshake URL/port.

This is not full byte-for-byte legacy URL/parser or Postman body serialization compatibility. Legacy IPv6 URL mode strips brackets as the original parser did; actual Host mode retains authority brackets. Leading-zero ports, unusual raw encodings and custom plugin transformations remain part of broader URL/plugin parity. Quoted ext matches client escaping but must still be accepted by the particular server parser. Invalid inputs fail before sending rather than producing a malformed legacy header. Fixed stale nonce/timestamp values are kept explicitly, not refreshed silently.

No response MAC validation, server clock-skew synchronization/retry, bewit or message authentication is added; the inspected original request adapter did not use those APIs. Provider interoperability, native editor/IPC/reload, TLS/proxy/HTTP2 and persistent cookie behavior still need actual acceptance. No real provider or account was contacted. CUA again exposed no apps/browsers.

## Verification

- Svelte check: zero errors/warnings. Rust clippy -D warnings and formatting passed.
- Actual native signer/request structs/client and request builders/executor compiled from stdin into an ignored binary. No persistent jar attached and no saved test scripts.
- 45 native cases passed, including two published protocol header/payload vectors. Independent Bun HMAC checks verified 38 local wire requests: SHA1/SHA256, three modes, ext/Oz, raw query order/escaped/trailing-question paths, manual Host, binary/multipart, absent/empty legacy payload, fresh nonces, same-origin replay/body drop, cross-origin stripping, follow-off/401/redirect limit, manual override, SSE/WS and invalid inputs.
- Existing 34 AWS and 14 manual-Authorization/Digest/OAuth1 native cases passed against the changed executor.
- Direct JS checks covered environment values, legacy GraphQL preparation, manual/disabled missing credentials, malformed payload boolean, Postman mapping/content-type/multipart, browser rejection and WebSocket preparation.
- Windows release/NSIS packaging passed session 97539 (Rust release 3m29s). All 160 captured source hashes matched after packaging; source/artifact hashes are recorded in STATUS/BUILD.json. Direct checks do not establish the pending native UI/provider gates above.

## Official sources read before implementation

- https://github.com/mozilla/hawk/blob/main/API.md (published protocol vectors)
- https://raw.githubusercontent.com/mozilla/hawk/v9.0.1/lib/client.js
- https://raw.githubusercontent.com/mozilla/hawk/v9.0.1/lib/crypto.js
- https://raw.githubusercontent.com/mozilla/hawk/v9.0.1/lib/utils.js
- https://raw.githubusercontent.com/hapijs/hoek/v9.3.0/lib/escapeHeaderAttribute.js
- https://docs.rs/hawk/latest/hawk/ and installed hawk-5.0.1/src/credentials.rs (DigestAlgorithm excludes SHA1)
- https://docs.rs/hmac/0.12.1/hmac/
- https://raw.githubusercontent.com/postmanlabs/postman-runtime/develop/lib/authorizer/hawk.js
- https://raw.githubusercontent.com/postmanlabs/postman-request/master/lib/hawk.js

Original local evidence: archived network/authentication.ts, network/network.ts, main/network/parse-header-strings.ts, models/request.ts and ui/components/editors/auth/hawk-auth.tsx. The reference application and legacy source/user data were not changed.
