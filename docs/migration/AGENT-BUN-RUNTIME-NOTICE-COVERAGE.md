# Bun 1.4.2 Windows compiled-runtime notice coverage

2026-10-13. Read-only source/release audit in insomnium-agent-license-next after03ce4da/974cb69. Only this report and isolated STATUS are committed. New artifacts/bun-notice-coverage-audit contains downloaded primary evidence; no downloaded source was executed. No product, generator, producer, backend, UI, dependency, lock, SDK/provider changes, builds or native/app/profile launches. Existing406-file proof remains immutable. All audit commands terminal. Root owns future integration and native acceptance. /compact unavailable; explicit handoff.

## Evidence boundary

The packaged Bun1.4.2 LICENSE.md is5613bytes/SHA b9caf52728691b4057e371232c221a132883198be2f3d2ddf92c90404c984b1a. It is an upstream component/license inventory, not all component license texts or a compiled-binary linker map. Its unversioned external links cannot independently supply exact-version text. No license expression is converted into a generic text, and no completeness/legal-compliance claim follows from this audit.

[Primary release metadata](https://api.github.com/repos/oven-sh/bun/releases/tags/bun-v1.4.2) binds tag bun-v1.4.2 to commit744846f844374847c902b5e7fd59b4342a51ef99, published2026-09-05. Windowsx64 release archive is39,807,510bytes with API digest sha256:ce4c17497b2f29712a99d3d53f028de28cd42e3bacb8589599e7f000e49b6405; baseline variant39,807,490bytes/78c221c2376f79731ccf4e4af0b3bb46d81fefa3296c5abee09ad8a1b21e68c6. These large archives were not downloaded or executed. Metadata alone does not prove a particular local compiler/embedded Spectral runtime byte identity or selected CI feature set. The current producer's Bun.version and artifact hash are separate evidence.

The untruncated Bun source tree and immutable source files were read at that commit. [Dependency order](https://raw.githubusercontent.com/oven-sh/bun/744846f844374847c902b5e7fd59b4342a51ef99/scripts/build/deps/index.ts) and [link orchestration](https://raw.githubusercontent.com/oven-sh/bun/744846f844374847c902b5e7fd59b4342a51ef99/scripts/build/bun.ts) resolve enabled dependencies into libraries/objects; Cargo runtime artifacts and in-tree C/C++ sources also enter the link. This proves declared source/build inputs and default Windows behavior, not the final contents of every library archive or shipped executable. No inference from strings or component symbol names substitutes for binary provenance.

## Version-pinned source findings

All paths below are under scripts/build/deps/ at Bun commit744846f8. Full URLs/byte hashes are in source-manifest.json; pins.json records parsed literals. These are source revisions, not guessed semantic versions.

| Component/repository | Declared revision/version | Scope established |
| --- | --- | --- |
| oven-sh/libuv | 8023581113b276e7c1aee3f82da57ca0893faab1; header1.51.1 | enabled only when cfg.windows; actual full LICENSE recovered |
| oven-sh/WebKit | 2e2aa2290fac856d6f451ceacb58f7f5b44dd057 | default prebuilt WTF/JavaScriptCore/bmalloc plus Windows ICU libraries |
| unicode-org/icu | 78.3; tag resolves21d1eb0f306e1141c10931e914dfc038c06121da | exact WebKit Windows build-icu source URL; full root LICENSE recovered |
| SQLite in Bun tree | amalgamation3.53.2 | cfg.staticSqlite defaults true on Windows; original source public-domain statement retained as evidence |
| oven-sh/boringssl | 41bf9b59c2ebf277a7aa427e1ecad5cc80dd4d4f | declared static dependency; full corresponding license collection not audited |
| google/brotli | v1.1.0 | declared tag; commit dereference/text collection still open |
| c-ares/c-ares | c7a3138dcfe3bb0eaaf10c0c24c36dc66dc790ab | declared dependency with Bun patch |
| HdrHistogram/HdrHistogram_c | be60a9987ee48d0abf0d7b6a175bad8d6c1585d1 | dependency present beyond existing summary table |
| google/highway | 2607d3b5b0113992fe84d3848859eae13b3b52c1 | declared dependency with patch |
| libarchive/libarchive | ded82291ab41d5e355831b96b0e1ff49e24d8939 | declared dependency; multiple source licenses remain uncollected |
| ebiggers/libdeflate | c8c56a20f8f621e6a966b716b31f1dedab6a41e3 | declared dependency |
| libjpeg-turbo/libjpeg-turbo | e352b02f794f701407b39af08576035ba3360d60;3.1.4 | declared dependency with Bun source patches |
| randy408/libspng | fb768002d4288590083a476af628e51c3f1d47cd;0.7.4 | declared dependency |
| webmproject/libwebp | b7e29b9d75bd31422b00c2a446d49d7af06c328d;1.6.0 | declared dependency |
| oven-sh/lol-html | 725ce499aa9b71e38b7a2d0a9fbb6d7294a4079e; Cargo2.7.2 | source fetched for Rust path crate; upstream c-api is explicitly not built here |
| litespeedtech/ls-hpack | 8905c024b6d052f083a3d11d0a169b3c2735c8a1 | declared dependency with patches |
| litespeedtech/ls-qpack | 1e9c5b8e59f8161c54f168a570c8bfdc59ded0c3 | declared dependency with patch |
| litespeedtech/lsquic | 3181911301b1aa4f54c1ed690901abc674ee08fb | direct object dependency with patches |
| oven-sh/mimalloc | 6a64e1ba7f5b2130d4efccb67ec87fd0003f0f6a | source declaration describes JS heap allocator everywhere |
| h2o/picohttpparser | 066d2b1e9ab820703db0837a7255d92d30f0c9f5 | source-only direct compilation input |
| sru-systems/rust-argon2 | ed81866f163f0c7026aa6fd8388adf37242eb32a;3.0.0 | Rust path dependency beyond summary table |
| oven-sh/tinycc | 05f0fafaa3be31e31d7b4b5c17dc60f62c991171 | cfg.tinycc defaults enabled for Windows; configurable |
| zlib-ng/zlib-ng | 12731092979c6d07f42da27da673a9f6c7b13586;2.3.3 | declared dependency with patches |
| facebook/zstd | f8745da6ff1ad1e7bab384bd1f9d742439278e99 | declared dependency |

[Pinned glob source selection](https://raw.githubusercontent.com/oven-sh/bun/744846f844374847c902b5e7fd59b4342a51ef99/scripts/glob-sources.ts) includes Bun-vendored uSockets sources and simdutf glue. The source-level uSockets/uWS revision is the Bun commit itself. Other in-tree headers, Rust transitive dependencies, polyfill injection, llhttp, image/font/Unicode data and retained file-level copyrights need separate closure. Cargo.lock contains base64 crate0.22.1; that is not evidence that the inventory's libbase64 is identical to this Rust crate. Node26.3.0 headers/ABI147/V8header14.6.202.34 are declared inputs; this does not mean a Node runtime is bundled, and none was run.

## Authentic texts recovered and minimal future additions

No generated asset or checked-in notice collection is changed in this topic. Future source-version overrides could add these authentic texts after review:

| Exact source | Bytes / SHA256 | Provenance and limits |
| --- | --- | --- |
| [libuv LICENSE at802358](https://raw.githubusercontent.com/oven-sh/libuv/8023581113b276e7c1aee3f82da57ca0893faab1/LICENSE) |1079 /16de0c32b265cb7d46a6d3bd614f259dd4d693a5e26b3407b04aae8d73041f0c | exact Windows dependency pin; retain authentic copyright/text; additional per-file notices remain unchecked |
| [Bun-vendored uSockets LICENSE](https://raw.githubusercontent.com/oven-sh/bun/744846f844374847c902b5e7fd59b4342a51ef99/packages/bun-usockets/LICENSE) and [uWS LICENSE](https://raw.githubusercontent.com/oven-sh/bun/744846f844374847c902b5e7fd59b4342a51ef99/packages/bun-uws/LICENSE) | each11357 /c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4 | byte-identical full Apache texts at Bun source commit; deduplicate content, retain both origin paths |
| [JSC COPYING.LIB atWebKit2e2aa](https://raw.githubusercontent.com/oven-sh/WebKit/2e2aa2290fac856d6f451ceacb58f7f5b44dd057/Source/JavaScriptCore/COPYING.LIB) |25584 /5094ecb9c9dcd0eadc34f3c11511d9b5535063032bc150164ecd1a5d5a445547 | exact WebKit pin, original Library GPLv2 text; not all JSC/WTF/bmalloc copyright/license headers or redistribution materials |
| [ICU root LICENSE at21d1eb](https://raw.githubusercontent.com/unicode-org/icu/21d1eb0f306e1141c10931e914dfc038c06121da/LICENSE) |27718 /e55522d81edc687a341a4411e0776e54ca654e90147f354a90458aaced4116af | WebKit build script pins78.3; icu4c/LICENSE is only a10byte ../LICENSE symlink, resolved to real root text; release-data/per-file coverage remains open |

WebKit release API resolves autobuild-2e2aa to the same source revision. Windows-amd64 normal prebuilt373,632,255bytes has API digest692315885cf2d1e426da22ff031c6ade9c4a8e1be989ff7f70e0cb7390c53b17; LTO/ASAN/debug assets differ. No prebuilt was downloaded. Actual Bun release WebKit variant and library/object provenance still require authoritative build receipts; matching naming alone does not select the variant. The pinned WebKit build script lists Python among requirements; it was only read, never run, and no generator/build route is proposed here.

Minimal future schema: component ID + source revision + declared Windows/build condition + immutable origin path/URL + raw byte count/hash + evidence-tier/source-build-candidate label. Retain full original bytes and narrow -text rules. Keep missing/conditional/unknown rows and coverage=incomplete; retain current no-new-completeness-blocker policy. Authentic addition of four texts must not silently mark the entire compiled runtime complete.

## Remaining gates and verification

Require exact local/embedded runtime to official release/CI build identity, Windows variant/feature selection and linker-map or equivalent component/object evidence. Then collect remaining pinned dependency/Rust/polyfill/per-file/data texts and preserve source/patch notices; evaluate required redistribution materials independently. Neither an API asset digest, dependency table, license expression, PE string nor partial authentic collection closes those gates. Existing three MIT-package gaps, Bun complete coverage, platform/signing/update/installed acceptance and every original migration/private/Event/FIFO/UX requirement remain open.

Evidence commands use Bun fetch and file reads only: artifacts/bun-notice-coverage-audit/{capture,primary,extra,pins}.mjs. source-manifest/primary-manifest/extra-manifest/icu-license/release/webkit-release/pins JSON record exact URLs, hashes and negative404. Source/WTF/wtf/COPYING.LIB returned404, explicitly retained rather than substituted. No tests/builds/native launches are needed for this report; original406 proof is independently rehashed again before handoff, along with fetched evidence. Own STATUS records report commit, evidence and no live handles. Root review/integration remains separate.
