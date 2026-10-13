# Closed two-AUTHORS notice candidate

Isolated candidate only; root EA21, current policy, resources, Cargo cache, native/profile/lock/dependencies were not changed. Source frozen during saved acceptance. Authors run9331 exited0/70 groups; legacy run17607 exited0/57 groups. Three Bun syntax checks passed. Own handles:none. No builds/native launches or package/source execution.

## Policy and receipt contract

Schema1 remains the exact original filename/declared-license-file policy. Schema2 adds a closed `additionalCandidates` array containing only r-efi5.3.0 and6.0.0, bound to registry source, name/version, archive checksum, literal AUTHORS path, raw byte count/SHA256 and `authors-license-notice` kind. Code checks exactly both reviewed records; unknown/duplicate records, source/version/checksum/path/size/hash/kind/extra keys refuse. Unknown future packages/versions get no wildcard selection. No global AUTHORS glob exists.

Collection and validation use the same selector against authoritative parsed source archives, verifying selected raw bytes independently. Receipt/package/text keys and schemaVersion1 remain unchanged; selected texts use the exact new discovery value `reviewed-authors-license-notice`. Validator computes discovery from policy/path/source, so a relabeled public blob is refused. Older validators reject the new policy; this is historical schema1 behavior compatibility, not a claim that older code accepts new assets. Source-policy/module changes intentionally stale previous current resources and require a fresh deliberate generation before bundling.

The raw notices are3693/3733 bytes, hashesff92bed461f50338dd703a9ba9aee496a425957873df1d91192776e4bdf5dda7 and d027e91dbc9cdbb2f1190068e498bd6b61cff022b6a032b191021ba658d96111. Entire published bytes are preserved. They contain MIT grant/disclaimer/copyright plus Apache/LGPL reference notices; no synthetic/canonical full Apache or LGPL text is added. Per-file headers are excluded from this feature.

## Saved scenario compatibility

The SAME `tests/packaging/native-notices.mjs` explicitly replaces the owned historical fixture's policy with byte-pinned schema1/d6298dae9ee8e91c132617e72a7a1928c3a41139e41758edc7d5498274e3e08a, recording the override and historical project inputs. Source-root guards are checked before that intentional fixture change. No root input difference is ignored. The original47 assertions/counters and all ten closed-three cases remain unchanged and pass in both modes. The first57 names/order exactly match immutable prior proof. Default no-argument mode still publishes before its historical762 assertion; do not use it on root.

`--recovered-cargo3` retains legacy57 behavior. Its `--verify-current` flag applies to the old schema1 generation/current58 boundary, including EA21 history; it must not be used to claim the schema2 counts against the same current generation. Original root58/EA21/native proofs remain immutable.

`--authors-notices` runs those same57 controls, then deliberately changes only the owned fixture policy to schema2 and runs13 additional groups: exact legacy/new policy compatibility, closed selector refusals, raw-source/missing/path/source guards and unmatched-version no-wildcard, missing-archive nonblocking behavior, old-generation staleness, exact two-row/raw-text delta, exact counters/dedup/gaps, coherent text/availability/discovery tamper with all derived hashes recomputed, old-policy receipt rollback, determinism, and authentic owned current-source validation. Optional `--verify-current` adds future actual-root acceptance (71 groups); it was not run against root.

Measured owned schema2 generation:765 registry archives,1338 registry text origins,1343 total origins,424 unique text blobs,41 registry filename gaps and2 local gaps. The preceding owned schema1 generation remains765/1336/1341/422/43. Only the two r-efi rows change. These are **root predictions**, not adopted/installed counts. Coverage remains incomplete, target linkage unproven, no completeness blocker is added, and missing archive sources remain unknown/nonblocking.

## Guarded files and future root sequence

| Offered path | Root-before SHA256 | Offered SHA256 |
| --- | --- | --- |
| scripts/generate-native-notices.mjs | 360a125c0c88bf6c5a2825d833e82b435445314c346224e4730e8fce2ee1dc18 | 82f7115f995df5b11909670da44ec52378ebb30e2b56a685bd4b8083d1e91457 |
| scripts/native-notice-artifact.mjs | 5e8a05c751c0cd5a24298f2d52041c16289440d1a570db745d5e98093fe2de35 | 6630d99d0fddfe841875a5a76acf8119b70204e496b39bb7086d6d0cec1c9746 |
| tools/native-notices/source-policy.json | d6298dae9ee8e91c132617e72a7a1928c3a41139e41758edc7d5498274e3e08a | b84958753bea9074cf37aaeadd3f7572723238616bccd7015ef67fd5605f57e8 |
| tests/packaging/native-notices.mjs | 7aadf6be332a74eeb9b2418ad14fe543d42eeab4ee47f030c5e61b9458810fcd | 47ab172428f14120dc31905ac6ebfe9e86a4dcae45ad30b37b715f718f4363e9 |

This new report is absent from root. Parser8e1e9e3f stays unchanged. The owned source snapshot captures all17 current root project guards, overlays only the three candidate collector/validator/policy files, and records current-versus-imported Spectral helper differences with invoked spectralPaths byte equality. No producer helper was edited.

After root review and native EA21/source freeze are terminal, root may deliberately integrate/recollect and separately capture the new policy2 admission/output/source identity. Suggested future commands, **not executed here**:

```powershell
$env:CARGO_HOME = 'D:\home\.cargo'
$env:TAURI_ENV_TARGET_TRIPLE = 'x86_64-pc-windows-msvc'
bun tests/packaging/native-notices.mjs --authors-notices
bun scripts/tauri-spectral-hook.mjs build
bun tests/packaging/native-notices.mjs --authors-notices --verify-current
bun scripts/tauri-spectral-hook.mjs bundle
```

The real build hook preserves producer/notices/native-generation/stamp/frontend order. Bundle remains validation-only. New current71 acceptance, compiled resources/native installation, per-file/canonical full texts/nested/data/system/toolchain/platform/distribution/target linkage and all original migration gates remain open. [Cargo license and license-file fields](https://doc.rust-lang.org/cargo/reference/manifest.html#the-license-and-license-file-fields) distinguish declared expressions from raw text paths; no generic text substitution occurs. `/compact` unavailable; STATUS and frozen manifest provide handoff.
