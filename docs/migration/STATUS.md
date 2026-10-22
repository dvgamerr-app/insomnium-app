# Migration status

Migration is incomplete. [PARITY.md](PARITY.md) retains the full acceptance checklist; [PLAN.md](PLAN.md) defines the work sequence. Topic contracts describe behavior, and receipts prove only their recorded scope.

## Finished topic: legacy gRPC map-value defaults

Saved-file responses now initialize omitted map enum values to `0` and omitted bytes values to `[]`, preserving explicitly encoded empty bytes as `{}`. Reflection retains absent-value omission under its separate options `{}` profile.

- Pinned protobuf.js 7.2.4 confirms both profiles: `artifacts/grpc-map-value-default-reference-20261022.json`.
- All 54 existing legacy regressions passed; the existing consolidated fixture was extended without adding test files, functions or scenarios. Log: `artifacts/grpc-map-value-default-regression-20261022-final.log`.
- The first regression run failed because the reference incorrectly enabled defaults for reflection; correcting the oracle to the production options confirmed reflection needs no code change. Failed receipt is retained.

## Prior shared-reader integration

Implementation commit: `14d084e3`; the following checks predate the map-default correction.

- One cursor reads the whole response, including nested messages and packed fields. Original field metadata, legacy numeric/string/map/group behavior, required-field validation and singular-message replacement are retained.
- ProtoJSON and the request writer remain separate. Native size/depth limits remain enforced.
- Existing legacy regressions: 54 passed. Windows/Linux all-targets compiler checks passed. The cursor change added no test files, functions, assertions or UI scenarios.
- Native Windows integration: all 95 existing cases passed (43 unary/TLS, 7 streaming, 45 reflection), native-hidden, host exit 0. Original settings and the complete two-file profile were restored; 1,661 selected inputs remained unchanged.
- Evidence: `artifacts/grpc-response-cursor-verification-20261022.json` and `artifacts/native-grpc-cursor-resume-20261022/verification.json`. `artifacts/docs-cleanup-20261022/history-map.json` maps earlier source identities.

## Pending work

- Specific malformed/noncanonical decoder inputs retain Rust/reference evidence; the native scenario verifies ordinary integration. It does not establish complete gRPC equivalence or OS-close acceptance.
- Complete malformed/error equivalence and retained provider/lifecycle/accessibility/platform/package/legal acceptance remain open. All eight plan streams and every unclosed PARITY requirement remain required.

## Resume

Continue PLAN item 1 from a concrete source discrepancy or named acceptance gap. Reuse the verified native candidate while its input hashes match; do not replay this passed scenario without a relevant change. Finish one topic, then write one concise result summary.

No owned build/native-app processes remain. This interface cannot invoke `/compact`; this file is the handoff.
