# Native notice collector acceptance and fixture design

2026-10-13. Documentation-only supplement to [the collector proposal](AGENT-NATIVE-NOTICE-COLLECTOR-PROPOSAL.md), topic5d6e070, root capture542e177. Root native session90664 is owned by root and untouched. No collector, fixture implementation, product/config/backend/dependency change, Cargo/source execution, build, browser, app or profile launch. Own handles: none. Implementation remains subject to root review; /compact unavailable, explicit handoff.

## Correct guard count and independent meaning

Original proof manifestc14cafa682a8b902f50c82ba35796a45cb2edb176c388a915b191bba4406106e contains14 files, of which11 are root input captures. The other three are the receipt, proposal and isolated STATUS. Thus “fourteen current-root input guards” would overstate the receipt. This review rehashes all14 frozen files; it does not silently refresh root captures during the native freeze. Their root542e177 identity is historical preparation evidence, not a guard on later current root bytes.

| Frozen path (under proof directory) | SHA256 prefix; independent purpose |
| --- | --- |
| inputs/scripts/generate-spectral-notices.mjs | 5fad203de5b6; existing collection/unknown/raw-byte behavior and preservation of NPM/Bun assertions |
| inputs/scripts/tauri-spectral-hook.mjs | ac74c01b5583; producer/notice/stamp/frontend order, validation-only bundle and child lifecycle |
| inputs/scripts/spectral-artifact.mjs | 1c37c9931e45; current producer identity/freshness contract, keeping native stamp separate |
| inputs/scripts/build-desktop.mjs | 4ff9dcc863d9; desktop CLI and Linux main+sidecar ELF/overlay behavior |
| inputs/src-tauri/tauri.conf.json | 9ddb4767b23c; unchanged hooks/sidecar/Spectral resources, future additive native mapping review |
| inputs/src-tauri/Cargo.toml | b165342a4b4b; workspace dependencies/features and four local patch declarations |
| inputs/src-tauri/Cargo.lock | 5156ae8fa742; exact770 source identities/versions/checksums; no linkage inference |
| inputs/.gitignore | ba689653c68a; narrow generated-directory scope, preserving other ignore conventions |
| inputs/docs/migration/STATUS.md | 2db853015e59; root acceptance/history/handles at capture, not a generated notice freshness input |
| inputs/docs/migration/PLAN.md | 8b3d1b93015a; original scope and next-review boundaries, not runtime collection input |
| inputs/docs/migration/PARITY.md | decc506d37f2; unresolved requirements, not linkage or completeness proof |
| receipt.json | cf2cb8c4b95c; root commit/actions/input hashes/prior-manifest binding; authored audit evidence |
| report.md | 2a6ce708baa0; exact proposed policy, not implemented collector source |
| status.md | 40923d038e1e; isolated topic/evidence/open-gate/compact-limitation handoff |

Full hashes and byte counts are in the unchanged original manifest. These guards establish what was reviewed; they do not yet bind new collector/policy sources, exact local vendor trees, accepted override provenance, Git attributes or generated snapshots. Future implementation must capture those exact additional inputs after authorization. Root topic applicability must compare actual current relevant bytes independently before integration; reports and STATUS changing alone do not stale a producer/native notice generation.

## Closed schema fixture contract for review

Use schemaVersion1 and reject unknown keys, wrong types, duplicate identities, inconsistent references, invalid digest/count/path fields and unsupported source variants. Serialized assets use deterministic ordering; integer counts are nonnegative safe integers and hashes lowercase64-hex SHA256. Identifiers derive from a canonical source-kind/source-ID/name/version tuple; source IDs are preserved as opaque strings. Local paths are source-relative, not arbitrary absolute inputs. No fixture executes source code or fetches packages.

| Object | Closed fields and constraints |
| --- | --- |
| Inventory | schemaVersion, evidenceClass="cargo-source-corpus-candidate", coverage="incomplete", completenessBlocksBuild=false, preparation, packages, texts, unresolvedScopes |
| Preparation | target, buildRecipe, lock, manifest, policyInputs, admittedReceiptSHA256, resolutionEvidence; buildRecipe has profile/features/defaultFeatures plus explicit known/unknown state |
| Input digest | logicalPath, bytes, sha256; no absolute/private cache locator in packaged output |
| Package | id, source, name, version, manifestDigest, licenseExpression, licenseFile, availability, textRefs, vcsEvidence, unresolvedScopes; optional data represented explicitly as null, never invented |
| Source variant | registry:{sourceId,lockChecksum,archiveDigest}; local-patch:{logicalRoot,treeDigest,patchDocumentDigests}; workspace:{logicalRoot,treeDigest}. No registry checksum on local/workspace variants |
| Availability | state available/source-unavailable/no-candidate-discovered, reason; unavailable sources have no admitted manifest/text references; no-candidate-discovered may have verified manifest/archive |
| Text | sha256, bytes, blobPath="texts/<sha256>.txt", origins; each origin binds packageId/sourceRelativePath/discoveryReason and archive entry or local tree receipt |
| Resolution evidence | state unavailable/captured, receiptSHA256 or null, target/features/dependency-kind context when captured; linkage stays "unproven" in both states |

This is a proposed contract rather than an implemented validator. Exact source digest computation and archive parser format support require review before coding. Keep archive checksum authority distinct from expanded tree/text hashes. Accept genuine archive format requirements explicitly; refuse unknown link/path/duplicate behavior rather than silently following it. VCS metadata is provenance only. A captured resolution graph never proves that all package code or named native libraries are in the binary. Cargo metadata documents format/version, source IDs, dependency kinds/features and target filtering. [Cargo metadata](https://doc.rust-lang.org/cargo/commands/cargo-metadata.html).

## Minimal fixtures and expected outcomes

The future saved suite should copy authentic raw inputs from the immutable2870-file inventory into a new owned fixture directory. Record original archive/checksum/manifest/text identities. No fake MIT/Apache text and no old-proof edits. Only explicitly labeled mutation cases alter copies to provoke rejection. Tiny synthetic manifests/lock rows may exercise parsing/absence; they must be labeled structural test data and never enter production notices.

| Case | Fixed inputs and required observation |
| --- | --- |
| Registry authentic | One verified registry source/archive with manifest and candidate texts: lock checksum, name/version and each raw archive/text/blob match; available source candidate only |
| Shared raw text | Two authentic origins with identical bytes, if found by audited corpus hash index: one emitted blob, both origins retained. If none exists, retain that fact and use a labeled structural association fixture, never pretend it is corpus evidence |
| Distinct raw bytes | Authentic LF/CRLF/BOM examples only where present; separately labeled mutated byte variants verify distinct hashes/refusal. Original raw bytes remain intact |
| Source absence | Exact three missing cache identities remain source-unavailable with locked checksums; no fabricated manifest/text or fetch |
| Discovery absence | Real representative of43 verified registry gaps with manifest/expression but no discovered candidate; no-candidate-discovered remains distinct from missing source |
| Local patch | One reviewed text-bearing vendor plus eventsource-stream/p12-keystore gap: local tree/patch receipt bound, no registry checksum claim, metadata expression unchanged |
| Workspace | Native manifest missing license field plus separate project LICENSE context; field absence is not project-license absence |
| Nested libraries | Existing ring/libgit2/libuv candidate paths retain all individual origins/scope limits; neither filename nor links metadata becomes whole-library linkage/coverage |
| Archive/path refusal | Copied/labeled traversal, absolute path, external symlink, conflicting duplicate, escaping license-file cases refuse without reading outside sentinel; manifest/script treated only as data |
| Provenance refusal | Copied archive/manifest/text/lock/patch/policy/stamp digest mutations fail specifically; errors do not become optional unknowns |

Retain unmodified actual corpus counts as a separate real-input audit:770 identities,762 verified registry sources,1331 archive-matching texts/1335 total candidates, three cache misses/43 registry discovery gaps/two local patch gaps. A minimal fixture passing is not full corpus acceptance or target coverage.

## Immutable admitted inputs versus ambient cache

Preparation records one immutable generation: exact lock/manifest/policy/build context, source availability decisions, admitted manifests/texts/provenance, output hashes and unresolved states. Outputs are reconstructed from this snapshot. The private source locator is evidence for collection, not an implicit future bundle input. Byte/error validation of an admitted source is mandatory during collection; afterward bundle validates the frozen admitted snapshot and fixed project freshness inputs.

| Change after preparation | Bundle result and reason |
| --- | --- |
| Cache gains unrelated source or a formerly absent package | Fixed generation remains valid and unknown unchanged; deliberate recollection required to admit it |
| Ambient cache eviction/change with frozen snapshot intact | Snapshot generation remains valid; no ambient reread or unknown promotion. Record source-cache condition separately if audited |
| Admitted snapshot manifest/text/provenance missing or changed | Fail correctness validation; no downgrade to incomplete success |
| Output blob/inventory/assembled notices/stamp missing or changed | Fail before bundle child; validate references/counts/hashes and reconstructed expected output |
| Project Cargo.lock/manifest, policy/collector, accepted local source tree or supplied target/build recipe differs | Stale preparation; recollect/review the new exact inputs. Local trees remain explicit project freshness inputs |
| Root STATUS/PLAN/PARITY or an unadmitted unrelated cache directory changes | No notice-generation invalidation; these are audit context, not collector inputs |

No timestamps or automatic source promotion. Recollection must atomically write a fully validated new snapshot/output/stamp; failed recollection cannot authorize frontend/bundle using partial generation. Exact atomic-write/last-good handling is an implementation review gate. Incompleteness alone remains nonblocking; read/malformed/hash/version errors for declared inputs fail. This avoids a cold-cache completeness blocker and also prevents corruption from masquerading as an expected gap.

## Acceptance checklist before adoption

- Root approves closed schema, source admission, snapshot policy, malformed-versus-unknown distinction and atomic generation handling before implementation.
- Saved real-input audit preserves all historical counts/gaps/raw bytes; deterministic repeat from the same snapshot ignores locale/cwd/unrelated cache changes. New collection changes generation explicitly.
- Every labeled tamper/path/identity/schema refusal is saved with expected cause; no fetch, source execution, outside sentinel read or package build occurs.
- Byte preservation is verified archive -> admitted snapshot -> blob -> output extraction, and narrow reviewed Git attributes/index/checkout where raw override files are checked in. All origin references survive dedup.
- Existing SAME Spectral notice/hook assertions remain. Supplement tests native preparation order, build/dev no-start on correctness failure, incomplete success and bundle validation-only; preserve desktop wrapper CLI/Linux main+sidecar scan.
- Separate native preparation stamp binds target/project/policy/admitted receipt/output identities. f569 is not reidentified by Cargo texts. Proposed Tauri native resource map is additive; source candidates remain unproven linkage. [Tauri resource mapping](https://v2.tauri.app/develop/resources/).
- After independent source review, root captures exact app/sidecar/resources and verifies candidate/install resource contents per platform. No current native proof is relabeled. Distribution/signing/update/full coverage and all migration gates remain open.

No collector implementation is authorized by this document. Root90664 is observed only through parent messages, not queried or stopped. Own source/proof bytes remain isolated; prior proofs are immutable and SDK/provider investigation remains stopped.
