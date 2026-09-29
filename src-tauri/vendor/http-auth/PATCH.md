# Insomnium local patch

Based on crates.io `http-auth` 0.1.10, MIT OR Apache-2.0. Original source hashes and upstream commit are in UPSTREAM.json. Both upstream licenses and original embedded tests are retained. No new test scripts were added.

Cargo uses this source through `[patch.crates-io]`. Only the parser is enabled; digest calculation remains in `digest_auth`.

Changes:

- `src/table.rs`: classify UTF-8 bytes >= 0x80 as RFC 7230 obs-text in quoted text / quoted-pairs only. Token, scheme, whitespace and parameter-name syntax remain ASCII.
- `src/lib.rs`: unescape a whole UTF-8 character after a backslash, preserving byte lengths and avoiding slices through a code point. Update the value invariant documentation and make one elided lifetime explicit for the current Rust compiler.
- `src/parser.rs`: document the obs-text extension. The original challenge state machine and syntax checks are unchanged.

The API still takes `&str`; callers must reject invalid UTF-8 before parsing. Insomnium converts the parsed fields directly to `digest_auth::WwwAuthenticateHeader`, avoiding that crate's separate Unicode-unsafe text parser. No local registry source was changed, and no fork was published.

Review/remove this patch when an upstream version supports these cases. Do not enable the vendored library's Digest signer without independently rechecking its auth-int implementation.
