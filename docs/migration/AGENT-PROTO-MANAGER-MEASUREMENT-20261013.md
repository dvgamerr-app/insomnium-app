# ProtoManager lifecycle and feedback measurement — 2026-10-13

Measurement only: no product/CSS/native/backend changes. Six headless profiles (dark/light × 1440/900/760 × 600) complete 102 receipts. The final saved scenario deliberately exits 1 for twelve keyboard Cancel focus failures: the actual focused Cancel button is activated with Enter, removed, and focus becomes BODY. All retained data/lifecycle assertions complete. This is a bounded component result, not native or full GrpcPane acceptance.

## Captured implementation and ownership

Root capture `cba152410f5bd82b8983b472b44470b34f5afdcf` supplies 255 byte-frozen `src/lib` sources. ProtoManager SHA `41b33de888f53bfd8fa0eec4f8947af533149a02aa35032fa614fdeb18805b02`; workspace SHA `c72a2a34d82f95c621cf2a1a438724d1e266f7e5d158fb8e9daf7b10f3b0a5a3`. Captured `src/routes/+page.svelte:793` keys GrpcPane by request ID; GrpcPane starts on Body (line 42), mounting ProtoManager only in Proto Files (line 365). The fixture preserves this key/tab lifetime and uses actual `selectRequest`, browser workspace persistence, and actual imported model helpers.

ProtoManager's read-success request check differs from its catch check, but request changes destroy the keyed component and dispose its workspace work scope. A→B, observed flushed ABA, same-ID data replacement, tab removal, unmount/remount, cancellation and late owned read rejection all suppress stale feedback/data in this measured lifetime. An unkeyed fixture would invent a production request-ownership failure. No such failure is claimed.

`ProtoManager.svelte` discard resets pending/reading/error state and cancels work without restoring focus. Both cancelled-success and cancelled-rejection reads reproduce BODY focus in all six profiles. The proposed next correction is narrowly to restore the originating picker after Svelte renders, only while its captured request/data/generation/lifetime still owns the operation and the picker remains connected/enabled. It must not steal focus after request/tab/unmount changes. Parent review is required before product edits.

## Separate field diagnostics

Invalid preview filename `../bad.proto` gives the authoritative existing `Error: Invalid or duplicate proto filename: ../bad.proto` refusal without save. The current invalid Proto path 1 has no ID/aria-invalid/error description in all six profiles; its old filename alert persists after a valid edit until retry. These six association and six correction observations are diagnostic evidence only, separate from the twelve strict focus failures. Generic read/backend refusal and rename rollback to a valid value must not be incorrectly attributed to a currently invalid name. No Field adoption or error-ownership change is offered.

## Saved scenario and fidelity

The additive `--proto-component` branch in SAME `tests/ui/nocturne-grpc-theme.js` returns before native code. Removing that exact branch reproduces the entire current-root native entry after whole-file LF normalization; frozen original SHA `eb1c2ba58db7f661e258bd758918876a342bc57598f52f5984dad4c7936885a2`. The four offered test paths are the entry, `fixtures/proto-manager-component.js`, `fixtures/proto-manager-component.svelte`, and `helpers/proto-manager-component.js`.

The owned source alias resolves only four explicit fixture imports to ordinary captured root source files, with all 255 hashes checked before fixture compilation. There is no IPC/Tauri/backend/network/parser substitution; absence of Tauri internals is asserted. Successful file imports use the real File.text implementation. Controlled pending/rejection cases override only owned File instances, never File.prototype. This measures browser/controlled-file behavior, not OS errors. Actual browser replacement reaches the unchanged desktop-only gRPC refusal and does not save; native schema replacement and held backend apply/remove remain open.

Original metadata/resource/history/raw proto state and browser persistence are compared at appropriate checkpoints. Navigation legitimately persists its active request; late reads do not persist. Valid import/rename, invalid rename rollback, invalid-preview correction, 2 MiB + 1 refusal, pending-data replacement and normal/error geometry receipts remain present. The fixture container is bounded component geometry, not a full native pane oracle.

## Frozen evidence and verification

Final manifest: `artifacts/proto-manager-measurement/final/audit.json`, SHA `f4035351c81c4dbecd30cd741c08733b1daee09c5f369031e9a3de593db0ccf5`. Independent `final/independent-rehash.json` verifies all 285 mapped files:

- `rootSourceHashes` → `final/root-source/<path>`: 255 sources.
- `harnessHashes` → `final/harness/<path>`: six files, including unchanged fixture helper and restored preview helper.
- `outputHashes` → `final/output/<name>`: 15 files (102 raw receipts, summary, wrapper result and twelve screenshots).
- `bundleHashes` → `final/bundle/<path>`: two actual emitted fixture files.
- `verificationHashes` → `final/<name>`: seven logs/source/entry guards.

Final scenario chunk `dab1bd` is terminal exit 1: measurement complete, 102 receipts, exactly twelve Cancel focus failures, browser errors empty. Final compiler session `21345` is terminal exit 0, zero errors/warnings. Earlier requested compiler `54800` was also terminal 0/0 before the strict RED collector. Compiler checks used only the approved ignored preview verification supplement `5493d735`; original helper `3839c23f` was restored and is not offered. No application/native build or native launch occurred.

Preparation negatives and predecessor outputs remain immutable: lexical waitForFunction argument error; wrong filename-message expectation; optional getAttribute compiler typing failure; first keyed/keyboard observation positives. They are not final acceptance. `root-source`, final snapshots, and prior Cookie proofs are preserved. This captured cba generation is not a claim about newer certificate/native artifacts.

Official references consulted: [Svelte keyed blocks](https://svelte.dev/docs/svelte/key), [Svelte lifecycle/tick](https://svelte.dev/docs/svelte/lifecycle-hooks), [Blob.text](https://developer.mozilla.org/en-US/docs/Web/API/Blob/text), [DataTransfer.files](https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/files). Saved command: `bun tests/ui/nocturne-grpc-theme.js --proto-component` with `INSOMNIUM_PROTO_MEASURE_SOURCE_ROOT=artifacts/proto-manager-measurement/root-source/src/lib` and `INSOMNIUM_PROTO_MEASURE_MANIFEST=artifacts/proto-manager-measurement/root-source-hashes.json`.

Handles: none; no app/browser/server/profile claim. Open: focus correction, field ownership review, native/OS/AT/schema replacement and full migration gates. `/compact` cannot be invoked by this agent interface; this is an explicit handoff, not a compaction claim.
