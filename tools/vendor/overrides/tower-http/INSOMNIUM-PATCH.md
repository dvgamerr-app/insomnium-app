# Insomnium gzip member decoding

Upstream: tower-http 0.6.11, crates.io archive SHA256
`4cfcf7e2740e6fc6d4d688b4ef00650406bb94adf4731e43c096c3a19fe40840`.
The complete published source and MIT LICENSE are retained from the archive
already pinned by Cargo.lock. The registry cache is unchanged.

Local change: `src/decompression/body.rs` enables `multiple_members(true)` on
the gzip decoder. This preserves events/body bytes from consecutive gzip
members, including members received after a rendered SSE event. It also
keeps reading for later-member errors instead of reporting success after the
first member. Other compression algorithms and framing are unchanged.

Applied through Cargo's root `[patch.crates-io]` to the existing version,
without adding a dependency version. The patch affects gzip response decoding
for every reqwest consumer sharing this dependency, not just SSE. Verify HTTP,
SSE, cancellation and malformed/truncated bodies before accepting a release.

Baseline: native `sse-compression-native-1792052128332` renders the first member
but times out waiting for the second. Current acceptance and remaining gates
are in `docs/migration/HTTP.md` and `STATUS.md` at the repository root.

References:
- https://doc.rust-lang.org/cargo/reference/overriding-dependencies.html#the-patch-section
- https://docs.rs/async-compression/0.4.48/async_compression/tokio/bufread/struct.GzipDecoder.html

## Reusable response decoder factory

DecompressionBody::from_response exposes the existing response decoder through a shared helper also used by ResponseFuture. Codec selection, header removal, concatenated gzip, EOF/trailing-frame/error handling and feature gates retain the same implementation. The application composes this factory for explicit layered Content-Encoding, retaining each layer as a streaming body with cooperative frame polling and the existing protocol size limits. No dependency version or codec implementation is added. Keep this entry point and the shared helper when upgrading the local fork.

References: RFC9110 sections5.3/8.4; https://docs.rs/tower-http/0.6.11/tower_http/decompression/struct.DecompressionBody.html . Acceptance and remaining scope: docs/migration/HTTP.md and artifacts/http-stacked-compression-20261026/verification.json at the repository root.
