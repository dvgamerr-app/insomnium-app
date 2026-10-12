# Admitted native notice gap source audit

Read-only source inspection covers exactly43 registry and2 local `no-candidate-discovered` rows in admitted receipt700b438375749e6f400ecd72e4df4b040974dbd892ffd098d68a7b97d3942db1. The current marker stayed unchanged. Every private archive was checked against its lock checksum before parsing; both local trees matched admitted tree digests. Collector, policy, cache, root, profile and native/build state were not changed. No package/source/build script was executed. Own research commands exited0; live handles:none.

`artifacts/native-notice-gap-research/inventory.json` records every exact package/version, manifest/license fields, authority, all5132 entry paths/byte counts/SHA256 values, matching lines and raw source blobs. It includes43 frozen `.crate` authorities and the complete two local trees, not an ambient-cache recollection. `reviewed-findings.json` separates manually reviewed notices/headers from metadata, links and false positives. Published VCS metadata is captured as archive-declared provenance only; no repository content or current/unversioned license was fetched.

## Concrete omitted source notices

| Locked package | Exact archive path | Raw bytes | Raw SHA256 |
| --- | --- | ---: | --- |
| r-efi5.3.0 | AUTHORS | 3693 | ff92bed461f50338dd703a9ba9aee496a425957873df1d91192776e4bdf5dda7 |
| r-efi6.0.0 | AUTHORS | 3733 | d027e91dbc9cdbb2f1190068e498bd6b61cff022b6a032b191021ba658d96111 |

Their archive checksums are respectively69cdb34c158ceb288df11e18b4bd39de994f6657d83847bdffdbd7f346754b0f and f8dcc9c7d52a811697d2151c701e0d08956f92b0e24136cf4cf27b57a6a0d9bf. These are authentic published author/license notices containing MIT grant/disclaimer, copyright attribution, and Apache/LGPL notices/references. They do not contain canonical full Apache or LGPL texts. Both raw hashes are absent from the current admitted inventory.

The current recursive filename selector matches LICENSE/NOTICE/COPYING/COPYRIGHT names and declared license-file paths; it omits AUTHORS. No traditional nested notice candidate was found in these45 rows. All45 normalized manifests have no license-file declaration, and none of the additional inspected Cargo manifests supplied another declared path. License expressions, readme badges and links do not manufacture missing text: Cargo documents license-file as a path relative to the manifest, separately from the license expression. [Cargo manifest fields](https://doc.rust-lang.org/cargo/reference/manifest.html#the-license-and-license-file-fields).

## Authentic per-file headers

Twenty-four leading source headers form four distinct raw byte blobs. `reviewed-findings.json` records each complete source file path/bytes/hash, archive authority and exact header range starting at byte0. Full source files and header bytes are preserved separately; source code bodies are not classified as license text.

| Package/source origins | Header bytes | Header SHA256 | Evidence boundary |
| --- | ---: | --- | --- |
| selectors0.38.0,16 `.rs` files | 206 | 766674381e88a468d55e07de3596987391cf0e8beebe51baf4fddf11078785b3 | MPL source notice with full-license reference |
| tauri-plugin2.7.0,4 `.rs` files | 141 | 5ac83667211771c07b88c58fc6cdec8712974d74d2d8ee6e4cbc127f45d0f8e3 | Copyright and SPDX header |
| winapi-i686-pc-windows-gnu0.4.0 and winapi-x86_64-pc-windows-gnu0.4.0, each build.rs | 383 | 72f9dd4f441e55dbd746f776e04290d076584f469e9d0c964b152bf909029ad3 | Copyright and Apache/MIT reference notice |
| Same two winapi packages, each src/lib.rs | 378 | 9b0a59b4c5af60f46f79d2adbe433e07189d076972b8d33e9abca077dc10ccf7 | Copyright and Apache/MIT reference notice |

Selectors paths: attr.rs, bloom.rs, build.rs, builder.rs, context.rs, kleene_value.rs, lib.rs, matching.rs, nth_index_cache.rs, parser.rs, relative_selector/cache.rs, relative_selector/filter.rs, relative_selector/mod.rs, sink.rs, tree.rs, visitor.rs. Tauri paths: src/build/mobile.rs, src/build/mod.rs, src/lib.rs, src/runtime.rs. These notices establish only the identified per-file evidence; they do not supply canonical full licenses or prove whole-library attribution/target linkage.

## Remaining observations and next scope

The two local gaps remain eventsource-stream0.2.3 (tree315e38a2ff54fd424ef56234b2f7c22e335b4c785513b4ae7a521575a586ba2a,32256 bytes) and p12-keystore0.3.2 (tree0c693533cec1b1ee69b29dfef75b9bffb9af2f7e13a5741cc2ba512b00a03a96,162321 bytes). Their README/upstream/patch metadata declare license expressions or link elsewhere; no genuine standalone text or per-file notice was found in these inspected trees. Other gaps contain absent workspace license links, badge/repository references or manifest-only expressions. No linked text was substituted. objc2 `copying.rs` is copying API code, while generated copyright property names are API symbols; neither is a license notice.

The scan records2799 binary/NUL-containing, non-lossless-UTF8 or over8MiB entries without text classification, primarily archive library data. This boundary is explicit; absence of detected text is not proof that binary contents carry no notices. The ledger retains their byte/hash identities.

The smallest justified next collector topic is an explicitly reviewed data-only selector for **only the two pinned r-efi AUTHORS paths**, bound to package/source/version/checksum/raw path and hash. Preserve the entire raw notice, label it as an author/license source notice, and retain triple-license metadata without synthesizing other full texts. Refuse altered archives/path/text/version; retain malformed/missing-source/target/current-admission/coherent-tamper and old47/recovered-three transition gates. A global AUTHORS glob or automatic keyword/SPDX scan would admit ordinary credits/API false positives and is not justified by this audit.

Per-file header inventory is a separate possible future topic with exact source-byte ranges, source hashes and admitted archive bindings; it should retain its own evidence class and never imply full-license coverage. Adopting the two AUTHORS notices would change filename-discovery status for those two packages only;41 registry+2 local filename gaps and canonical license/per-file/nested/data/system/toolchain/platform/distribution/target-linkage/full migration gates would remain. No collector adoption/count transition is claimed here. The prior105dcc1/57/6268 proof remains immutable; root765 recollection and58 acceptance are independently pending.

Reproduce the source-only research with Bun from this isolated worktree using saved artifact `inspect.mjs` then `review.mjs`; both write only owned research artifacts. The input guard pins the historical current700b receipt and parser8e1e: if root later recollects, it refuses that changed current input; retain these frozen authorities rather than silently relaxing the guard. No Cargo extraction/build, native launch or generic license generation occurs. `/compact` is unavailable; STATUS and immutable manifest provide the handoff.
