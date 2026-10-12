# Deliberate recovered Cargo archive admission proposal

2026-10-13. Read-only proposal against rootd63426d6c462a7cf1ae4b900e17fd646f4c94c75 after accepted collectorb61425a. No root/cache/source/profile mutation, collection, build, native/browser launch or SDK/provider investigation. Only this report and isolated STATUS are committed. Root reviews and executes the future operation; /compact unavailable, explicit handoff.

## Guarded inputs and observed destination

Root recovery receipt21d82d6f97c1aae7b878895bc76b116312d649d732c76c9fb8f5788d5a6a48f1 pins Cargo.lock5156ae8fa74230bd84ddf53706b8961a5e4d6c14e7069138394c1ccc5d782873, parser8e1e9e3f30505caf1312c52efb78a27d43e7c67614c07766228e769889234fdb and official registry configuration. The current root parser matches that pin. Its three archives contain five selected raw texts; entire entry hashes and published manifest identities are recorded. No package source is executed.

| Fixed archive filename | Bytes | Exact locked archive SHA256 |
| --- | ---: | --- |
| openssl-probe-0.1.6.crate | 8128 | d05e27ee213611ffe7d6348b942e8f942b37114c00cc03cec254295a4a17852e |
| tree_magic_mini-3.2.2.crate | 16074 | b8765b90061cba6c22b5831f675da109ae5561588290f9fa2317adab2714d5a6 |
| wl-clipboard-rs-0.9.4.crate | 48458 | 4d7888ccd4896447b2d14d3a9350a85df2aeb6f181e2e7a31349d104ac46cac1 |

Source bytes stay in root `artifacts/cargo-missing-source-root-proof/archives/`. Total72660 bytes; no redownload or generic license substitution is needed.

Observed `CARGO_HOME` is `D:\home\.cargo`. Its cache has one regular namespace, `index.crates.io-1949cf8c6b5b557f`; all three destination filenames are absent. Cargo home/registry/cache/namespace directories have no observed reparse/link attribute. The matching local index config declares `dl: https://static.crates.io/crates`, agreeing with the recovered official config. Destination for this machine is therefore:

```text
D:/home/.cargo/registry/cache/index.crates.io-1949cf8c6b5b557f/openssl-probe-0.1.6.crate
D:/home/.cargo/registry/cache/index.crates.io-1949cf8c6b5b557f/tree_magic_mini-3.2.2.crate
D:/home/.cargo/registry/cache/index.crates.io-1949cf8c6b5b557f/wl-clipboard-rs-0.9.4.crate
```

This is an observed namespace, not a universal Cargo naming rule. Cargo documents compressed cache archives, source extraction and an unstable internal home layout. [Cargo home](https://doc.rust-lang.org/cargo/guide/cargo-home.html). Registry index configuration defines downloads and archive checksums. [Registry index](https://doc.rust-lang.org/cargo/reference/registry-index.html).

## Proposed root-only cache operation

Use a new owned Bun artifact script after review; none is implemented or run here. Input surface is closed to these three exact names/versions/checksums, the frozen receipt, current lock and explicit observed Cargo home/namespace. Reobserve canonical paths with realpath/lstat immediately before writes. Reject changed lock/parser/receipt/archive identities, links/reparse aliases or an unreviewed namespace. Do not read or modify Cargo credentials, index contents, manifests, source trees or unrelated cache entries.

1. Acquire an exclusive preparation window with no Cargo, collection or cache writer in flight. Record actual `CARGO_HOME`, namespace directory identity and current native public/private receipt/current marker hashes.
2. Independently rehash all three source archives, confirm current lock name/version/source/checksum, and reparse with the pinned data-only parser to compare published manifests and selected raw bytes to the recovery receipt before writing any entry.
3. Enumerate every current cache namespace exactly as the accepted `registryArchive` helper does. For each fixed filename, any existing candidate must be a regular file whose full bytes/count/hash equal the recovered source. Identical duplicates across namespaces are admissible; any conflicting candidate or symbolic namespace fails. Do not delete/repair conflicts or change collector namespace discovery.
4. If the chosen destination already exists with exact bytes, record `existing-equal` and skip writing it. Otherwise stage a new regular file inside the same cache namespace using exclusive creation, then close and verify its complete bytes. Its temporary name must not match a package `.crate` filename.
5. Publish without replacing a destination: a same-volume hard-link from the owned staged regular file to the fixed final filename gives an exclusive creation result. If EEXIST occurs, recheck the existing final entry and accept only exact bytes; never rename-overwrite or force-copy. If the filesystem cannot perform this publication, stop for a reviewed alternative rather than falling back to replacement. The archive parser's refusal of tar link entries is separate from this host-side regular-file publication.
6. Rehash all final entries and rescan the three filenames across all namespaces. Record per-entry created/existing-equal status, canonical paths, bytes and digest. Remove only the task-owned staging names after successful close/publication; no recursive cleanup or removal of preexisting entries. On failure preserve a precise per-file receipt, leave current notice generation unchanged, and start no collection/build. A retry can verify any already published equal entries and finish the remaining set.

No `registry/src` extraction, Cargo fetch/vendor/build, package execution, dependency/lock modification or collector scope change is required. The accepted collector consumes archives directly and independently verifies locked bytes. Copying only LICENSE files into notice resources or private source snapshots would bypass the reviewed collection path and is excluded.

The proposed link operation uses filesystem compatibility APIs under Bun; Node is not executed. The API creates a filesystem link, and Windows requires source/destination on the same volume. Actual Bun/filesystem support must be verified during the later owned operation, which has not run here. [Filesystem link API](https://nodejs.org/api/fs.html#fspromiseslinkexistingpath-newpath), [Windows hard-link contract](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createhardlinkw).

## Availability and generation transition

Inserting cache bytes alone must leave current accepted notice files, private admitted receipt/current marker and producer stamp unchanged. Default bundle validation reads selected immutable private archives/receipt, not ambient cache, so cache insertion neither stales nor promotes the recorded762-source generation. Preserve all old3-cache-miss receipts as authentic historical observations.

Root may then deliberately collect once in a separate recorded operation using the existing hook's actual default cache. Ensure its process receives `CARGO_HOME=D:/home/.cargo` explicitly: the generator uses this environment value, otherwise it falls back to homedir/.cargo. Namespace writes and future hook must resolve to the same actual home. The accepted target remains explicit through `TAURI_ENV_TARGET_TRIPLE=x86_64-pc-windows-msvc`.

Future root commands, not run here:

```text
# After the guarded three-entry insertion and independent receipt review:
bun scripts/tauri-spectral-hook.mjs build
bun scripts/tauri-spectral-hook.mjs bundle
```

The build hook intentionally regenerates native preparation before frontend startup; it copies the three verified new archives into private source authority and publishes a new admitted receipt/current marker. Bundle remains validation-only/no fetch/no child. Do not hand-edit current markers, receipts, aggregate output or producer provenance. Publication failure retains/refuses according to existing rollback/correctness gates.

With all other inputs unchanged, expected data transition is765 verified registry archives instead of762;1336 registry text origins instead of1331; four vendor and one project-context origin remain, giving1341 total text origins. Unique text blobs are expected422 instead of420: the two Apache origins share existinga60eea81 bytes, openssl MIT378f5840 already exists, and tree_magic_mini a7cea8a5 plus wl-clipboard MITd0235d2a add two unique hashes. This prediction comes from comparing recovered raw hashes with current420 entries, not from collection or linkage inference. Exactly these three rows change source availability;43 registry discovery gaps/two local gaps remain. Lock identities remain770; incomplete/nonblocking coverage and unproven target/build/linkage/platform/legal completeness remain unchanged.

## Acceptance before a new claim

- Verify cache-only insertion does not change the accepted generation/current pointer and that bundle-only validation still accepts that historical generation without cache rescanning.
- After deliberate recollection, independently compare each new admitted manifest/VCS/text against its locked private archive and all five raw origin hashes; retain both origins for shared Apache bytes. Confirm all765 archive authority inputs/current receipt and exact generated output freshness.
- Preserve47 historical proof and all coherent text/availability/old-receipt negatives. The current saved real-corpus assertion is deliberately762/three misses: after actual data admission, a future root-reviewed data-transition supplement must pin exactly these three recovered identities/hashes and the expected delta. Do not relax assertions to arbitrary counts, overwrite the old proof or silently relabel its generation. Existing cold-cache/helper/order/tamper/rollback semantics and SAME185 Spectral checks remain mandatory.
- Freeze source/env/cache insertion receipt/private/new output hashes and failed-case evidence before root packaging acceptance. Current source proof remains source-corpus evidence; no Windows-linked, native app/resource-copy/installed/full-coverage claim follows from admitting these archives.

The isolated proof captures current root input hashes, all16 recovery files, observed namespace/three absent destinations/local index config/current admitted receipt and a raw-hash delta receipt. Root code/cache/profile and prior frozen proofs remain untouched; own handles: none.
