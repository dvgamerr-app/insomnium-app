# Accepted Spectral source catalog utility — 2026-10-12

Only NEW `src/lib/spectral-sources.js` and this report are deliverables. No ApiDesign/CodeEditor/native/runtime/dependency/test-script changes, browser/native/profile launch or URI fetch/file open. Parent owns accepted job/source/workspace/repository lifecycle and Generate policy. Root CodeEditor topic2f2746a and opaque client17ca33a remain separate.

## API

`createSpectralSourceCatalog(captured, hostSources, rawDiagnostics = [])` takes captured `{fileName,contents,files:[{name,contents}]}`, not the whole api_spec resource. Returns `{mainUri,sources,diagnostics,unresolvedDiagnostics,lookup(uri),diagnosticsFor(uri)}`.

- Canonical URI identity follows host memory/file/http/https policy, strips fragments and honors declared OpenAPI3.2 `$self`. Attachments resolve against the declared main URI and may themselves declare3.2 `$self`; older versions ignore that field. Existing yaml dependency and apiDocumentBaseUri are reused. Partial malformed YAML can retain top-level identity fields, matching measured pinned SDK behavior; identity conversion failures refuse rather than guessing.
- Main/attached host metadata must contain exactly uri/name/origin, and agree with identities and original names derived ONLY from captured input. Contents hydrate from that captured input. Every captured entry must appear once; duplicate declared identities, duplicate/noncanonical catalog URIs, missing/wrong metadata and injected main/attached contents refuse.
- Returned external entries contain uri/name/origin/contents only. Remote permits http/https, repository permits memory/file; name equals canonical URI. Contents come only from the returned catalog. No click-triggered fetch/disk resolution or fallback to private filesystem.
- Catalog and complete raw diagnostics are detached clones with frozen nested objects/arrays. Numeric severity0–3, optional code including0, full ranges, paths and extra raw metadata are retained. Invalid known diagnostic fields refuse. Lookup resolves URI references against accepted main URI and strips fragments; missing/unsupported/unknown source returns null or empty findings. Missing diagnostic.source is unresolved, never implicitly main. Unresolved diagnostics remain in the complete diagnostics array, so the parent can still display/count/error-gate them.

`spectralRangeOffsets(rawSource, range)` returns frozen `{start,end}` UTF16 offsets for default CodeMirror canonical LF text. It splits CRLF/loneCR/LF as pinned CM does, retaining BOM and astral UTF16 characters. Ordered nonnegative integer coordinates clamp to actual line/character bounds; malformed/raw-reversed or reversed-after-clamp ranges throw. No source mutation. Parent can pass offsets to current public setSelectionRange; it must retain source identity checks and handle refused navigation visibly.

`canonicalSpectralUri(name, base = 'memory:///')` is also exported for deterministic identity only. It performs no IO. Canonicalization mirrors the host's URL href keys; it does not invent percent-decoding/filesystem alias equivalence or repository permissions.

## Verification

Final manual Bun `--eval` receipt e48c40 exit0 has31checks:

- Eight URI identity cases compared with ACTUAL pinned Spectral Document/Yaml:3.1 ignore$self;3.2 relative fragment;HTTP/default-port/case canonicalization;file URI;HTTP retrieval+relative$self;partial malformed YAML;scalar input;merged YAML alias. Each also hydrates an attached source under the resulting base.
- Complete raw severity/code0/path/range/documentation data, same-named files in distinct directories, missing/unsupported source nonnavigation, returned remote/repository contents, caller-mutation isolation and nested freezing.
- Exact canonical UTF16 offsets/selected text with BOM/astral/CRLF/loneCR, empty document and oversized positions; five malformed/reversed cases.
- Eleven malformed/duplicate/mismatched catalog controls; duplicate captured declared identity; malformed diagnostic severity/code; an armed fetch refusal while external accepted contents are used. No network/native/UI operation.

`artifacts/spectral-sources-proof/final/manual-receipt.txt` is an ignored artifact containing the exact manual eval command body, not a new tracked test script. Replay with `bun --eval (Get-Content -Raw -LiteralPath artifacts/spectral-sources-proof/final/manual-receipt.txt)` from the isolated worktree; SDK imports point read-only to the root's pinned tools package. The fixture sources are owned synthetic data. Parent should rebind a copied command's SDK path if replaying from its different directory. No Node/npm/Python execution.

Initial29receipt815147/source3853de7a is preserved under v1. Compiler71559/6826e7 then reported two implicit-any helper parameters only; JSDoc annotations changed without behavior change. Final31receipt includes two additional diagnostic refusals. Final compiler51704/883aee passes0errors/0warnings. No build needed for this pure unused utility; application integration/build/native acceptance remain separate. All own handles terminal; no sources changed while checks ran.

Independent audit91a381 verifies current source/frozen copy/receipt and freezes dependencies. Imported openapi-document.js SHA96ce5790414a622eaede16c6d6623fec867b16a628ead6fdc007657402cde9d4 is byte-identical to current root. Dependencies snapshot records existing yaml/CodeMirror package identities, pinned SDK Document/Yaml parser and current host sourceDocument/catalog policy. These references are evidence only, no SDK import or new dependency in the utility.

## Exact guarded handoff

- NEW `src/lib/spectral-sources.js`:c8ece861c3b7371bd1de5b6bb94d23afc3f1ed847bb058c985743f7f28ac1b5f; root path was absent before integration.
- NEW this report: final SHA supplied in handoff.
- `final/receipt.json`:67cd7830edb5483763a22a4d6da03a9d19cfe01cb226795b044f79de7c013f4b.
- `final/manual-receipt.txt`:c8e90213638c6589213181839fc15fd12548483c44dea9b7ccb7ad7adb1574fd.
- `final/audit.json`:b0169e016bbec84028e5b7f93c0efb3e0667bcfeea30d15c6462be71ce039697; dependency hashes map to final/dependencies; output hashes map to final files; final/spectral-sources.js is the frozen source copy.

Official/pinned references read before implementation: [OpenAPI3.2 base URI/$self](https://spec.openapis.org/oas/v3.2.0.html#establishing-the-base-uri), [YAML Document/toJS API](https://eemeli.org/yaml/#documents), actual pinned Spectral Document/parseWithPointers and host sourceDocument policy, and CodeMirror5.65.21 lib/codemirror.js splitLinesAuto. Public [pinned CodeMirror source](https://github.com/codemirror/codemirror5/tree/5.65.21/src) supplies the corresponding implementation.

This verifies bounded pure catalog/range behavior, not full YAML/Spectral/dialect conformance or SDK/native acceptance. Root parent must still reject source/workspace/job/repository stale results, prove repository/ruleset generation, render/read-only navigate sources, error-gate Generate, preserve original structural worker and validate packaged host/privacy/platform workflows. No current full-root/Event runtime or full migration/UX completion claim. Original inline/Runner/lint/native proofs remain immutable. Root owns topic commit/STATUS; `/compact` is unavailable, so this is the explicit handoff.

## Root utility acceptance

Root independently rehashes every frozen source/output/dependency and replays SAME manual Bun eval body against currentroot utility/pinnedSDK:31checks exit0. Current compiler1256 terminal0errors/0warnings; earlier61750 reported only parent readonly-array prop mismatch, corrected by copying accepted array, not utility behavior. Root parent ApiDesign remains uncommitted and is not accepted by this utility checkpoint. Proof artifacts/spectral-sources-root-proof/root-audit.json. No browser/native/profile/fetch/testscript/dependency change; full parent/native/repository generation gates remain OPEN. Root handles terminal; /compact unavailable, explicit handoff.
