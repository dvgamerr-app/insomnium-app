# Migration status

Migration is incomplete. [PARITY.md](PARITY.md) retains the full acceptance checklist; [PLAN.md](PLAN.md) defines the work sequence. Topic contracts describe behavior, and receipts prove only their recorded scope.

## Finished topic: legacy gRPC response decoding

Implementation commit: `14d084e3`.

- One cursor reads the whole response, including nested messages and packed fields. Original field metadata, legacy numeric/string/map/group behavior, required-field validation and singular-message replacement are retained.
- ProtoJSON and the request writer remain separate. Native size/depth limits remain enforced.
- Existing legacy regressions: 54 passed. Windows/Linux all-targets compiler checks passed. The cursor change added no test files, functions, assertions or UI scenarios.
- Evidence: `artifacts/grpc-response-cursor-verification-20261022.json`. Original source identities remain in receipts; `artifacts/docs-cleanup-20261022/history-map.json` maps the rebased commits.

## Pending work

- Native integration has not run against the latest decoder. The previous 95-case Windows receipt is `artifacts/native-grpc-current-decoder-20261022/verification.json`; it predates later decoder/editor changes.
- The refresh build in `artifacts/native-grpc-cursor-20261022/` was stopped when the owner paused work. Exit 1 records cancellation, not a passing build. No native scenario launched; the probe profile was unchanged.
- Complete malformed/error equivalence and retained provider/lifecycle/accessibility/platform/package/legal acceptance remain open. All eight plan streams and every unclosed PARITY requirement remain required.

## Resume

Migration is paused. Resume with a successful current build and the existing native gRPC scenario, without expanding its matrix. Finish one topic, run relevant checks, then write one concise outcome summary.

No owned build/native-app processes remain. This interface cannot invoke `/compact`; this file is the handoff.
