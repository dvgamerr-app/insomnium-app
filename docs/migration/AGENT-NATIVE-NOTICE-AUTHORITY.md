# Native notice source authority correction

2026-10-13. Isolated correctness fix to collector candidatece9dca7 after root review; no root notice adoption yet. Original2741-file manifest201dc4c205ec8b3a3831b61e1ea72c05f4b727a817da48515b1cc1a700087092 and its37 passes remain unchanged. No root/product/backend/permission/protocol/dependency/producer changes, builds, apps, native/profile/browser launches or SDK/provider investigation. /compact unavailable; explicit handoff.

## Actual negative and paired acceptance

The original validator accepted a coherent replacement of shlex2.0.1 LICENSE-APACHE: original566 bytes/SHA553fffcd9b1cb158bc3e9edc35da85ca5c3b3d7d2e61c883ebcfa8a65814b583 became labeled60-byte structural test data/SHAa008c01a097f0c6a4039ea80cd7f15bd8b983a0b49de068192c08f982c149222. Public receipt/blob/inventory/notices/stamp hashes were all recomputed, while actual lock, project/policy inputs and archivef8fadd59c855ef2080decdef8ff161eb6661b86933c9d82e5ba29dc602a55aba remained unchanged. This is a reproduced defect, not an inference.

Evidence `artifacts/native-notice-authority-proof/original-negative.json` SHAcef1873c42b9c05da37e3b0db75754fd44b72dda0ddddd79b95ef13c69b5da65 captures original acceptance. `before/scripts/` preserves actual original implementation/dependencies. `reproduce-original-frozen.mjs` repeats the original acceptance using that frozen implementation and saves a separate receipt; it leaves the first negative unchanged. Initial `reproduce.mjs` records the exact original live-code program and is retained unchanged.

The fixed validator replays that exact original valid and altered generation with explicitly supplied verified private archive/receipt inputs in the owned test fixture: the original passes, the same altered generation fails `Native text bytes differ from authoritative source`. It does not merely reject stale project inputs or a missing private file. New SAME saved audit also refuses coherent local http-auth and workspace LICENSE rewrites with every public hash recomputed.

## Independent binding

Collection first checks archive SHA256 against actual Cargo.lock, parses the package data and selects authentic bytes. It retains that exact archive under private content-addressed `artifacts/native-notice-source-snapshots/<lockSHA>.crate`. Existing bytes are never silently overwritten; mismatch/read/write errors fail. The validator reads these selected private inputs, checks their actual byte count/hash against the locked checksum, reparses them and compares the exact manifest/VCS and full discovered/declared text set and bytes to admitted blobs. A claimed checksum in JSON cannot authorize changed bytes. It does not read ambient cache, fetch packages or execute source.

Local patches bind current approved tree digests and directly compare selected bytes against those trees; project-context manifest/LICENSE directly match current guarded project inputs. No registry checksum is invented for local/workspace sources. Project identity is rechecked at the end of validation.

An intermediate archive-only fix passed body checks but a further actual probe accepted a coherent available-to-source-unavailable downgrade. Its unchanged private archive still existed; removing the public manifest/text references skipped those comparisons. `admission-state-before-ledger.json` retains this separate negative.

The collector therefore retains the canonical captured collection receipt outside resources at `artifacts/native-notice-admissions/<receiptSHA>.json`, with a collector-owned `current-<target>.json` marker identifying the current generation. Validation compares the public receipt to that independently recorded private receipt/current identity. The saved rollback case deliberately reconstructs the earlier cold-cache receipt, which genuinely exists privately; it still refuses against the current warm marker. Thus an old valid receipt cannot silently replace current captured availability.

Stage validation uses a host-only explicit digest for the newly verified candidate receipt, before current resource publication. After successful resource replacement, the collector atomically renames the new current marker into place. Marker-publication failure restores prior resource bytes; saved injected malformed-marker test verifies that behavior. Temporary publication gaps refuse validation. No whole-filesystem transaction or signed/hostile-filesystem attestation is claimed. Private source/receipt inputs are collector-owned trusted preparation evidence, distinct from mutable packaged output.

## Policy and scope preserved

Cold-cache unknown preparation still succeeds. Cache addition/eviction neither promotes nor invalidates a recorded generation. Only explicit collection changes availability/current marker. Missing/corrupt declared private archive, receipt or marker is a correctness failure; incompleteness remains nonblocking. No automatic fallback to ambient cache or new completeness blocker.

Only license/metadata blobs and assembled inventory/notices/stamp remain in Tauri resources. Hundreds of source archives/private receipts stay under ignored host artifacts, outside the resource mapping. Producer stamp, hook relative order and bundle validation-only/no-child behavior stay unchanged. No native SDK or dispatcher/permission surface changes.

Actual source inventory is unchanged:770 lock identities/762 archived sources/1331 registry+four vendor+one labeled project-context origins/420 unique raw text blobs; three cache misses/43 registry discovery gaps/two local gaps remain. Root separately recovered three official archives, but this frozen candidate does not consume/promote them; deliberate recollection is a later topic. Target/build profile/features/linkage, nested/per-file/system/toolchain/local provenance/platform/distribution/full legal coverage and all migration gates remain open.

## Saved verification

```text
bun artifacts/native-notice-authority-proof/reproduce-original-frozen.mjs
bun tests/packaging/native-notices.mjs
bun artifacts/native-notice-authority-proof/replay-original-with-admission.mjs
bun tests/packaging/spectral-notices.mjs
```

SAME native audit preserves all original37 checks and adds10 authority checks (47 total): three coherent body refusals, missing/corrupt private archive, private archives/extras excluded from packaging, coherent availability/old-receipt rollback, missing current marker, corrupted private receipt and failed publication restoration. SAME185/184/three-gap Spectral audit preserves original10 tamper/13 candidate/six recovery provenance/raw-byte/determinism/order/producer-failure assertions; only its output path changes to preserve old proof.

Primary authority model: Cargo index documents SHA256 of actual `.crate` bytes, not arbitrary derived text claims. [Cargo registry index](https://doc.rust-lang.org/cargo/reference/registry-index.html). Binary-safe file APIs run through Bun, including filesystem compatibility imports; no Node executable is launched. [Bun file I/O](https://bun.com/docs/runtime/file-io). Root independently reviews exact source/private-input closure before adoption or any actual packaging/installed claim.
