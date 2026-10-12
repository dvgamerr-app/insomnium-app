# Native Cargo dependency notice coverage

2026-10-13. Read-only inventory of current root70b4485 Cargo/source metadata. Native Cargo.lock SHA5156ae8fa74230bd84ddf53706b8961a5e4d6c14e7069138394c1ccc5d782873; manifest SHA b165342a4b4b957e7ae26a6ea34c7ead729d3f068b3ea02fd92dd0acc4c01614. Only this report and isolated STATUS are committed. No dependency/source/collector/backend/API/SDK/provider changes, Cargo/source execution, build/app/native/profile launch or new notice resource. Root remains untouched, all own handles terminal. Prior proofs are preserved; /compact unavailable, explicit handoff.

## Current evidence and its limits

The lock contains770 package identities:765registry, four local patches and the workspace package. It is an all-platform/source resolution inventory, not a Windows runtime/linker map. Features, target selection, build dependencies, toolchain libraries and system/native dependencies require separate provenance. No locked entry or Cargo links label is treated as proof that its full source corpus is linked into one native executable.

Local Cargo cache has762 of the765 registry packages. Every available archive SHA256 matches its exact Cargo.lock checksum. Every available manifest name/version matches its locked identity. Archive-content verification then matches all762 Cargo.toml files and1331 actual license/notice-file candidate bytes against corresponding archive entries, with no missing requested entry or mismatch. Published .cargo_vcs_info metadata is available for752; it records source provenance but does not replace archive/content verification or target linkage evidence. No registry/package build script was executed.

Missing local sources/archives are openssl-probe0.1.6, tree_magic_mini3.2.2 and wl-clipboard-rs0.9.4. Their locked versions/checksums remain recorded; missing cache is not a finding that upstream lacks license texts. No package fetch/install was run.

There are1335 candidate files in the available source inventory:1331 archive-verified registry files plus four local vendor texts. Discovery covers conventional LICENSE/LICENCE/NOTICE/COPYING/COPYRIGHT filename prefixes and any package license-file declaration. Only libuv-sys2@1.53.0 explicitly declares license-file=LICENSE; its wrapper and bundled libuv LICENSE/LICENSE-docs/LICENSE-extra are recorded. Filename discovery is not exhaustive full-text/per-file/README analysis, and authenticity of a packaged file does not establish applicability to every linked component.

The first artifact scanner incorrectly relied on missing .cargo-checksum.json maps to enumerate files and missed actual local license files. This cache has zero such maps. Corrected source-directory discovery and independent archive-content matching supersede that tooling-negative receipt; the original failed scan/script are preserved and are not actual missing-text evidence.

## Exact representative locked versions

| Area | Locked versions and current source evidence |
| --- | --- |
| Tauri | tauri2.12.0 /tauri-build2.7.0; archive LICENSE-MIT and LICENSE-APACHE-2.0 present |
| Native plugins | clipboard-manager2.4.0, dialog2.8.0, fs2.6.0, opener2.6.0, window-state2.5.0; archive candidate texts recorded |
| Core serialization/runtime | serde1.0.229, serde_json1.0.151, tokio1.53.1; exact manifests and candidate texts archive-verified |
| TLS/native crypto | rustls0.23.45, ring0.17.14, openssl-sys0.9.117; ring has six candidate paths including BoringSSL/other-bits/fiat texts, not just its wrapper expression |
| Native Git | git2@0.21.0; libgit2-sys0.18.8+1.9.7 has eight candidate paths, including bundled libgit2, llhttp, pcre2, winhttp and zlib; libssh2-sys0.3.2 has wrapper texts plus libssh2/COPYING |
| Compression/libuv | libz-sys1.1.29 includes zlib/zlib-ng and contrib texts; libuv-sys2@1.53.0 includes four distinct texts |
| Protocol tooling | tonic0.14.6, prost0.14.4, protox0.9.1; source text candidates recorded |
| HTTP resolution | local patched reqwest0.12.28 and registry reqwest0.13.5 are distinct identities; preserve both source kinds/versions rather than merging by name |

These are declared metadata and authentic available file facts, not a whole-library SPDX/copyright interpretation. For example an openssl-sys wrapper text does not supply the actual OpenSSL library's full notice collection. Likewise the presence of a bundled compatibility-path COPYING file does not prove that path is in the current Windows binary.21 package links declarations are recorded; some name system libraries, some identify Tauri/plugin/build identities. Actual build receipts must resolve their meaning per target.

## Local patch and application provenance

Cargo.toml patches four crates to vendor paths. Those lock entries have no registry source/checksum, so registry-integrity conclusions do not apply to the modified tree:

| Local patch | Available current text/provenance gap |
| --- | --- |
| reqwest0.12.28 | LICENSE-APACHE10833bytes/SHA751963a8b88c0e3a9f27e98933079fbcf09b9998b2c13ac49c2e4d58444520d6 and LICENSE-MIT1063bytes/47d4e1803702728e03d30f8a848ae2249ba274bbd9f8443e803f7924d83cd371; INSOMNIUM-PATCH.md archived |
| http-auth0.1.10 | LICENSE-APACHE.txt11359bytes/531ae0e8652952207e2e577daa311955290f78380be845087f2acd86d808df7d and LICENSE-MIT.txt1094bytes/ed057943f5d1306ad0c87d38e1e523b9e167dce174ef7138fa27200c7cf1243f; PATCH.md archived |
| eventsource-stream0.2.3 | metadata says MIT OR Apache-2.0; no conventional/declared license-file candidate found; exact original text/provenance remains unknown |
| p12-keystore0.3.2 | metadata says MIT/Apache-2.0; no candidate found; INSOMNIUM-PATCH.md archived; original full texts remain unknown |

Future collection must bind each actual patch tree/receipt and upstream origin/version, preserve original authentic bytes and modification provenance, and keep absent texts unresolved. A package expression/author field is not used to construct copyright or generic license text.

insomnium0.1.0's Cargo manifest has no license/license-file field; this does not imply the project has no license. Root LICENSE exists separately, SHA8763e17d977f94e9573949df0734dbc16fa68e286d1353f1ea7a0b9acc3843bd, and is archived as project context. Keep project, dependency and bundled-library notice scopes distinct without interpreting the app's MIT bundle setting as covering all dependencies.

## Remaining concrete coverage requirements

43 available registry packages have no conventional/declaration candidate under this scan. Exact list and metadata are in receipt.json; examples include clipboard-win5.4.1, tauri-plugin2.7.0, tonic-prost0.14.6, webview2-com0.39.1 and its macros/sys packages, and the objc2 family. This is a filename/declaration discovery gap, not proof that a corresponding authentic text is unavailable in READMEs, nonstandard names, per-file headers or primary source. Add the two local patch gaps and workspace-field/context issue separately; do not conflate them with the previously examined three npm MIT gaps.

The current Tauri resource mapping contains notices/spectral only. No native Cargo inventory/combined target notice asset is generated or packaged by current notice scripts. The migration plan retains full notice/distribution/platform gates. A future deterministic collector needs exact source+name+version+checksum identities, actual raw text/declaration hashes, patch receipts and explicit unresolved rows; generic SPDX substitution and inferred copyright remain prohibited.

Root next needs target/feature/build-vs-runtime provenance from the accepted native build, exact texts for cache/discovery gaps, bundled C/Rust/per-file/data notices and system/toolchain/runtime redistribution inputs. Validate generated assets/freshness and installed resource paths per target if later implemented. LTO/staticlib/cdylib/rlib configuration and system wrappers alone are not binary component/object evidence. Existing incomplete/no-new-completeness-blocker policy remains; this report adds no collector or release rule and makes no legal/completeness claim.

## Verification and reproduction

Read-only Bun TOML parsing and filesystem/archive reads: `bun artifacts/cargo-notice-audit/capture.mjs`, `bun artifacts/cargo-notice-audit/archive-content.mjs`, `bun artifacts/cargo-notice-audit/context.mjs`. No Cargo command or package source was executed. receipt.json records every locked package, exact metadata fields, available candidate paths/hashes, archive matches, filename gaps, published VCS metadata and scope limits. Context archives current project/license/config/patch docs. Frozen artifacts/cargo-notice-proof binds report/evidence and rehashes prior73/413/406/57/16 proofs unchanged. Root reviews before any implementation/adoption.

Primary contracts: [Cargo license/license-file metadata](https://doc.rust-lang.org/cargo/reference/manifest.html#the-license-and-license-file-fields), [Bun TOML parsing](https://bun.com/docs/runtime/toml). These document parsing/metadata meanings; they do not resolve the project-specific coverage or redistribution gates.
