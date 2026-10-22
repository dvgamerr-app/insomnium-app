# Migration status

Migration is incomplete. [PARITY.md](PARITY.md) retains the full acceptance checklist; [PLAN.md](PLAN.md) defines the work sequence. Topic contracts describe behavior, and receipts prove only their recorded scope.

## Finished topic: gRPC receive metadata admission

Receive metadata now matches grpc-js key/text admission, preserves valid duplicate prefixes, raw initial grpc-message and repeated binary status details. Invalid status text cannot become OK. Removed duplicate pre-decoders; the existing Number normalizer already handles `00`/`007`, so no new parser was needed. Actual pinned Metadata API reference, two existing Rust tests/12 strengthened wire paths, Windows/Linux all-targets compiler and scoped formatting pass. No test files/functions/wire cases or native/UI matrix added. Eight Linux inputs match before/after; no-mount container stopped. Evidence: `artifacts/grpc-metadata-admission-verification-20261022.json`. Current native/platform/package/legal acceptance remains open.

- Request ownership/cancellation remains verified by check/build and the maintained headless scenarios: `artifacts/request-child-cancel-verification-20261022.json`. Selection changes preserve background sends; resource/run replacement cancels retired work, and normal completion preserves retained plugin UI. Native same-ID held replacement/provider/OS-close acceptance remains open.
- Runner resource ownership passed check/build and controlled production-function before/after checks: `artifacts/runner-resource-owner-verification-20261022.json`. Real Worker/native same-ID acceptance remains open.
- Reset/TCP-drop correction retains before/after Rust wire and Windows/Linux compiler proof: `artifacts/grpc-connection-drop-verification-20261022.json`. Hyper remains unpatched; simultaneous reset/drop precedence remains open.
- GraphQL pending-fetch WM_CLOSE/reopen passed six original native checks with exact profile restoration: `artifacts/native-graphql-close-20261022/verification.json`. Other protocol/OS/platform close requirements remain open.
- gRPC topic `65311f4a` retains Windows/Linux compiler and nine wire-path evidence. The current native receipt now includes its source changes; ordinary integration does not prove every malformed-wire variant. See GRPC.md for source-bound receipts and remaining gates.
- Prior normal-hook native build on source `efae450e` passed existing gRPC 95 cases and plugin 28 checks, with exact profile restoration and host exits: `artifacts/native-request-grpc-current-20261022/verification.json`. It predates this runner correction.

## Pending work

- Specific malformed/noncanonical decoder inputs retain Rust/reference evidence; the native scenario verifies ordinary integration. It does not establish complete gRPC equivalence or OS-close acceptance.
- Reset/drop corrections still need native runtime/platform and simultaneous reset/drop callback precedence acceptance. Current Windows/Linux compiler and Rust wire evidence are complete for their stated scope; prior native UI receipts predate them.
- Root request-action controls, OAuth provider/native publication, held cancellation/chooser/same-ID and OS-close/platform acceptance remain open.
- Runner real Worker/native held suite/test replacement acceptance remains open; source/controlled-function ownership checks are now implemented.
- Complete malformed/error equivalence and retained provider/lifecycle/accessibility/platform/package/legal acceptance remain open. All eight plan streams and every unclosed PARITY requirement remain required.

## Resume

Continue retained PLAN/PARITY work from current source and named evidence gaps. Reconcile later implementation records before treating historical pending notes as missing code. Reuse matching scenarios without repeating unrelated green matrices; finish one topic before its concise summary.

No owned build/native-app processes remain. This interface cannot invoke `/compact`; this file is the handoff.
