# Mixed query row order

Status: verified implementation, direct checks, full native URL/signing acceptance
and fresh generated-query regression.

Previously, legacy URL construction grouped ordinary query rows before generated
OpenAPI rows. An API-key append in the cURL encoding-off path also reserialized
the preceding query through URLSearchParams. Both could change the raw target
that authentication signs.

The transport now appends enabled row fragments in their displayed order when
generated or explicitly empty-name rows are present. Array expansion stays at
its originating row. Generated nullable omission and represented empty values
retain their existing serializer semantics. Manual rows retain the selected
legacy or form codec. An explicitly enabled empty name survives automatic
encoding. The API-key pair follows the row stream without reserializing it.

The source URL still uses the existing selected URL codec. cURL GET-derived
query data is appended to that source query before the ordered row stream.
Ordinary named rows without generated metadata retain their existing pipeline.
Generated allowReserved fragments keep their existing delimiter behavior.
The source URL, editor layout and CSS are unchanged.

Standards consulted before implementation:

- [WHATWG URL / URLSearchParams](https://url.spec.whatwg.org/#urlsearchparams):
  updating searchParams serializes the list using form encoding.
- [RFC 3986 query component](https://www.rfc-editor.org/rfc/rfc3986.html#section-3.4).

Verification so far:

- `bun run check`: 0 errors, 0 warnings after the final scenario assertions.
- Selected source/scenario Prettier checks pass.
- `query-order-expanded-direct.json`: eight literal target comparisons.
- `query-order-boundary-direct.json`: eight cURL GET/empty-name boundaries and
  52 comparisons against the committed legacy URL codec.
- `query-order-style-direct.json`: 33 existing style goldens in all four
  encoding/cURL contexts (132 targets), interleaved between manual rows, pass.
- `query-order-scenario-preflight.json`: all 82 planned signed/API-key targets
  match independent literal goldens before native execution.

The saved `tests/ui/url-encoding.js` retains 46 original signing regressions and
adds 32 ordered Hawk/OAuth cases across SHA1/SHA256, initial legacy/standard signing,
encoding on/off and ordinary/cURL contexts. Four API-key cases and three
original setting toggles bring the planned total to 85 wire targets and 78
signatures and eight legacy OAuth1 refusal/recovery controls. Its Hawk oracle
also rejects changing only the order of two pairs; OAuth verification retains
its standard sorted normalization. Ambiguous legacy OAuth1 queries must refuse
before TCP delivery. The saved UI explicitly selects RFC 5849 in Auth, verifies
that choice and the unchanged parameters across reload, and then sends the same
rows. Acceptance distinguishes the initial and effective signing modes.

Fresh production probe build: `bun tests/ui/build-recovery-copy-probe.js`,
started 1791522146028. Use its successful build record before running:

```powershell
$env:INSOMNIUM_UI_BUILD_STATE = 'artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/url-encoding.js
```

The corrected native URL run `url-encoding-1791524903364` finished successfully
on this build: 85 targets, 78 runtime signature assertions, seven checks and
eight pre-network legacy refusal/explicit RFC recovery controls. The independent
saved-wire audit rechecks counts, four API-key goldens, all 32 new signatures,
initial/effective signing modes, Hawk pair-order rejection and refusal records.
The native host exited0, its owned processes/profile closed, and the actual
wire fixture port52389 has no listener. No passing URL run was restarted.

The sequential saved `openapi-query-serialization.js` regression1791527884678
passes all44groups on OpenAPI3.2.1 and the same unchanged build (session86758
terminal0; started06:38:04.691Z, finished07:00:36.799Z). Independent-query-audit.json
checks33literal generated targets and11edit/runtime controls, including5
pre-network refusals. Saved assertions verify resources and reload without
resend. Both actual760px linked-help images and geometry were inspected. Native
51152 exited0/native-hidden/visiblefalse; Bun35200, native host, owned WebView
profile and actual wire listener56199 are gone. Selection recoveries0: the
conditional timeout recovery branch was not exercised by this accepted run.
This new run does not claim a fresh check of every other OpenAPI version.
Native scenarios remain `native-hidden`; saved
browser scenarios use the fixed headless helper. This document does not close
any broader migration, platform or UX/CSS requirement.

The first native attempt `url-encoding-1791522580937` failed at a composite
accessible-name lookup after reload. Its screenshot, text snapshot and owned
profile show the correct active GET request. The saved selector now matches the
exact descendant request name and retains method, unique-row, persisted active
ID and rendered-selection checks with a bounded 60-second reload wait. The
failed run is retained and its host/fixture listener closed.

The next attempt `url-encoding-1791522895225` reached 69 targets, completing all
46 original signatures and 16 new Hawk cases, then failed because its first new
legacy OAuth1 query was refused by the existing ambiguity guard. The fixture's
generated `empty=` duplicates the source URL's empty value, and cURL encoding-off
also introduces plus ambiguity. The failure screenshot/text and native
`oauth1.rs` guard confirm the required explicit RFC selection. That attempt is
retained as failed; its host exited0 and listener63527 closed. The saved scenario
now asserts all eight refusals and explicit persisted UI recovery instead of
waiting for a request that policy prohibits. The full corrected retry passed as
recorded above; the earlier attempts remain failures.
Production source/build is unchanged by these test-only repairs.

The first fresh generated-query attempt1791527266978 timed out at the shared
15-second persistence predicate after generation. Its screenshot shows33
requests, and the subsequently read owned profile has exactly33requests for
the precise sourceSpecId. Host exit0/native-hidden and fixture49309closure
were verified. The saved shared helper now allows60seconds for the same exact
sourceSpecId/count predicate; compiler0/0 and formatting pass. The full3.2.1
retry runs on the unchanged production build. URL acceptance remains valid.

The generated-query retry1791527558730 passed the generation wait and three
wire groups, then its15second click timed out after form-exploded-object had
already become the exact persisted/rendered active request. Screenshot and
owned profile confirm this. Native host exited0 and fixture57705closed. The
saved scenario now verifies unique source/name/method selection, skips restored
active rows, bounds clicks at60seconds and only records timeout recovery when
both persisted active ID and rendered class already match. Other errors fail.
Compiler0/0 passes. The full44group retry passed as recorded above; no passing
URL coverage was restarted and the production source/build remained unchanged.

Reproduce the saved generated-query regression after the same fresh build:

```powershell
$env:INSOMNIUM_UI_BUILD_STATE = 'artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_VERSION = '3.2.1'
bun tests/ui/openapi-query-serialization.js
```
