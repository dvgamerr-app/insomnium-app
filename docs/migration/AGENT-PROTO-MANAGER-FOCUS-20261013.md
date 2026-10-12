# ProtoManager Cancel focus correction — 2026-10-13

Focus-only correction, following root review of the immutable 102-receipt measurement and twelve Cancel→BODY failures. No Field, error, CSS, persistence, backend or API changes. The old audit `f4035351c81c4dbecd30cd741c08733b1daee09c5f369031e9a3de593db0ccf5` remains unchanged.

`src/lib/components/ProtoManager.svelte` records the originating actual file input, raw workspace-data identity, collection/request ID and selection epoch. Discard cancels existing work as before; it restores focus only when the originating Cancel owned focus, the selection was still current, Svelte has rendered its removal, the component remains alive, ownership identities/epoch still match, the picker is connected/enabled, and focus is BODY. Another operation or focus destination prevents restoration. Existing FilePicker/input sizing, default keyboard behavior, file limits and data guards remain unchanged. Destruction still disposes the existing work scope and marks the focus continuation retired.

[Official Svelte lifecycle documentation](https://svelte.dev/docs/svelte/lifecycle-hooks) documents tick for waiting until pending state changes are applied and onDestroy for component retirement. These existing public APIs provide the necessary render/lifetime boundary; no timeout, observer, transport modification or private API is added.

## Verification and fidelity

SAME `nocturne-grpc-theme.js --proto-component` final session19059 exits0: all original102 receipt categories and assertions retained, plus36 same-task scripted focus-retirement controls across dark/light1440/900/760×600. The twelve actual focused Cancel Enter cases now additionally require the exact original picker ID to own focus. Additional controls cancel then, before tick continuation, focus another button, select requestB, replace data, unmount, change tab, or start a newer owned read. They assert no old-picker focus and unchanged resources/history; the newer read remains active and completes with its own filename. These extra race controls use scripted DOM initiation and actual workspace/Svelte behavior, not trusted physical-user or native timing claims.

All six normal panel/control rectangles, fonts, colors and backgrounds equal the frozen negative exactly (`geometry-guard.json`). Original invalid-path/error ownership observations remain diagnostic/open; no correction to them is included. Actual browser File.text success, owned-instance rejection/pending controls, keyed production parent semantics and browser persistence remain as previously documented. Native/OS/schema replacement acceptance remains separate.

Final compiler53545 exits0/0errors0warnings; own Bun build exits0. SAME saved full design-system session14010 exits0, preserving original shared-control assertions. Approved ignored preview supplement5493 was used for verification and restored to3839; it is not offered. These local verification gates do not claim a newly captured complete current-root runtime/native generation.

Preparation negatives remain: direct DOM disabled manipulation was rewritten by Svelte's authoritative disabled prop and was removed as a nonauthoritative fixture control; production still explicitly checks actual disabled state. A nullable picker ID compiler error was corrected by asserting the actual stable ID before its DOM lookup. A PowerShell in-memory Hashtable rehash enumeration receipt was invalid and archived; the corrected independent check parses the serialized manifest and uses fail-fast file verification.

## Guarded handoff

New manifest `artifacts/proto-manager-focus-fix/final/audit.json` SHA `4eef3d3ecbec3952788cc997bbccc84dd2457f7ff1db8ec27e48fd41e3fe26e6`; `independent-rehash.json` verifies290/290:

- sourceHashes → `final/source/<path>`:255 captured cba source files, only ProtoManager changed.
- harnessHashes → `final/harness/<path>`:7 actual product/test/support files.
- outputHashes → `final/output/<name>`:15 final receipts/screenshots/result files plus the retained predecessor failure.png (not a current failure).
- bundleHashes → `final/bundle/<name>`:2 emitted component fixture files.
- verificationHashes → `final/verification/<name>`:10 logs, geometry and whole-native-entry guard, before-source/helper snapshots and shared scenario result.

Raw root ProtoManager before SHA41b33de8 is archived in the immutable measurement root-source; own pre-edit bytes in `final/verification/ProtoManager-before.svelte` compare whole-file LF equal. Root capture is cba1524; later unrelated certificates/root native artifacts are not adopted or claimed. SAME native entry remains byte-identical to the accepted measurement entry; its full original entry inverse remains guarded. Only two source/test paths plus this report are offered:

- ProtoManager new SHA `50c24cb751bf261ecce6c47a01e2eb753a6ba474dcf99936917a25e84434bd30`.
- reusable component helper new SHA `ae9693a7a26ca6a3d3a7ab059d45543d53dd9abbedb9ca9e20c9f5713ac12425`.

No browser/server/build/check handles remain; no root/native/profile/cache mutations or claims. Native keyboard/OS/AT and field feedback ownership/full migration gates remain OPEN. `/compact` is unavailable in this agent interface; STATUS and explicit handoff record the feature boundary instead.
