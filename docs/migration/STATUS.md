# Migration status

Migration is incomplete. [PARITY.md](PARITY.md) retains the full acceptance checklist; [PLAN.md](PLAN.md) defines the work sequence. Topic contracts describe behavior, and receipts prove only their recorded scope.

## Finished topic: gRPC missing-status fallback

Missing grpc-status now follows grpc-js HTTP fallback codes/messages and retains trailer metadata. END_STREAM headers remain status delivery for retry ownership; clean EOF has its separate INTERNAL result. Malformed frame errors on non-200 responses report the HTTP error, while protobuf deserialization stays separate. These changes use the existing opt-in Tonic feature.

- Both existing status regressions passed: five retained wire shapes plus four distinct missing-status paths in the same peer fixture. The fixture now sends actual END_STREAM headers for headers-only cases. No new test function/file/UI scenario. All-targets locked/offline compiler and scoped formatting passed. Evidence: `artifacts/grpc-missing-status-verification-20261022.json`; notices retain incomplete legal/linkage scope.
- Linux all-targets release compiler passed on source `6a8ab48f` in 55.12 seconds; canonical native inputs matched before/after and the container is stopped. No tests/scenarios ran. Evidence: `artifacts/grpc-current-linux-20261022/verification.json`; cached build resources prove no runtime/package acceptance. Its source bundle preserves the compiled commit before this documentation-only amendment.
- Previous Windows native integration on source `3f73f571` predates this correction: all 95 unchanged cases passed, native-hidden, host exit 0, settings/full two-file profile restored and 1,661 inputs unchanged. Evidence: `artifacts/native-grpc-status-20261022/verification.json`; that binary is not current-source acceptance.
- Earlier map-default correction `d578a458`: all 54 legacy regressions passed; omitted saved-file enum/bytes values now use `0`/`[]`, while reflection omits absent values. Its pinned reference and regression receipts remain under `artifacts/grpc-map-value-default-*`.

## Pending work

- Specific malformed/noncanonical decoder inputs retain Rust/reference evidence; the native scenario verifies ordinary integration. It does not establish complete gRPC equivalence or OS-close acceptance.
- Complete malformed/error equivalence and retained provider/lifecycle/accessibility/platform/package/legal acceptance remain open. All eight plan streams and every unclosed PARITY requirement remain required.

## Resume

Continue PLAN item 1 from a concrete source discrepancy or named acceptance gap. Reuse the verified native candidate while its input hashes match; do not replay this passed scenario without a relevant change. Finish one topic, then write one concise result summary.

No owned build/native-app processes remain. This interface cannot invoke `/compact`; this file is the handoff.
