# Native HTTP response metadata

Native `send_http` now returns `httpVersion` from the final negotiated response and
`bytesRead` from the response payload before content decompression. Existing `size`
and `bodyBase64` continue to describe the decoded body. Headers, chunk framing and
redirect intermediate bodies do not contribute to the final payload count.

The vendored reqwest service wraps `FollowRedirect` before decompression with a
shared response-extension counter. Data frames increment the counter; pending,
errors, trailers, end-of-stream and size hints are forwarded. After draining the
body, native HTTP requires this counter rather than estimating from Content-Length
or decoded size. Synthetic responses constructed outside the service have no
counter. The pinned reqwest 0.12.28 dependency enables its documented `http2`
feature without changing its version or disabling existing features.

References: [libcurl downloaded payload size](https://curl.se/libcurl/c/CURLINFO_SIZE_DOWNLOAD_T.html),
[http-body frames](https://docs.rs/http-body/1.0.1/http_body/trait.Body.html),
[reqwest optional features](https://docs.rs/reqwest/0.12.28/reqwest/#optional-features).

## Verification checkpoint — 2026-10-11

- Production binary `d5a04def0a15d69f2247d7d3a49b688abd0b91db210e6e3545f296a11fb4b151`
  passes nine cases: plain, gzip, deflate, Brotli, chunked gzip with trailers,
  HTTP/1.0, HEAD, redirect and trusted-CA HTTP/2 gzip. Gzip encoded payload is
  116 bytes; decoded body is 8704 bytes. HEAD counts zero actual body bytes.
- Saved native metadata runs `1791675834445` and restart `1791675842597` cover
  IPC, genuine guest/model/body round trips, actual Send and file history,
  separate restart, 27 terminated workers and 30 native requests. The H2-only
  fixture records three native ALPN `h2` streams and one independent control,
  with zero fixture errors. Both original workspace buffers are restored.
- Independent current-worktree audit:
  `bun artifacts/audit-workspace-helper-http2-history.mjs artifacts/playwright/plugin-response-metadata-native-1791675834445 artifacts/playwright/plugin-response-metadata-restart-1791675842597 artifacts/playwright/plugin-response-metadata-restoration-1791675834264`
  passes 52 source/snapshot bindings, byte counts, build identity, history and
  restoration. The fixture and audit are preparation for the still-unfinished
  helper feature; they are not included in this native-only topic checkpoint.
- Windows and Linux Cargo checks pass. Linux source audit matches 275 actual
  source files and explicitly excludes four platform-generated schemas.
  Retained native save 12 groups and explicit main-window destroy also pass on
  this binary with source/workspace/selected-file audits.
- An isolated checkout of the staged native-only topic also passes locked Cargo
  checks on Windows (15.20 seconds) and Linux (22.15 seconds). Linux bindgen needs
  the installed library selected by `LIBCLANG_PATH=/usr/lib/llvm-14/lib`; the first
  automatic-discovery failure is retained. See the official
  [bindgen requirements](https://rust-lang.github.io/rust-bindgen/requirements.html).

HTTP/3, broader HTTP/2/proxy/provider/platform behavior and remaining migration
parity are not accepted by these fixtures. The generic HTTP/3 service branch is
wrapped consistently but its feature/runtime remains unverified. This topic
checkpoint does not complete the overall helper feature or migration. Full
helper activation, other protocols, DOM/private/sync/clipboard/platform gates and
the subsequent UX/CSS phase remain tracked in STATUS/PLAN/PARITY.
