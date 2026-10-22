# Migration status

Migration is incomplete. [PARITY.md](PARITY.md) retains the full acceptance checklist; [PLAN.md](PLAN.md) defines the work sequence. Topic contracts describe behavior, and receipts prove only their recorded scope.

## Finished topic: persistence feedback ownership

Successful retry clears only its own save error; older failures cannot overwrite a newer save or replacement workspace. Four controlled-write checks, diagnostics0/0 and build0 pass. The existing headless recovery scenario also retains preview/cancel/restore and verifies failed save → visible error → successful retry → cleared error with actual Svelte workspace/persistence modules and controlled IPC. Receipt: `artifacts/playwright/workspace-recovery-1792653523742/result.json`; combined proof: `artifacts/persistence-feedback-verification-20261022.json`. No new scenario file or native profile touched. Native disk/crash/recovery and all retained PLAN/PARITY gates remain open.

- Request ownership/cancellation remains verified by check/build and the maintained headless scenarios: `artifacts/request-child-cancel-verification-20261022.json`. Selection changes preserve background sends; resource/run replacement cancels retired work, and normal completion preserves retained plugin UI. Native same-ID held replacement/provider/OS-close acceptance remains open.
- Runner resource ownership retains controlled before/after proof: `artifacts/runner-resource-owner-verification-20261022.json`. Ordinary native lifecycle and held-request WM_CLOSE/reopen pass (`artifacts/native-runner-close-20261022/verification.json`); held same-ID replacement acceptance remains open. Prior normal-hook production build/gRPC95/runner baseline: `artifacts/native-grpc-metadata-20261022/verification.json`.
- gRPC compression retains two Rust tests/16 paths, pinned reference4 and Windows/Linux compiler proof: `artifacts/grpc-compression-status-verification-20261022.json`. Prior metadata/status/size native95 and exact profile/settings/1,718-input closure: `artifacts/native-grpc-receive-20261022/verification.json`; that binary predates compression. Current compression native UI/header/truncation/platform gates remain open.
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
