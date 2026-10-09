# OpenAPI 3.2 whole query parameters

Verified feature on release1791535554156 (finished1791535923874/result0).
This closes the supported whole-query gate only; the full migration/UX/CSS
objective remains active.

## Behavior

The generator retains `in: querystring` as one editable Query row. Its name is
only a label. Application/json serializes the entire JSON value without an outer
name; UTF-8 text preserves query delimiters and valid percent escapes; UTF-8 form
media serializes object members with existing form encoding rules. Empty text
and empty form objects preserve a bare `?`; nullable text/form null omits the
query, while JSON null remains represented. Editing preserves numeric and JSON
lexemes. Duplicate form member names refuse before network.

Compact serialization metadata retains relevant schema and encoding fields,
without copying a dereferenced schema graph. Effective inherited parameters may
contain at most one whole-query parameter and may not mix it with named query
parameters. Same-name operation overrides remain valid. Malformed parameter
entries produce strict-validator diagnostics rather than throwing in this
inheritance check. Unsupported media/byte/nested encoding remains reviewed and
runtime refused after clearing request-level review; disabling the row permits
recovery.

Linked Query help explains label, JSON/text and encoding semantics. Existing
editor layout is preserved. Chromium drops a represented-empty query through
the search setter; the composer preserves it through href parsing, including
fragments, existing bare queries and later ordinary rows. No native dependency
change was needed.

## Primary references and saved commands

References consulted before implementation:

- https://spec.openapis.org/oas/v3.2.1.html#parameter-object
- https://spec.openapis.org/oas/v3.2.1.html#extending-support-for-querystring-formats
- https://spec.openapis.org/oas/v3.2.1.html#encoding-by-name
- https://url.spec.whatwg.org/#dom-url-search

Run JavaScript tooling with Bun. Saved browser scenarios use the shared fixed
headless helper. Native scenarios hide their owned host before CDP attachment
and report `native-hidden`.

```powershell
bun run check
bun tests/ui/openapi-querystring-contract.js
bun tests/ui/build-recovery-copy-probe.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_VERSION='3.2.1'
bun tests/ui/openapi-querystring.js
$env:INSOMNIUM_OPENAPI_VERSION='3.2.0'
bun tests/ui/openapi-querystring.js
bun tests/ui/url-encoding.js
$env:INSOMNIUM_OPENAPI_VERSION='3.2.1'
bun tests/ui/openapi-query-serialization.js
```

## Accepted evidence

Five application source hashes in
`artifacts/playwright/openapi-querystring-source-freeze.json` match the final
release throughout all accepted native runs. No passing run was restarted.

- Saved headless contract:60 composer controls (14 media definitions across both
  URL/cURL settings, plus four empty-query boundaries) and four malformed
  parameter controls. Direct generation preflight112 across3.2.0/3.2.1,
  boundary7 literal targets/Git7, seven serializer refusals and inheritance4
  (three invalid/one valid override), signing-composition12 and malformed4 pass.
  Compiler has zero errors/warnings; selected formatting and diff checks pass.
- Native3.2.1 handle68209/artifact1791535934518:
  08:52:14.907Z–09:06:10.240Z, terminal0/passed.
- Native3.2.0 handle63902/artifact1791536829429:
  09:07:09.440Z–09:20:56.368Z, terminal0/passed.
  Each version passes25 groups,18 raw targets,7 pre-network refusals,
  14 metadata rows and four linked-help layouts. Independent audits check
  literal wire, persistence/reload and frozen hashes. All eight actual760px
  images were inspected. Native28036/52392 exit0/native-hidden/visiblefalse;
  owned processes/profiles and actual fixtures52539/59515 are released.
- Signing handle23182/artifact1791537744405:
  09:22:24.415Z–10:41:13.227Z, terminal0/passed,
  165 raw targets/158 signatures/8 checks.
  The saved scenario retains78 signatures and adds80 whole-query controls:
  48 JSON/text/form with source queries plus32 represented-empty text/form
  queries, across Hawk SHA1/SHA256 and RFC5849 OAuth1 HMAC-SHA1/SHA256,
  both URL encoding and cURL settings.
  Independent saved-wire audits recompute all80 new signatures (40 Hawk,
  40 OAuth),32 retained ordered-query signatures,4 API-key controls and
  8 legacy OAuth1 refusal/recovery controls. Empty-query Hawk MAC differs from
  absent-query MAC; OAuth canonicalization does not distinguish these.
  Native51072 exit0/native-hidden/visiblefalse; Bun/native/profile processes
  and actual fixture62697 are released.
- Retained named-query3.2.1 handle75394/artifact1791542745015:
  10:45:45.027Z–11:09:57.317Z, terminal0/passed.
  Independent audit verifies33 generated cases/11 edits/5 refusals, two help
  geometries/760px PNG widths and frozen hashes. Both actual PNGs were inspected.
  Generation/selection recoveries0: timeout-recovery branches are not exercised
  by this accepted run. Native51400 exit0/native-hidden/visiblefalse;
  Bun51196/native/profile processes and actual fixture58767 are released.

Artifact paths are under `artifacts/playwright/`. Independent audit filenames:
`independent-querystring-audit.json` in each core native artifact,
`independent-querystring-signing-audit.json` and
`independent-querystring-ordered-regression-audit.json` in the signing artifact,
and `independent-query-audit.json` in the retained named-query artifact.

## Retained failures and harness corrections

The baseline omitted three supported media. Initial direct style-array golden
incorrectly expected whole-array expansion; corrected to the documented3.2
per-item rule without changing product behavior. Initial JSDoc errors were
corrected. The inline preflight's unused settingImportedFromCurl flag was
replaced by actual _curlSource;112 controls reran. Saved browser controls already
used the correct flag.

First release1791534153396 (finished1791534524353/result0) was superseded:
native16916/artifact1791534546737 failed after three supported groups when
empty text lost its trailing `?`. All three available760px images were inspected;
owned host/profile/fixture64801 were released. The saved headless contract
reproduced8 empty-query failures before the href repair. Bun URL behavior alone
did not expose the Chromium bug.

Release1791535131083 (finished1791535500827/result0) was also superseded after
the malformed-null inheritance guard. Its build became terminal before that
source fix. Final release1791535554156 includes both repairs; no acceptance is
claimed for superseded releases.

Retained-query80355/artifact1791542518304 failed before any query group,
10:41:58.316Z–10:42:57.571Z: New document click timed out15s after delivery.
The inspected failure image and exact owned persisted state show one created,
selected default document. Owned Bun34296/native52312/profile/listeners were
released. The saved generation helper now checks one newly created owned spec,
active workspace, selected document, mounted contents and final edited-source
identity. Only a Timeout may recover through those checks; it never clicks
again and records recovery when output is available. Application source was
unchanged. The subsequent accepted75394 run uses this helper's normal path;
its timeout-recovery branch remains unexercised.

## Remaining scope and handoff

Modern Example Object dataValue/serializedValue/external examples, non-UTF8 and
broader media/byte coverage, full schema constraints/precision/refs, saved
generated-resource migration, provider/platform interoperability and every
remaining original PLAN/PARITY migration gate remain required. Subsequent
centralized UX/CSS and redesign follow full migration completion per
POST-MIGRATION-UX.md. This feature is not full parity.

Commit verified work by topic and record the implementation commit, evidence,
remaining gates and live handles in STATUS.md before the next feature.
This interface has no callable `/compact`; provide the committed handoff
instead of claiming compaction. All feature-owned handles are terminal.
