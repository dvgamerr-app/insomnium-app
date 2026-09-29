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

