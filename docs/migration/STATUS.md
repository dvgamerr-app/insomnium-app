# Migration status

Migration is incomplete. [PARITY.md](PARITY.md) retains the full acceptance checklist; [PLAN.md](PLAN.md) defines the work sequence. Topic contracts describe behavior, and receipts prove only their recorded scope.

## Finished topic: GraphQL pending-fetch window close

Existing GraphQL close/reopen scenario passes all six original checks: real WM_CLOSE cancels held introspection, persists and exits 0 without force; reopen preserves the request and fresh schema fetch succeeds. Existing resource/full-profile preservation now registers its owned collection and cleans its cookie files. Initial outer-only preservation refusal and reversible recovery are retained; final independent profile hashes match and hosts are gone. Evidence: `artifacts/native-graphql-close-20261022/verification.json`. No cases/files added. Built source `efae450e` differs from current application only in the uncalled runner function; this is bounded Windows close evidence, not OS shutdown or other protocol/platform acceptance.

- Request ownership/cancellation remains verified by check/build and the maintained headless scenarios: `artifacts/request-child-cancel-verification-20261022.json`. Selection changes preserve background sends; resource/run replacement cancels retired work, and normal completion preserves retained plugin UI. Native same-ID held replacement/provider/OS-close acceptance remains open.
- Runner resource ownership passed check/build and controlled production-function before/after checks: `artifacts/runner-resource-owner-verification-20261022.json`. Real Worker/native same-ID acceptance remains open.
- gRPC topic `65311f4a` retains Windows/Linux compiler and nine wire-path evidence. The current native receipt now includes its source changes; ordinary integration does not prove every malformed-wire variant. See GRPC.md for source-bound receipts and remaining gates.
- Prior normal-hook native build on source `efae450e` passed existing gRPC 95 cases and plugin 28 checks, with exact profile restoration and host exits: `artifacts/native-request-grpc-current-20261022/verification.json`. It predates this runner correction.

## Pending work

- Specific malformed/noncanonical decoder inputs retain Rust/reference evidence; the native scenario verifies ordinary integration. It does not establish complete gRPC equivalence or OS-close acceptance.
- Root request-action controls, OAuth provider/native publication, held cancellation/chooser/same-ID and OS-close/platform acceptance remain open.
- Runner real Worker/native held suite/test replacement acceptance remains open; source/controlled-function ownership checks are now implemented.
- Complete malformed/error equivalence and retained provider/lifecycle/accessibility/platform/package/legal acceptance remain open. All eight plan streams and every unclosed PARITY requirement remain required.

## Resume

Continue retained PLAN/PARITY work from current source and named evidence gaps. Reconcile later implementation records before treating historical pending notes as missing code. Reuse matching scenarios without repeating unrelated green matrices; finish one topic before its concise summary.

No owned build/native-app processes remain. This interface cannot invoke `/compact`; this file is the handoff.
