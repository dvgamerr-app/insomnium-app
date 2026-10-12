# Native notice collector proposal

2026-10-13. Read-only proposal against root542e1770364c331ea88269786601d1049c3fed7b. No collector, hook, config, dependency, backend, permission or runtime change is implemented. No Cargo/source execution, build, browser, native app or profile launch. Prior proofs remain immutable; handles: none. Root reviews implementation and failure policy before adoption. /compact is unavailable; this report is the handoff.

## Evidence and acceptance boundary

The independently verified Cargo inventory has770 lock identities:765 registry, four local patches and one workspace package. All762 available registry archives match their lock checksum; all762 manifests and1331 candidate text files match archive entries. Four local vendor texts bring the source-candidate total to1335. Its2870-file manifest is0f34efdef2a0c838a5c23e7dda7d14b699bc4dd23d17c6b6c437f09f1b617631; the report is e97c53f867411ac04df4e2e76a52a87003167ee1f6270a5e7e0a131d7c93c129. See [the inventory](AGENT-CARGO-NOTICE-COVERAGE.md).

These are authentic available source texts. They are not770 Windows-linked components or a complete legal inventory. Keep three cache misses (openssl-probe0.1.6, tree_magic_mini3.2.2, wl-clipboard-rs0.9.4),43 registry filename/declaration discovery gaps, two local patch text gaps, workspace manifest context, nested/per-file libraries, build conditions, system/toolchain libraries and target linkage explicit. Missing cache and discovery gaps do not establish upstream text absence.

Current root `generate-spectral-notices.mjs` collects NPM/Bun source candidates with incomplete coverage and no completeness blocker. `tauri-spectral-hook.mjs` runs producer -> Spectral notices -> producer stamp/validation -> frontend for build/dev; bundle only validates. `spectral-artifact.mjs` binds producer and notice inputs, not native app linkage. Tauri resources currently map only `notices/spectral/`. Preserve their existing behavior and separate the native preparation receipt from the f569 producer identity.

## Proposed closed schema and source admission

Use schemaVersion1 with `coverage: "incomplete"`, `completenessBlocksBuild: false` and evidenceClass `cargo-source-corpus-candidate`. Deterministically sort package identities and paths. Do not emit timestamps, absolute workspace/CargoHOME paths or machine usernames.

| Record | Required identity and evidence |
| --- | --- |
| Preparation | Cargo.lock/Cargo.toml bytes and SHA256, collector/policy input hashes, explicit target, actual build profile/features when supplied, immutable admitted-source receipt digest |
| Package | source kind, opaque source ID, exact name/version, registry checksum or local patch tree digest; manifest bytes/hash, unmodified license expression/license-file, repository/VCS metadata when available |
| Text | source-relative path, discovery reason, raw bytes/count/SHA256, archive entry or reviewed local tree origin; all package/origin references |
| Availability | available, source-unavailable, or no-candidate-discovered; precise reason and unresolved scopes |
| Target evidence | resolution graph receipt when separately captured; otherwise unavailable; linkage stays unproven until separate reviewed binary/object evidence |

Registry admission verifies `.crate` SHA256 against Cargo.lock, manifest name/version and exact selected file bytes against archive entries. `.cargo_vcs_info` supplements provenance; it never replaces checksum/content verification. Cargo source/package IDs remain opaque. Keep patched reqwest0.12.28 and registry reqwest0.13.5 distinct.

Treat archives and TOML as data: no package script/build execution or implicit fetch. Reject escaping/absolute archive paths, conflicting duplicate entries, unsupported link entries and license-file paths outside the package. Discover declared license-file plus LICENSE/LICENCE/NOTICE/COPYING/COPYRIGHT candidates using the reviewed inventory policy; record README/nonstandard/per-file discovery as unresolved rather than assuming these names exhaust coverage. Unsupported new source kinds need review, not silent registry/path inference.

Admit only the four reviewed local patch roots: reqwest, http-auth, eventsource-stream and p12-keystore. Bind actual accepted source tree and patch-document hashes, manifests and raw texts. Their lack of registry checksum must remain explicit; do not fill eventsource-stream/p12-keystore gaps from generic expressions. Workspace root LICENSE is separate project context because the native manifest has no license field. A future recovered override requires immutable version/source/text provenance and explicit scope, preserving the current incomplete policy.

Deduplicate only equal raw SHA256+bytes while retaining every origin and package/path association. Preserve CRLF/LF, BOM, headers and copyright bytes without interpretation, expression selection or generic license substitution. Package raw content-addressed blobs so assembled headings/separators cannot hide normalization.

## Preparation, freshness and proposed files

The beforeBuild hook precedes Cargo's own source acquisition. Ambient cache may therefore change after preparation. Freeze admitted source manifests/texts and unknown states once into a preparation snapshot; bundle-only validation must validate that snapshot rather than rescan opportunistically and promote newly cached packages. New unrelated cache data does not clear gaps or invalidate the fixed generation. A deliberate recollection produces a new receipt. Missing source at collection is an explicit unknown; modified/missing declared input or output, malformed provenance, wrong version/checksum/target, or read errors are correctness failures. Incompleteness alone remains nonblocking. Root must approve this distinction before code changes.

Proposed implementation paths, not created by this report:

- `scripts/generate-native-notices.mjs`: Bun TOML/data collector with explicit preparation inputs; no Cargo fetch or source execution.
- `scripts/native-notice-artifact.mjs`: native preparation identity and validation, separate from producer `.packaging.json`.
- `tools/native-notices/source-policy.json`: closed source/discovery schema and provenance rules; authentic overrides only if separately reviewed.
- Ignored `src-tauri/notices/native/{inventory.json,collection-inputs.json,THIRD_PARTY_NOTICES.txt,texts/<sha256>.txt}` plus preparation stamp. Snapshot bytes and receipt permit independent output reconstruction; private audit locators stay outside packaged assets.
- Existing hook: producer -> Spectral collection -> native preparation -> existing producer record/validation and native validation -> frontend. Bundle validates both and starts no collector/fetch/child. Existing relative order and child signal/CLI behavior remain intact.
- Tauri resources add `"notices/native/": "notices/native/"` beside existing Spectral mapping; ignore only generated native directory. Checked-in reviewed raw overrides need narrow `-text` attributes and Git checkout byte verification, never broad normalization.

Tauri documents resource-relative mapping; actual installed location/content still needs platform acceptance. A future owned probe must capture/copy these resources and bind app/sidecar/source closure hashes, rather than relabel the current native proof. [Tauri resources](https://v2.tauri.app/develop/resources/).

Cargo metadata supplies package licenses, dependencies, features and target predicates; its default resolve graph covers all platforms. Future optional preparation command, not run here: `cargo metadata --manifest-path src-tauri/Cargo.toml --format-version 1 --locked --offline --filter-platform <target>` with the exact feature flags of the accepted build recipe. Record missing/offline graph as unavailable. A filtered graph is resolution evidence, not proof of emitted or linked code; preserve normal/build/dev distinctions. [Cargo metadata](https://doc.rust-lang.org/cargo/commands/cargo-metadata.html). License expressions and relative license-file are manifest data, not fabricated text or a completeness finding. [Cargo manifest](https://doc.rust-lang.org/cargo/reference/manifest.html#the-license-and-license-file-fields).

## Meaningful saved acceptance gates

Extend existing saved notice/hook audits for the proposed collector; do not replace current Spectral assertions.

1. Same frozen input produces identical inventory/blobs/assembled output across cwd/locale changes. Extra cache entries do not change fixed availability or output. Explicit recollection is the only promotion path.
2. Lock/archive checksum, manifest name/version, selected archive text, local patch tree, policy/override provenance and declared snapshot/output tampering fail. Test wrong target/profile/features receipt reuse; retain missing-source unknown success without a new completeness blocker.
3. Archive traversal, absolute paths, external symlinks, duplicate ambiguity and escaping license-file refuse without reading an outside sentinel. Declared source read failure is distinct from absent-at-collection state.
4. Identical bytes deduplicate with all origins intact; distinct BOM/newline bytes stay distinct. Compare raw source/archive/blob/Git index+checkout bytes. No substituted SPDX text.
5. Keep the three cache misses,43 discovery gaps, two local patch gaps and nested/system/toolchain/target unknowns visible. Metadata/filter evidence never upgrades source candidates into Windows-linked claims.
6. Verify build/dev ordering and no frontend start after producer/native correctness failure; incomplete preparation succeeds. Bundle remains validation-only and refuses stale/missing/tampered snapshot/output before a child starts. Linux desktop-wrapper CLI and main+sidecar ELF dependency handling remain unchanged.
7. Root later verifies resource copy and installed Windows/Linux/macOS content against the exact preparation/app closure. Signing/update/distribution and full notice coverage remain separate gates.

This proposal authorizes no implementation, coverage upgrade, engine/provider investigation or native launch. The smallest next review is the closed collector/schema plus preparation-snapshot policy; packaging integration follows verified byte/provenance/unknown tests and explicit root approval.
