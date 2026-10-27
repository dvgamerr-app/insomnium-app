# Insomnium reqwest extensions

## Origin Digest response verification

ResponseVerifier is an opt-in request-owned Arc carried through Request extensions to the native HTTP builder, then through the existing pre-decompression DownloadMeter. It checks original headers, encoded entity chunks, trailers and transport EOF. Header failures remain visible to the application before upgrade; body failures suppress the corresponding frame/successful EOF. Consumers can check verified completion when a content decoder finishes. Requests without a verifier retain ordinary counting and decoding. Request::extensions_mut is public for this native attachment; only the verifier extension is forwarded, leaving request configuration/timeout handling intact.

Maintenance: preserve the targeted extension forwarding in execute_request (both transport branches), Request::try_clone, response extensions and meter placement before Decompression when upgrading. Application proof state/redacted diagnostics live in src/digest_response.rs; HTTP/SSE consumers require complete verification and the shared Digest executor checks headers before WebSocket upgrade or another authenticated attempt. RFC7616 §3.5: https://www.rfc-editor.org/rfc/rfc7616.html#section-3.5. Current bounded Windows release and saved scenario evidence: artifacts/digest-response-proof-20261027/verification.json. Proxy response proofs, cache and platform gates remain separate.

## Default header suppression

Async ClientBuilder::remove_default_header removes a named header from client defaults before execution. Insomnium uses it to suppress implicit Accept for imported curl commands; removing it only from Request is insufficient because execute reinserts client defaults. Explicit request headers remain unaffected. This extends the existing local 0.12.28 patch without changing default_headers merge semantics, dependency versions, TLS/proxy configuration or registry source. Retain the method when upgrading this fork. Native wire acceptance must use a newly built candidate.

## WebSocket client identity resolver

Insomnium also exposes rustls-only Identity::from_rustls_resolver, storing a cloned Arc<dyn ResolvesClientCert> and forwarding it to ConfigBuilder::with_client_cert_resolver. This preserves reqwest's existing root store, validation, ALPN, proxy and connector configuration while allowing WSS to select among legacy certificate/key arrays by the server's requested signature schemes and issuer hints. Native-TLS configurations reject this identity variant like other rustls PEM identities.

Maintenance: retain the variant in Clone and both TLS backend dispatches when updating reqwest. The application pins direct rustls to the same 0.23.45 dependency with ring/std/tls12; no alternate crypto provider is introduced. API reference: https://docs.rs/rustls/0.23.45/rustls/client/trait.ResolvesClientCert.html. Saved acceptance scenario: tests/ui/wss-multiple-client-certificates.js; runtime acceptance must be checked against a freshly built native artifact. Existing AF_UNIX changes below remain required.

Based on crates.io reqwest 0.12.28 (upstream licenses retained). Original package checksum: eddd3ca559203180a307f12d114c268abf583f59b03cb906fd0b3ff8646c1147.

Pinned by the application to =0.12.28 and patched through Cargo [patch.crates-io]. No registry source was modified.

## Windows AF_UNIX extension

Changes: expose async ClientBuilder::unix_socket on Windows; carry its path and proxy bypass; route Windows AF_UNIX before named pipes/TCP; create a nonblocking socket2 stream and use existing HTTP/native-TLS/rustls wrapper logic. Named pipes and Unix implementation remain separate. socket2 is Windows-only. The application uses rustls; other feature configurations require separate verification.

Maintenance: compare connect_windows_unix TLS wrapping with upstream connect_local_transport during upgrades. Preserve request timeout and connector-layer behavior. Pending connection future owns the stream. Do not replace AF_UNIX with TCP or named pipes.

Evidence and remaining acceptance: docs/migration/UNIX-SOCKET.md in repository root.

Cargo patch documentation: https://doc.rust-lang.org/cargo/reference/overriding-dependencies.html#the-patch-section

HTTP acceptance revealed client-level proxy auth/custom-header injection despite connector bypass. Clear proxy matchers before constructing Client when unix_socket is configured on Unix/Windows. Regression verified with dead authenticated proxy and custom proxy header over real AF_UNIX.
## Proxy Digest request context

ProxyChallengeSession adds authenticate_request(headers, proxy certificate, method, exact request-target, replay body bytes). Its default delegates to authenticate for existing providers. The owned HTTP/1 proxy challenge transport invokes it for both absolute-form HTTP requests and authority-form CONNECT with an empty entity. Only Proxy-Authorization is generated; origin Authorization remains independent. Keep this method/call site together on upstream upgrades. Existing socket ownership, cancellation/deadline, TLS, bounded replay/challenge draining and retry limits remain unchanged. Insomnium uses the context for RFC7616 Digest (including auth-int); no host filesystem or OS sign-in is introduced. Cargo check passes; fresh native HTTP/CONNECT wire/signature and prior-provider regression acceptance remains required. See docs/migration/AUTHENTICATION.md.

## Original compressed response headers

The existing pre-decompression DownloadMeter retains an owned HeaderMap in response extensions. Response::original_headers exposes that map, falling back to ordinary headers for synthetic responses. Insomnium uses it for explicit curl-style decompression policies so Content-Encoding/Content-Length remain the server's values while body bytes are decoded. The meter also canonicalizes known gzip/deflate/br coding names case-insensitively before tower-http selects its decoder; original spelling remains in the saved map. Download counting and default header presentation are otherwise unchanged. Keep the meter inside the decompression layer for both connector paths on upgrades. Bounded actual helper/reqwest loopback evidence and remaining native/legal/platform gates are in docs/migration/CURL-IMPORT.md.

## Additional system-proxy exclusions (2026-10-18)

Insomnium adds async ClientBuilder::system_proxy_bypass(Option<NoProxy>). The automatically discovered system matcher keeps its original proxy URLs, credentials and environment/OS exclusions, then applies the supplied additional exclusions with the same pinned NoProxy parser used for explicit rules. A filter matcher is decision-only and never connects to its constant URL. Existing proxy()/no_proxy() disable automatic discovery exactly as before. No process environment changes, alternate discovery or registry mutation. None preserves upstream behavior; this does not replace NO_PROXY/OS exclusions. Keep the Config default, system matcher wrapper and pre-intercept filter together on upgrades. Existing licenses and other patches remain unchanged.

## Automatic proxy exclusion replacement (2026-10-18)

Supersedes the additive filter above. Some(NoProxy) now uses the pinned local hyper-util Matcher::from_system_with_no_proxy extension to replace the discovered matcher exclusion list; None retains upstream discovery/exclusions unchanged. Proxy URLs/authentication/CGI and feature-gated OS discovery stay inside hyper-util. proxy()/no_proxy() still disable automatic rules. No process environment mutation or fake filter URL. This matches archived nonempty CURLOPT_NOPROXY settings overriding environment no_proxy. Existing empty app settings do not override discovery. Keep both local patches together on upgrades.
