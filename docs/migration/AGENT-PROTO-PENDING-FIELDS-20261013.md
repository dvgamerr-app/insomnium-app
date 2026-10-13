# Proto pending filename ownership measurement — 2026-10-13

Measurement only; product ProtoManager stays SHA50c24cb7 (accepted focus-only candidate), with no Field/error/CSS/data changes. The same saved component branch completes174 receipts across dark/light1440/900/760×600: all138 original focus/lifecycle/data receipts and assertions, plus36 current-value ownership receipts. Final scenario73216 exits1 for exactly30 observed field failures; compiler64941 exits0 with zero errors/warnings. No application/native build or native/profile/root/cache launch. Preview5493 verification supplement restored3839, not offered.

## Authoritative findings

Each following failure repeats in six profiles:

- Current first invalid pending filename has no stable control ID/aria-invalid/error description.
- Current second invalid pending filename likewise has no association, after real ordered validation identifies it.
- Correcting the first invalid name leaves its old global refusal visible, without any save.
- Both duplicate pending names lack their own distinct associated error identities.
- Resolving the duplicate pair leaves the stale global duplicate refusal visible, without any save.

The actual existing `validateProtoFiles` (`src/lib/grpc-model.js:110`) produces the refusal; no parser or validation substitute. It validates ordered filename/path/suffix/duplicate checks before resource creation. First/second invalid cases retain exact visible error text. An unrelated valid second-row edit preserves the current first-row error, which is the correct ownership distinction. All no-save checks compare actual resources/history/persisted browser workspace.

Real context refusal remains global/unmarked and survives a valid pending-name edit. Actual browser desktop-only replacement refusal likewise stays global/unmarked after editing a valid pending name. Original current owned File.text rejection remains feature-global; invalid saved rename rolls back to the valid original name, which remains unmarked. None of these generic read/backend/context/rollback-to-valid cases justify marking a current pending filename invalid. Late source/request/data/disposal suppression and Cancel focus remain the original138 contract.

## Minimal proposed correction, subject to root review

Limit adoption to pending `Proto path N` controls in ProtoManager. Preserve their existing indexed accessible names, raw values, width/height/font/color/background, five-pixel vertical margins and preview padding. Reuse existing Field.error context with feature-local composition; no new shared API or density variant. A caption-free wrapper can preserve existing aria-label names, but its wrapper/display and existing direct-child input selector must first be measured against the recorded valid input rectangles. Do not add visible captions or change global Field defaults merely to ease querying.

Keep a typed local filename-refusal record associated with the captured pending selection/request/data/epoch and authoritative failing row(s). Classify invalid name/suffix and duplicate-pair refusal at the existing validation boundary, preserving the actual model message/ordering. Do not infer field ownership by matching arbitrary backend error strings. Duplicates require both affected rows with distinct IDs/descriptions. On a relevant edit, clear only the owned current-value refusal when its actual invalid-name or duplicate condition is resolved; editing another row must not clear the first invalid name. Never commit raw proto resources on correction alone.

Keep source size/count, hierarchy/file-directory collision, workspace/admission/persistence, native schema/read/backend failures form-level unless separately proven row-authoritative. A rollback-to-valid saved rename does not own a current invalid field. New selection/discard/success/destruction must retire filename ownership; current context and other global feedback must survive unrelated valid edits. Preserve all existing keyed-parent, async cancellation and focus-only guards. This is a proposal, not an implemented correction or native acceptance.

## Frozen proof and offered scope

Manifest `artifacts/proto-pending-fields-measurement/final/audit.json` SHA `46787e3a38f91ffdf301c594fcedba74593d9a42fa06e243f1fa76fd2e27ab9c`, independently285/285. Maps: source255 → `final/source/<path>`; harness8 → `final/harness/<path>`; outputs16 → `final/output/<name>`; bundle2 → `final/bundle/<name>`; verification4 → `final/verification/<name>`. Outputs include174 raw receipts, exact30 grouped failures, summary/result and screenshots. Source255 is the prior immutable cba capture plus approved50c focus correction, not a new whole-current-root/native generation.

`original-body-guard.json` reverses only the additive import/call and two additional global/rollback assertions, proving the whole original138 helper body LF-identical to its frozen predecessor. SAME native entry and fixture are untouched. `helper-before.js` and all previous4eef/f403/old native/Cookie evidence remain immutable. One preparation literal-newline syntax error and corresponding compiler refusal are archived separately; they are not product findings. Current production style text remains unchanged (its earlier CRLF/LF normalization is not a declaration change).

Offer only `tests/ui/helpers/proto-pending-fields.js`, the additive changes to `tests/ui/helpers/proto-manager-component.js`, and this report. No product changes. Official contract references remain [Svelte keyed lifetime](https://svelte.dev/docs/svelte/key), [tick/onDestroy](https://svelte.dev/docs/svelte/lifecycle-hooks), and the installed Field context implementation; no new subsystem introduced.

Handlesnone/profileunclaimed. Root independent receipt/ownership review and any geometry experiment/correction remain pending; native/OS/AT/schema/full migration gates remain OPEN. `/compact` unavailable; explicit STATUS/topic handoff instead of a compaction claim.
