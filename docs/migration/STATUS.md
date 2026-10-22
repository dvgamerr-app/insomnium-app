# Migration status

Migration is incomplete. [PARITY.md](PARITY.md) retains the full acceptance checklist; [PLAN.md](PLAN.md) defines the work sequence. Topic contracts describe behavior, and receipts prove only their recorded scope.

## Finished topic: runner native window close and reopen

The saved runner lifecycle now supports WM_CLOSE at its existing held-request boundary and reuses its continuation after reopening. Unchanged production source/binary `8a132ccf` passes cancellation/save/destroy, both native-hidden hosts exit0 without force, no cancelled result/history, and a successful fresh run (four HTTP sends/one held cancellation). Original full profile restores exactly; check0 errors/warnings. No new scenario file or duplicate matrix. Evidence: `artifacts/native-runner-close-20261022/verification.json`. This closes bounded Windows runner window-close/reopen, not same-ID replacement, OS shutdown or other platforms.

- Request ownership/cancellation remains verified by check/build and the maintained headless scenarios: `artifacts/request-child-cancel-verification-20261022.json`. Selection changes preserve background sends; resource/run replacement cancels retired work, and normal completion preserves retained plugin UI. Native same-ID held replacement/provider/OS-close acceptance remains open.
- Runner resource ownership retains controlled before/after proof: `artifacts/runner-resource-owner-verification-20261022.json`. Ordinary native lifecycle and held-request WM_CLOSE/reopen pass; held same-ID replacement acceptance remains open. Current normal-hook production build/gRPC95/runner baseline: `artifacts/native-grpc-metadata-20261022/verification.json`.
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
