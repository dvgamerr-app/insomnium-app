# OpenAPI query delimiters on the wire

2026-10-08. Base `14535e9`; this corrects supported query styles without changing
serialization metadata, editing controls, native transport or ordinary request
query handling.

`openapi-query.js` previously constructed literal pipe separators and deepObject
brackets. The raw TCP native fixture proves that these reached the server without
encoding. Earlier style-table wire expectations accepted this behavior; they are
superseded by the corrected expectations.

| Style               | Old request query          | Correct request query        |
| ------------------- | -------------------------- | ---------------------------- |
| pipeDelimited array | `color=blue\|black\|brown` | `color=blue%7Cblack%7Cbrown` |
| deepObject          | `color[R]=100`             | `color%5BR%5D=100`           |

The change follows [RFC3986 query syntax](https://www.rfc-editor.org/rfc/rfc3986.html#section-3.4)
and [OpenAPI 3.2 Appendix E.6](https://spec.openapis.org/oas/v3.2.0.html#appendix-e-percent-encoding-and-media-types):
structural pipe/bracket characters need URI percent encoding. Names and data are
encoded independently before assembling the structural delimiters. Space
separators remain `%20`; form separators remain comma, equals and ampersand.

Literal delimiter characters in names/data can become ambiguous after decoding.
The specification calls for pre-encoding data separately to distinguish it from
delimiter syntax. The fixture covers both raw delimiters and already encoded
input; ordinary expansion encodes the percent sign in such input. Exact wire
bytes are verified, not a universal inverse decoder or provider-specific parsing
policy. `allowReserved` is still a separate required implementation gate.

## Saved scenarios and evidence

Run `bun tests/ui/build-recovery-copy-probe.js` and require the exact builder's
terminal0 plus finished/result0 in its build-state before native tests. Set
`INSOMNIUM_UI_BUILD_STATE=artifacts/native-recovery-copy-probe/build-state.json`.
Run native entries sequentially under the shared native-hidden policy.

The existing `bun tests/ui/openapi-query-serialization.js` now accepts
`INSOMNIUM_OPENAPI_VERSION` values `3.0.3`, `3.1.2`, `3.2.1` (default `3.0.3`).
Each run contains 18 generation/wire cases and three edited/disabled/malformed
controls, with exact resource preservation and reload without resend. Additional
cases cover literal/pre-encoded data and a parameter name containing delimiters.
The TCP fixture compares raw HTTP targets, independently of URL decoding.

Baseline `openapi-query-serialization-1791466263026` failed on the previous
successful production artifact: the pipe target was unescaped. Native41312 was
hidden and exited0; the listener closed. This is evidence of the original defect,
not acceptance of the new source.

Inline Bun checks pass 54 generation/transport cases across the three versions
and 54 Git parameter/URL round trips (`openapi-query-delimiters-inline.json`).
Another 108 controls verify encoding-off and existing-query composition
(`openapi-query-delimiters-compose.json`). Artifacts are under artifacts/playwright.
Compiler95823 and final9796 return zero errors/warnings; format/diff checks pass.
Production release1791466592294/1791467057064/result0/hash5977586194741203322
accepts all three saved native query runs:1791467115683 (3.0.3),1791467246960
(3.1.2),1791467383520 (3.2.1),21 groups each/63 total. Same-release nullable
1791467572020 accepts50 and URL1791467870516 accepts5 checks/23 targets/20
independent Hawk MAC cases. All native runs are hidden/visiblefalse/terminal0,
with parent exit0 and listeners closed. No live owned process/tool handles.
Exact process IDs/build records and scope are retained in STATUS/UI-TESTING.

The full OpenAPI/migration goal remains incomplete. `allowReserved`, content and
body encoding, advanced schemas/refs/examples, Swagger, lint, provider/version/
platform interoperability, URL/auth integration and every other PLAN/PARITY gate
remain required. This correction does not replace those requirements with the
smaller set of fixtures above.
