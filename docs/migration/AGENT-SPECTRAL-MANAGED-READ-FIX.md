# Managed repository read freshness correction

2026-10-13. Isolated implementation; no native app, profile, Tauri release build or root source writes. Root owns fresh compiled native acceptance. Historical actual62 RED and all previous proofs remain unchanged.

## Result and contract

The producer records exact bytes consumed through public ruleset IO and Rollup loader hooks, plus managed repository reference reads and missing direct fallback dependencies. The native internal stdin/stdout protocol is version2. Outer ASCII metadata carries UTF16LE/base64 managed-relative paths, consumed canonical targets, role, outcome, byte count and SHA256. The public command result remains exactly `{jobId,resultJson}`; Rust never parses or rewrites diagnostic JSON. Version1 producer requests retain their original public result and omit instrumentation.

After physical process retirement, native success reacquires existing Git→Storage locks, rechecks the full saved binding/root, then verifies receipts against current managed content before settling success under those locks. Different bytes, missing files becoming present, target changes, conflicting consumed snapshots and nonregular files refuse publication as `binding`. Hashing checks the existing cancellation/deadline token in fixed64KiB chunks. No new file path authority, concurrency/deadline/output budget or dependency was added. Both pre-open path metadata and post-open handle metadata must identify a regular file.

Producer source identity now includes `tools/spectral-linter/read-receipts.js`, preventing bundle reuse after changing only the receipt implementation. This delta is based on exact current-root `scripts/spectral-artifact.mjs`; concurrent notices work must reconcile this explicit additional input without replacing the root notice authority.

The SAME held-rule scenario keeps its actual entered UUID/process ownership, A/B writer guard, four-second timer, unchanged inputs/binding/workspace and physical retirement assertions. Future green requires actual Rust `binding` refusal, zero stale finding rows and no accepted cancellation; protocol/process errors do not pass. A client cleanup cancel returning false after already-failed settlement is recorded separately.

## Evidence

`artifacts/spectral-managed-read-fix/final/manifest.json` SHA `b52d81be86c23e8e97d18e74c6db71a2d805f8d89a41befcaacebf75b480b22c` binds eight source deltas, exact root-before baselines,776 output files, all60 generated permission TOMLs and verification package bytes. Permission TOMLs are whole normalized-text AND parsed-TOML equal to root, with raw before/after hashes; they are not topic changes. Package/lock whole normalized text is identical; raw CRLF differences are recorded.

- Compiler33122 exit0,0 errors/0 warnings.
- Cargo70001 six receipt/protocol unit tests passed; full library88551 exit0,17 tests passed, including the original eleven manager/cancellation/30-second idle-expiry tests. Existing five vendor warnings retained. Windows nonregular directory replacement is tested. Unix FIFO test is included but not executed on Windows.
- Actual compiled producer V3 SHA `f50d6d889949c8f8d2cc0891db1a3a890b7adc50308fe7b92f7a6c4da76978d1`: version1/version2 result equality, custom function/static import/raw reference hashes, missing fallback receipt and successful nested YAML extends receipt. Nested extends selects custom without fallback. Proof `producer-1791838997813/acceptance.json` and raw frames.
- Approved verification-only original saved headless scenario65914 exit0:61 jobs all exited,7 cancellations,54 owned HTTP reads, unchanged original oracle. Its copied host uses one exact V3 executable pin; the original f569 helper is unchanged. `replay-preflight.json`/`replay-source` bind producer build sources, compiled dist/binary and test supplement. This is version1 producer/UI compatibility, not Rust/native receipt acceptance.
- Retained SAME six-group packaging audit passes with every original assertion retained and two added stale receipt implementation/bundle refusal checks. ELF controls are mocked, not Linux installation acceptance. Root retained source and transformed guard/provenance are saved.

Initial direct compile bypassed the documented jsonc-parser ESM bundling plugin and produced a real startup failure (`Cannot find ./impl/format`); old executable and reproduced raw error remain preserved. The corrected route is `bun tools/spectral-linter/build.mjs`, followed by Bun compilation of `tools/spectral-linter/dist/host.js`. Initial Cargo failures lacked generated sidecar/notices and did not reach crate verification. A mistaken `spectral_receipts` filter ran zero tests and is not counted. Subsequent correct `spectral::` and full-library runs are the evidence above. Packaging fixture path/dependency-layout and pinned-license byte failures were retained; current audit uses fresh short owned fixture paths and regenerated own verification notices. Borrowed/root and regenerated notices/icons are verification-only build inputs, not new sidecar distribution acceptance.

## Limits and remaining gates

Fresh root app/backend/sidecar/notices closure and actual native original61 plus62nd held-rule refusal remain OPEN. Root actual negative is `artifacts/held-rule-root-proof/native-negative-v1/root-audit.json`: authenticated A→B during held job, old finding published, no cancellation, all62 physically settled and full restoration. No historical result is relabeled green.

Static local loader reads and supplied IO/reference reads are covered. External packages/builtins, remote contents, dynamic/ambient trusted custom JS effects and unresolved filesystem resolution are classified conservatively; existing trusted JS semantics remain supported. No forced package bundling, private require patches or sandbox. No universal external ABA/watcher guarantee: A→B→A between consumed/current checks remains undetected. Filesystem TOCTOU, uninterruptible OS syscalls and unsupported platform execution remain explicit open gates. HTTP source catalog bytes remain captured snapshots; this correction does not refetch them or assert remote freshness.

Primary API references: [Rollup public load/resolve hooks](https://rollupjs.org/plugin-development/), [Bun runtime plugins](https://bun.sh/docs/runtime/plugins), [Rust File metadata](https://doc.rust-lang.org/std/fs/struct.File.html#method.metadata), [Rust filesystem metadata](https://doc.rust-lang.org/std/fs/fn.metadata.html). Pinned bundler implementation was inspected: Node preset has URL plugin, local default loader consumes UTF8 filesystem bytes, runtime bare packages remain external. The implementation does not assume supplied YAML IO covers all custom imports.

All owned handles terminal; no native/profile claim. Topic commit follows exact-path staging only. `/compact` is unavailable in this interface; this report and STATUS provide the handoff instead.
