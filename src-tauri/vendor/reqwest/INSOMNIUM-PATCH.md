# Insomnium reqwest extensions

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
