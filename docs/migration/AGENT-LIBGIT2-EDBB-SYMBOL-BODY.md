# Actual edbb libgit2 initializer and final-link evidence

This isolated read-only offer establishes bounded native code and data evidence for the existing Windows executable `edbbac32fefd0b81eda09ad27c9dd30b18d07101196763963518907657d8f8f7`. It does not execute that application, create a new native candidate, or change the gRPC fixture policy. Root must independently reproduce and bind the receipts before accepting its selected initializer gate. Full-source attribution, all-function retention, legal coverage, platform coverage and migration acceptance remain open.

## Actual identities and original evidence

The actual target PDB is `506cd46a66b632967d2283a810330057682b0ac42d7c74949ddf703b661e6712`. Its GUID `A1DABC74-ED44-4A66-A524-1A77FD77EFD7`, age 1, six section headers and absence of OMAP agree with the executable. The prior immutable 20-file PE/PDB proof (`c39d0085…be7`) and 24-file Cargo/archive proof (`038a43e0…ae`) are dependencies, not recopied or rewritten. Their full manifest hashes and selected input hashes are checked by `inspect.mjs`.

This proof imports the prior bounded PE/MSF/DBI parser and verifies its captured source SHA. It adds regular AMD64 COFF symbols/sections/relocations, PDB symbol-record/public-GSI/address-map parsing, and the linker module environment record. The public stream has 7,371 records, hash entries and address entries; selected function records belong to both actual maps. Global hash header/count is validated but no global procedure or source-line parsing is claimed.

## Actual initializer code

`final-function-graphs.json` compares object bytes with actual stored PE bytes at independently named PDB public addresses. Relocations are accounted individually rather than merely masked. REL32 through REL32_5 and ADDR64 decode the actual image target, subtract the original object addend, and compare an independent public address; private defined targets instead require recursive whole-section body agreement and consistent section placement. Unsupported relocations, unresolved externals, conflicting placements and unmatched nonrelocated bytes refuse.

| Function | Actual RVA | Root bytes | Verified sections | Independent public relocations | Private relocations with body validation |
| --- | ---: | ---: | ---: | ---: | ---: |
| git_repository_init_ext | 12845184 | 981 | 12 | 284 | 19 |
| git_libgit2_version | 12906944 | 22 | 1 | 0 | 0 |
| git_config_set_string | 12757536 | 227 | 1 | 5 | 0 |
| git_repository_init_options_init | 12846192 | 136 | 1 | 3 | 0 |
| git_libgit2_init | 12906880 | 17 | 2 | 19 | 1 |
| git_sysdir_find_template_dir | 13063552 | 213 | 10 | 46 | 17 |

The repository graph includes actual private `repo_init_directories`, `is_valid_repository_path`, `repo_init_config`, `repo_init_structure`, filesystem configuration/template writers and configuration-loading sections. Those names come from original COFF symbols, not invented PDB private records. The graph establishes a bounded object/image correspondence; ICF aliases, COMDAT folding and identical-code alternative origins are not excluded.

At file offset 12903872, `git_libgit2_version` has exact object/image bytes `c7010100000033c0c7020900000041c70007000000c3`. The pinned dumpbin read-only object disassembly confirms writes of 1, 9 and 7 through the three pointer arguments followed by return 0. [Microsoft's x64 ABI](https://learn.microsoft.com/en-us/cpp/build/x64-calling-convention?view=msvc-170) identifies RCX/RDX/R8 as those arguments. This is compiled 1.9.7 version behavior, without invoking it.

## Actual original final-link metadata and archive/rlib relation

`final-link-invocation.json` records the real matching PDB `* Linker *` module 427, symbol stream 415, S_ENVBLOCK type `0x113d`, record offset 72 and 2,548 bytes. The actual command is 2,269 bytes, SHA `960ea1ddc32221847708142274798a8ce77373d02650e52cb4ff8627ef8fc179`. Its record hash, command stream offset, physical PDB byte ranges and parsed actual unquoted argv are saved. Only compiler-owned `cmd/cwd/exe/pdb` keys are admitted; unknown values are redacted (actual unknown keys: zero). No arbitrary environment values are published.

The actual `/LIBPATH` contains `libgit2-sys-adf3c42a42293bf2/out/build`; `/OUT` names the matching release/deps executable and `/OPT:REF,ICF` is present. There are no response-file tokens. This is authentic original link metadata, not a newly executed linker, PID, synthesized command, or complete recovered input list. The command does not explicitly list `.rlib` input tokens. The saved linker executable is hashed as an ordinary read-only file and is never executed.

Actual static `git2.lib` SHA `08169261472a850c3eabfa8452829002378b171657259a8c7e7fbad010eae59d` contains the prior 214 native object payloads. Actual persisted `liblibgit2_sys-9784f4743c9f32fb.rlib` is 7,054,218 bytes, SHA `f5b614f9782e5599f8899c5aa9cee8fb50905ae5e1208cb82685e2e6fdfcfacd`, with 220 AR entries; all 214 native payloads occur exactly once by byte hash. Selected actual PDB modules name those object paths and a transient `rustc5tk8yw/liblibgit2_sys-9784f4743c9f32fb.rlib` extraction path. The basename, native payload equality, module relationships, real library search path and actual code/body matches are separate evidence. The removed transient rlib file has no observed checksum; it is not silently equated to the persisted file.

The earlier 165 positive modules, three recorded modules with no positive contributions, and 46 unrecorded objects remain unchanged. All 214 final members/functions are not a prerequisite or a claim for this bounded initializer gate.

## Cargo, source and template authority

`selected-input-pins.json` binds the actual selected FFI/git2/application fingerprints, raw `git2_features.h`, Cargo build output and run-build fingerprint through the previous captured hashes. The raw Cargo output declares `libgit2_vendored`, `static=git2` and the actual archive search path. The generated Windows header contains no ICONV enabling definition. Output/header times predate successful build child 50384; this proves the selected cached artifacts, not fresh compilation of every C source during that child.

The immutable private crate `7f7c568b25d7489bc3fb2988ed69ab111d2944d2f5fec3d5c987fe545ea97b50` is rehashed and parsed by the pinned existing source parser `8e1e9e3f30505caf1312c52efb78a27d43e7c67614c07766228e769889234fdb`. Its 686 entries supply exact raw `repo_template.h`, `libgit2.c`, `repository.c`, `build.rs` and `include/git2/version.h` bytes. `repo_template.h` is 2,082 bytes, SHA `bec227c595d193802723f81765487da76beaffafae40ec05b76a4db7de153c01`. The previously captured package manifests/VCS/COPYING stay authoritative and unchanged; the outer Rust crate VCS does not establish an inner libgit2 Git commit.

`template-constants.json` adds a concrete template binding: three authentic literal macros for description, README.sample and exclude are decoded without substitution and compared as NUL-terminated bytes against exact COFF sections and PDB-addressed PE storage. Each has an actual initializer graph ADDR64 reference to the independently named public string. This proves the selected compiled constants, not the complete preprocessor output or full source line/body origin.

## Reproduction, negatives and acceptance boundary

From `E:/.dvgamerr-app/insomnium-agent-license-next`, with existing immutable prior proofs and root input paths intact:

```powershell
bun artifacts/libgit2-edbb-symbol-body/inspect.mjs
bun artifacts/libgit2-edbb-symbol-body/check.mjs
```

Both terminal exit 0. The 17 saved pure guards refuse truncated/wrong-machine COFF, malformed public records, changed PE/object version bytes, changed public/private REL32 targets, private target body damage, altered public RVA, unsupported relocations and malformed/duplicate environment pairs. They verify unknown environment values are redacted, actual linker command identity and all original input hashes after inspection. Parsing/imports of the five inspection/guard modules and separately run reference capture succeeded under Bun.

Original read-only disassembly (terminal 0) was `dumpbin.exe /DISASM object-git_libgit2_version.o` using existing tool SHA `2fde1ce58b9c9e51f4cfcd493e137dad3b38377314189dcd3cbff1c72b481dc3`. Tool process PID was not captured and is not invented; raw output/error/exit are retained. The linker was only read and hashed. No compiler, link, Cargo, app, native host, profile, cache mutation or root write occurred.

Retained exploration negatives include the guessed nonexistent `global.c` archive path, the initial REL32-only/ADDR64 mask-width limitation, and the incorrect assumption that pooled template publics belonged to private graph sections. Corrections use actual archive keys, eight-byte ADDR64 accounting and independent public string addresses; no assertion or target gate was weakened.

Primary format definitions were inspected before implementation: [LLVM 20.1.8 record definitions](https://raw.githubusercontent.com/llvm/llvm-project/llvmorg-20.1.8/llvm/include/llvm/DebugInfo/CodeView/SymbolRecord.h), [record mapping](https://raw.githubusercontent.com/llvm/llvm-project/llvmorg-20.1.8/llvm/lib/DebugInfo/CodeView/SymbolRecordMapping.cpp), [GSI builder](https://raw.githubusercontent.com/llvm/llvm-project/llvmorg-20.1.8/llvm/lib/DebugInfo/PDB/Native/GSIStreamBuilder.cpp) and [MS PE/COFF format](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format#coff-symbol-table). Pinned raw LLVM source URLs/bytes/hashes are saved; none was compiled or executed. LLVM public/global documentation pages are placeholders, so actual pinned definitions support the bounded parser.

Root adoption is a separate review: rederive the selected Cargo/header/template pins, matching PE/PDB, real ENV command, archive→persisted-rlib payload membership and six function graphs from unchanged original inputs; then explicitly bind its provenance/finalLinkReview contract. No gRPC run or acceptance is claimed here. Remaining full-source checksums/lines, unique compiled-origin attribution, unknown stripped/folded functions, target/linkage/legal/distribution coverage and all broader migration requirements remain open. Own live handles: none. `/compact` cannot be invoked through this agent interface; this report and immutable manifest provide the handoff.
