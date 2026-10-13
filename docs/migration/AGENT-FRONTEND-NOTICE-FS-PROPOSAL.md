# Archive-bound frontend notice filesystem candidate

This is an isolated source-only candidate, not Root adoption or collected upstream package evidence. It implements private archive/admission authority, publication and rollback around the frozen pure collector, plus proposed CLI, build/dev hook and public resource integration. Root remains unchanged. No actual locked npm archive was acquired. The owned model with Root's exact lock has 283 explicitly unavailable identities and zero texts. Installed CodeMirror LICENSE bytes remain evidence only, never archive authority.

## Inputs and proposed paths

`artifacts/frontend-notice-fs-proposal/root-before.json` pins exact Root hook, Tauri config, ignore, lock and package bytes. The six original hook/helper prerequisite pins are in `hook-fixture-receipt.json`. Whole hook/config inverse and append-only ignore reversal recover original bytes. The unchanged 31-file collector offer is independently rehashed against manifest `077935a786c89a0787f3355104024c10b61d4e39fcf20029c87a28497f498ea2`; Universal37 stays separate and unchanged.

The offered `adapter.mjs` reads only an explicit canonical provided-source manifest at `artifacts/frontend-notice-provided/admission.json`: schema1, current lock SHA and unique locked IDs with relative `.tgz` paths inside that directory. Absence means an empty set, not an ambient cache scan. SHA512 SRI, bounded gzip/tar, package name/version and original raw files are checked by the unchanged collector before admission.

Private authority is `artifacts/frontend-notice-private/archives/<SHA256>.tgz`, `admissions/<receipt-SHA256>.json`, and canonical `current.json`. Archives and receipts are published without overwriting existing bytes using an exclusive temporary file plus same-volume hardlink; an existing exact file is accepted, any conflicting bytes refuse. Validation reopens immutable archives and reconstructs the receipt and every public output from the actual current lock/source identities. Rewriting public receipts, hashes or stamps cannot supply missing original archive authority. Validation does not consult newly available provided files, so mere source availability cannot promote a frozen historical generation.

Public outputs are `src-tauri/notices/frontend/`, including exact collector assets and `preparation.json`. Only this directory is added to the Tauri resources mapping. Private archives/admissions/stages stay outside packaged resources. Proposed ignore change adds only `/src-tauri/notices/frontend/`.

## Publication and failure scope

Generation prepares an exclusive UUID stage, verifies its exact public set against private originals, then rechecks consumed source bytes. It moves the old public tree into the owned stage, publishes the new tree and updates the private current marker only after checking that the old marker and sources are unchanged. Final validation reparses original archives and confirms all public bytes. Successful and publication-failure receipts retain the observed states and previous marker hash.

The three saved fault points—after moving old public, after publishing new public and after changing the marker—each restore the exact old public tree and marker. Old private admissions are retained. Rollback refuses a foreign marker and reports a partial failure rather than overwriting unrelated ownership. There is no recursive deletion or cleanup of old generations. This is not a multi-file transactional or hostile concurrent-writer guarantee: intermediate state refuses validation. Failures during private admission or staging before entering publication may leave owned immutable/staged files without a publication receipt. Those leftovers are retained and must not be described as successful publication.

Ordinary/canonical checks reject source junctions and traversal. A drive-root spelling exception is restricted to an already checked ordinary absolute root whose realpath is the same bare drive. It does not admit arbitrary drive-relative paths.

## Source-only adoption boundary

The adapter deliberately admits project roots only below its own `fixtures/` directory. Literal Root generation refuses before reading project data. It is therefore not a production drop-in. Root must independently review any replacement with a closed, explicitly authorized Root frame, source ownership and publication policy. The library `fault` injection is fixture-only and must remain outside ordinary production inputs.

Current physical source layout is `adapter.mjs` beside `core/collector.mjs`, `core/tar-parser.mjs` and frozen JSONC parser bytes. Receipt source labels are portable logical identifiers `scripts/frontend-notice-fs.mjs` and `scripts/frontend-notice-core/...`; they are not assertions that these paths were installed in Root. Adoption must explicitly map actual module/core paths and source-table labels together, preserve the exact parser package/code/licensing provenance, and recheck freshness. No dependency/lock update or new installed parser was performed.

CLI is `bun adapter.mjs generate|validate <absolute-owned-project>`. It has no acquisition command. Hook defaults pass the explicit project root; no-argument helper invocation is not supported. Build/dev propose producer → original Spectral notices → original native notices → frontend generation → original producer stamp → original Spectral/native validation → frontend validation → original frontend child. Removing the two new frontend service calls yields every original service argument/order unchanged. Bundle runs the original two validations then frontend validation, with no generation or child command. A frontend generation failure prevents stamp/front-end startup; stale bundle output prevents bundling.

## Saved evidence and reproduction

Run in the isolated worktree only:

```powershell
bun artifacts/frontend-notice-fs-proposal/prepare.mjs
bun artifacts/frontend-notice-fs-proposal/check.mjs
bun artifacts/frontend-notice-fs-proposal/hook-check.mjs
```

These scripts write their own new fixture/artifact directories; they do not authorize Root execution. Do not rerun them into a frozen proof directory. `prepare.mjs` originally hit an owned mixed-separator `copyFileSync` ENOENT; resolving the destination/source paths fixed preparation. The negative occurred before Root action. Earlier adapter/18-check artifacts remain separately retained under diagnostics and historical fixture directories; their old module-source identities are not relabeled as the final candidate.

Final saved `fs-fixture-receipt.json`: 20 checks, including empty admission, deliberately supplied synthetic locked tar, deterministic exact skip, three rollback boundaries, archive/public/marker/lock tamper, provided traversal, source junction refusal, literal Root refusal, old private admission preservation, cold283, and fresh subprocess validation-only. The synthetic tar contains a non-grant fixture notice with BOM/CRLF, not a real package license. Fresh CLI PID64952 exited0; exact public/private bytes were unchanged across validation. `hook-fixture-receipt.json`: six mocked groups, all old args/order unchanged, both generation failure paths and stale bundle refusal; zero real child commands. Latest source and all five Root input guards plus six helper pins are rehashed in `final-guards.json`. The first final guard projection incorrectly read `cli.code`, refused, and was corrected to the actual saved `cli.exitCode`; original finalizer source and the preparation-refusal record are retained. No fixture assertion/output was changed by that correction. No browser, app, compiler, build, network, cache or SDK/provider operation ran. Live handles: none.

Filesystem API references were consulted from local primary Node type declarations under Bun for `writeFile`, `link`, `rename` and `realpath`, alongside the existing reviewed native notice collector. Primary documentation links: [Bun Node compatibility](https://bun.sh/docs/runtime/nodejs-apis), [Node filesystem API](https://nodejs.org/api/fs.html), [Tauri resources](https://v2.tauri.app/develop/resources/). No network request was made for this topic.

## Remaining gates

Root review/adoption and real locked archive acquisition/admission remain open. Actual installed/emitted frontend dependency role and target linkage, full raw notice/per-file coverage, CodeMirror published archive authority, library/runtime redistribution coverage, every platform/signing/update gate and full migration remain open. Missing sources are explicit nonblocking inventory rows; malformed/source/hash/read errors fail. No legal completeness claim or fabricated/SPDX-template text is introduced. `/compact` is unavailable in this interface; the topic commit, immutable manifest, evidence, gates and no-handle state provide the handoff.
