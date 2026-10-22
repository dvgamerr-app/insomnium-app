# Migration status

Migration is incomplete. [PARITY.md](PARITY.md) retains the full acceptance checklist; [PLAN.md](PLAN.md) defines the work sequence. Topic contracts describe behavior, and receipts prove only their recorded scope.

## Finished topic: gRPC status decoding and delivery

Status messages preserve decodeURI semantics; malformed binary details use the shared tolerant decoder without panic. Empty/repeated details headers remain metadata without duplication. Trailers-only responses do not emit initial metadata, and OK trailers exclude the separate grpc-status/grpc-message fields. The opt-in Tonic feature also covers reflection/retry decoding; its upstream default stays unchanged.

- Both existing status regressions passed with five original HTTP2 shapes, including malformed details and metadata/status separation. Existing fixtures were extended; no new test function/file/scenario. All-targets locked/offline compiler and scoped formatting passed. Evidence: `artifacts/grpc-status-delivery-verification-20261022.json`; unchanged vendor inputs retain the prior notices receipt's incomplete legal/linkage scope. Related local status changes are consolidated into one topic commit.
- Fresh Windows native integration on source `3f73f571`: normal release/no-bundle build passed; all 95 unchanged cases passed (43 unary/TLS, 7 streaming, 45 reflection), native-hidden, host exit 0. Settings and the entire two-file profile were restored; 1,661 selected inputs stayed unchanged. Evidence: `artifacts/native-grpc-status-20261022/verification.json`; its source bundle preserves the built commit before this documentation-only amendment.
- Earlier map-default correction `d578a458`: all 54 legacy regressions passed; omitted saved-file enum/bytes values now use `0`/`[]`, while reflection omits absent values. Its pinned reference and regression receipts remain under `artifacts/grpc-map-value-default-*`.

## Pending work

- Specific malformed/noncanonical decoder inputs retain Rust/reference evidence; the native scenario verifies ordinary integration. It does not establish complete gRPC equivalence or OS-close acceptance.
- Complete malformed/error equivalence and retained provider/lifecycle/accessibility/platform/package/legal acceptance remain open. All eight plan streams and every unclosed PARITY requirement remain required.

## Resume

Continue PLAN item 1 from a concrete source discrepancy or named acceptance gap. Reuse the verified native candidate while its input hashes match; do not replay this passed scenario without a relevant change. Finish one topic, then write one concise result summary.

No owned build/native-app processes remain. This interface cannot invoke `/compact`; this file is the handoff.
