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

Sources:
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

Sources:
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
