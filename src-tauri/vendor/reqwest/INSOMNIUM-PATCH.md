# Windows AF_UNIX extension

Based on crates.io reqwest 0.12.28 (upstream licenses retained). Original package checksum: eddd3ca559203180a307f12d114c268abf583f59b03cb906fd0b3ff8646c1147.

Pinned by the application to =0.12.28 and patched through Cargo [patch.crates-io]. No registry source was modified.

Changes: expose async ClientBuilder::unix_socket on Windows; carry its path and proxy bypass; route Windows AF_UNIX before named pipes/TCP; create a nonblocking socket2 stream and use existing HTTP/native-TLS/rustls wrapper logic. Named pipes and Unix implementation remain separate. socket2 is Windows-only. The application uses rustls; other feature configurations require separate verification.

Maintenance: compare connect_windows_unix TLS wrapping with upstream connect_local_transport during upgrades. Preserve request timeout and connector-layer behavior. Pending connection future owns the stream. Do not replace AF_UNIX with TCP or named pipes.

Evidence and remaining acceptance: docs/migration/UNIX-SOCKET.md in repository root.

Cargo patch documentation: https://doc.rust-lang.org/cargo/reference/overriding-dependencies.html#the-patch-section

HTTP acceptance revealed client-level proxy auth/custom-header injection despite connector bypass. Clear proxy matchers before constructing Client when unix_socket is configured on Unix/Windows. Regression verified with dead authenticated proxy and custom proxy header over real AF_UNIX.
