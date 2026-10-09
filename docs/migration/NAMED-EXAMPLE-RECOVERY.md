# Named example levels and edited-source recovery

Verified scope below; full migration/UX/UI/CSS remains active. This extends the saved
named-example scenarios from implementation3cdbd18/checkpoint636ed50. App code
has not changed in this topic.

Official references consulted before the work:
[OpenAPI 3.2.1 Parameter Object](https://spec.openapis.org/oas/v3.2.1.html#parameter-object),
[serialization and examples](https://spec.openapis.org/oas/v3.2.1.html#serialization-and-examples),
[3.0.3 parameters](https://spec.openapis.org/oas/v3.0.3.html#parameter-object) and
[3.1.0 parameters](https://spec.openapis.org/oas/v3.1.0.html#parameter-object).
The modern dual-level cases distinguish parameter representation from media
representation and preserve the named map's referenced objects.

`bun tests/ui/openapi-named-examples.js` currently passes108checks/28controls and
six dark/light1440/900/760 actual shared-control profiles. New24checks cover
3.2.0/3.2.1 with same-named referenced root/media dataValue, serializedValue and
externalValue examples, default/explicit choices and source immutability. An
explicit root false remains false beside a media true; serialized/external
media JSON retains the unsafe numeric spelling before outer URL encoding.
Shared dropdown values distinguish the two levels. `bun run check` is0/0;
selected formatting/whitespace passes. Independent headless audit:
`artifacts/playwright/openapi-named-recovery-headless-audit.json`.

Reuse `bun tests/ui/openapi-named-example.js` for native acceptance; set
INSOMNIUM_OPENAPI_VERSION to each version. It adds modern competing-level choices,
then edits the actual CodeMirror source to remove the selected body example,
checks unavailable-choice Field feedback and worker refusal without resource
writes, corrects the choice, generates one new set while retaining original
requests, sends corrected JSON bytes, checks Git and resets choices. Source
comparison expects exactly the owner's edit, not an unchanged original document.

Production build59214 is reused because all462app hashes equal its accepted
source, build state equals the original successful record and exact executable
SHA-256 is a665b19e4b77872f0d1e9d588b03ab51e9083332312fc49c47002cf6199c4541.
New freeze `openapi-named-recovery-source-freeze.json` records those app hashes
and206 executable/fixture scenario hashes, excluding documentation README.
No scenario/app edits may occur during a live acceptance handle.

Retained first failure: native68913/artifact1791574555002 terminal1/native49780
exit0/native-hidden. The fixture expected a whole Git-decoded object to equal
the live resource, but canonical Git adds type:ApiSpec; request Git also omits
local _openapiIssues. Expected canonical metadata now matches the existing
codec's format without weakening field comparison or changing the codec. Failure
image inspected; owned49780/profile/listener59898 absent. Original freeze archived
with -first; scenario corrected only after the original handle was terminal.

Current native3.2.1 rerun17085/artifact1791574925196 terminal0/native36536/port63002:
8 Sends,14generated requests,6profiles and1worker refusal without writes. Recovery
audit verifies exact method/target/base64/SHA/header/cookie, original-resource
preservation, authored edit, corrected provenance, canonical Git and frozen
source/executable. Owned cleanup passes. Actual light760 image inspected.
The remaining current runs also pass:

| Version | Artifact suffix | Handle | Native PID | Fixture port | Sends | Generated |
| ------- | --------------- | ------ | ---------- | ------------ | ----- | --------- |
| 3.2.1   | 1791574925196   | 17085  | 36536      | 63002        | 8     | 14        |
| 3.2.0   | 1791575168203   | 37940  | 49260      | 58392        | 8     | 14        |
| 3.1.0   | 1791575401274   | 18512  | 60900      | 51912        | 5     | 8         |
| 3.0.3   | 1791575612022   | 3011   | 58432      | 52682        | 5     | 8         |

Every actual handle reached terminal0/native-hidden/visible:false/nativeexit0,
totaling26 Sends,44 generated resources of request type,24 native control profiles,
4 refusals without resource writes and4 corrected Sends. Per-run
recovery-independent-audit.json checks all payload groups, exact author's source
delta, canonical Git, preserved original resources, current668 hashes and exact
executable SHA. Final openapi-named-recovery-final-audit.json passedtrue combines
all4 runs with headless108/28/6. Both individual cleanup audits and final
openapi-named-recovery-cleanup-audit.json confirm all owned PIDs/profiles/listeners
are absent. No live feature process handles remain.

Current3.2.1 light760 and3.2.0/3.1.0/3.0.3 dark760 actual images inspected; no
arbitrary-viewport/full-UI claim. Source/app/CSS ownership is unchanged from the
accepted3cdbd18 implementation. No fresh build was required or claimed in this
topic; acceptance reuses the explicitly matched production release above.

This does not prove arbitrary viewport, OS-close/file-dialog/provider/platform
acceptance, native custom-method selection, every older content/example policy,
nonUTF8/external locations/base/fragment/media/charset/schema/resource policies
or the full original migration/UX/CSS. These gates remain required. /compact is
not callable in this interface; STATUS will hold the feature handoff.
