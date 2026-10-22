# Migration status

Migration is incomplete. [PARITY.md](PARITY.md) retains the full acceptance checklist; [PLAN.md](PLAN.md) defines the work sequence. Topic contracts describe behavior, and receipts prove only their recorded scope.

## Finished topic: gRPC receive status and size boundaries

Initial `grpc-status` remains metadata until END_STREAM; actual trailers determine final status. Declared incoming overflow returns grpc-js RESOURCE_EXHAUSTED before buffer reservation. Two Rust tests/13 wire paths, Windows/Linux all-targets and format pass (`artifacts/grpc-receive-limit-verification-20261022.json`, `artifacts/grpc-receive-linux-20261022/verification.json`). Fresh normal-hook production native build on `5acb53b1` passes the same95 UI/IPC cases with initial status7 in the existing fixture;75 observed streams include the independent HTTP2 control. Host native-hidden/exit0, exact profile/settings restoration, all1,718 tracked inputs unchanged, no live processes. Evidence/source bundle: `artifacts/native-grpc-receive-20261022/verification.json`. No new UI cases/files. Native declared-overflow/complete malformed-wire, OS-close and other-platform/runtime/package/legal acceptance remain open.

- Request ownership/cancellation remains verified by check/build and the maintained headless scenarios: `artifacts/request-child-cancel-verification-20261022.json`. Selection changes preserve background sends; resource/run replacement cancels retired work, and normal completion preserves retained plugin UI. Native same-ID held replacement/provider/OS-close acceptance remains open.
- Runner resource ownership retains controlled before/after proof: `artifacts/runner-resource-owner-verification-20261022.json`. Ordinary native lifecycle and held-request WM_CLOSE/reopen pass (`artifacts/native-runner-close-20261022/verification.json`); held same-ID replacement acceptance remains open. Prior normal-hook production build/gRPC95/runner baseline: `artifacts/native-grpc-metadata-20261022/verification.json`.
- Receive-metadata correction retains pinned Metadata API and two Rust tests/12 strengthened wire paths plus Windows/Linux compiler proof: `artifacts/grpc-metadata-admission-verification-20261022.json`. No decoder was duplicated.
- Reset/TCP-drop correction retains before/after Rust wire and Windows/Linux compiler proof: `artifacts/grpc-connection-drop-verification-20261022.json`. Hyper remains unpatched; simultaneous reset/drop precedence remains open.
- GraphQL pending-fetch WM_CLOSE/reopen passed six original native checks with exact profile restoration: `artifacts/native-graphql-close-20261022/verification.json`. Other protocol/OS/platform close requirements remain open.
- gRPC topic `65311f4a` retains Windows/Linux compiler and nine wire-path evidence. The current native receipt now includes its source changes; ordinary integration does not prove every malformed-wire variant. See GRPC.md for source-bound receipts and remaining gates.

## Pending work

- Specific malformed/noncanonical decoder inputs retain Rust/reference evidence; the native scenario verifies ordinary integration. It does not establish complete gRPC equivalence or OS-close acceptance.
- Reset/drop corrections still need native runtime/platform and simultaneous reset/drop callback precedence acceptance. Current Windows/Linux compiler and Rust wire evidence are complete for their stated scope; prior native UI receipts predate them.
- Root request-action controls, OAuth provider/native publication, held cancellation/chooser/same-ID and OS-close/platform acceptance remain open.
- Runner real Worker/native held suite/test replacement acceptance remains open; source/controlled-function ownership checks are now implemented.
- Complete malformed/error equivalence and retained provider/lifecycle/accessibility/platform/package/legal acceptance remain open. All eight plan streams and every unclosed PARITY requirement remain required.

## Resume

Continue retained PLAN/PARITY work from current source and named evidence gaps. Reconcile later implementation records before treating historical pending notes as missing code. Reuse matching scenarios without repeating unrelated green matrices; finish one topic before its concise summary.

No owned build/native-app processes remain. This interface cannot invoke `/compact`; this file is the handoff.
