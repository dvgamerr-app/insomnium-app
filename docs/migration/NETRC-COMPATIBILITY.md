# Netrc compatibility

Implemented 2026-09-24 in `src-tauri/src/netrc.rs`, the shared native signed-request executor, and the original-layout Auth selector. No extra dependency, command, permission, frontend credential reader or sidecar was added.

## Behavior

- Select **Netrc** in Auth. Enabled requests use native Basic authentication from the netrc file; browser preview reports that the desktop app is required. HTTP, GraphQL, SSE and WebSocket share the same native executor.
- Lookup starts in nonempty `HOME`; Windows falls back to nonempty `USERPROFILE`, Unix to Rust's home-directory lookup. Windows tries `.netrc`, then `_netrc` when there is no applicable entry (including when the first file is missing). No `NETRC` environment override or custom-path UI: these were not in the pinned old integration.
- Files are read once per operation on a blocking worker, with a 1 MiB limit each. Only regular files are accepted. File access/read errors stop the applicable lookup with a credential-free message; a failed unused Windows fallback does not invalidate a successful primary match. Cancellation/deadline can stop awaiting the worker, but cannot interrupt an already blocked OS filesystem read.
- Credentials are opaque bytes; quoted values support spaces, escaped quotes/backslashes and n/r/t escapes. Tokens, including individual credential fields, are limited to 16 KiB. Comments, CRLF, skipped `macdef` blocks and ignored `account` fields are supported. Malformed quoted/value syntax and NUL in parsed fields stop sending. Unknown tokens are ignored. Parsing stops after finding a complete applicable pair; later unrelated syntax is not validated.
- Machine and keyword comparison is ASCII case-insensitive; login selection is byte-exact. Ordered duplicate machine sections are retained. The first applicable section wins; an earlier `default` section can therefore win before a later machine section. Place defaults last. IPv6 lookup removes URL brackets.
- Initial URL username, percent-decoded, selects a matching login. URL password is discarded. A login-less section can provide a password for the selected username. Same-host redirects retain that selector; another host starts without it. Explicit credentials in redirect URLs remain rejected by the shared executor.
- A partial matching section uses an empty missing field. An empty section sends no Authorization; explicitly empty login/password fields send Basic for `:`. A missing file/no match sends no Authorization. Basic usernames containing a colon are rejected.
- Each redirect looks up its own target hostname, independent of protocol/port, from the operation's file snapshot. A default entry deliberately applies to arbitrary hosts. No password or login is borrowed from the previous destination or a separate partial section. Existing redirect limits, method/body rules, sensitive-header stripping and client-certificate origin guard still apply.
- Enabled manual Authorization, including an empty value, bypasses netrc file lookup entirely. Disabling authentication also prevents lookup. OAuth token/login requests explicitly clear the netrc flag. Netrc contents/generated credentials are never returned through IPC, copied into resources/history or written by the app. The native generated header is marked sensitive.

## Legacy evidence and deliberate differences

Original `main/network/libcurl-promise.ts` enabled `CurlNetrc.Required` based only on auth type; the old UI had no fields. The package was `@getinsomnia/node-libcurl ^2.36.12`; its pinned build evidence is recorded in AUTH-INVENTORY.md. Both release and pinned Windows curl sources correspond to 7.86-era behavior.

The old branch did not honor the auth disabled flag. The migration honors it and avoids unused file reads with manual Authorization. Old missing/unreadable files generally behaved like no match; missing files still do, but other I/O errors now surface. Oversized files/fields, malformed missing-value syntax and colon usernames have explicit errors. The old parser had a 4096-byte line buffer and could combine partial matching sections; this implementation uses bounded tokens and keeps section credentials separate. No saved URL password is reused on a missing entry.

These changes intentionally avoid known curl credential-retention defects, rather than reproducing historical leaks: [CVE-2024-11053](https://curl.se/docs/CVE-2024-11053.html), [CVE-2025-0167](https://curl.se/docs/CVE-2025-0167.html). Other unusual legacy parsing/URL-username behavior remains a compatibility review item; this is not a claim of byte-for-byte curl emulation.

## Verification

- Svelte check: 0 errors / 0 warnings. Rust clippy with `-D warnings`, formatting and frontend production build passed.
- Compiled the actual request types/builders/netrc module/shared executor from stdin into ignored `artifacts/netrc-inspection.exe`; no test source/script was saved. Persistent jar was not attached.
- 45 synthetic native cases / 48 loopback wire requests passed: bytes/Unicode/quotes/comments/macros, machine/default/duplicates, URL selector/password removal, primary/fallback/no-match, partial/empty fields, malformed/oversized input, manual/disabled behavior, cross-host/cross-port redirects, both historical leak shapes, method/body replay/drop, follow-off and WebSocket handshake.
- 187 previous-auth cases passed against that helper: NTLM 30, ASAP 64, Hawk 45, AWS 34, manual-auth/Digest/OAuth1 14. Pure JS enabled/disabled/manual/native-only preparation checks passed.
- Every fixture was in a unique ignored workspace directory supplied only as the child process HOME/USERPROFILE. Files/directories and servers were removed after inspection. No real user's netrc file was read.
- Windows release session74624 passed (Rust release4m17s); all165 source hashes matched the captured snapshot. Current executable/NSIS hashes are in BUILD.json. Installer was not executed/published.
- Native Tauri IPC/UI/reload, installed-profile discovery, Unix fallback/platform matrix, proxy/TLS/persistent-jar combination and real-provider acceptance remain pending. CUA exposes no apps/browsers. Build/installer evidence belongs in BUILD.json/STATUS; do not infer full migration completion from it.

## Sources read before implementation

- https://curl.se/libcurl/c/CURLOPT_NETRC.html
- https://raw.githubusercontent.com/curl/curl/curl-7_86_0/lib/netrc.c
- https://raw.githubusercontent.com/curl/curl/curl-7_86_0/lib/url.c (override_login)
- https://raw.githubusercontent.com/curl/curl/master/lib/netrc.c (current behavior comparison)
- https://doc.rust-lang.org/std/env/fn.home_dir.html (Rust 1.98.1; Windows HOME precedence is implemented explicitly)

No generator is needed for this request-auth module. Reused existing reqwest, base64, percent-encoding and Tokio APIs/dependencies after reviewing their existing integration; package manager commands were not needed.
