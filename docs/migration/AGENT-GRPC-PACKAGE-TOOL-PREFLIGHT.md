# Original gRPC package/tool preflight preparation

This source-only proposal is in `artifacts/grpc-package-tool-preflight-preparation`. Root alone may copy and execute the reviewed collector. The agent has not called its resolver, captured installed packages/tools, imported authority, launched a native app, or accessed a profile/cache.

The collector calls the existing root `verifyRuntimeSourcesBeforeImport()` unchanged before and after collection/verification. Its guard SHA is `7c5e234b1343ec222fb806a3638b0a2b9307ede3a6f1aac8f57eba61d1b3acd1`; its complete 42-source ledger SHA is `47889524c7a29957047ebd8da153d958b3f4bc6facc05c5619adf1327a013d7c`. No authority/driver import occurs in this collector. Root must verify the resulting capture immediately before its separately authorized authority import.

Actual default dffa imports require playwright-core, yaml and noble hashes, plus Bun builtins. The collector resolves these with Bun.resolveSync, captures complete ordinary package trees and declared dependency resolution, checks installed versions against the pinned root lock identities, then re-inventories and rehashes. Limits: 16 package roots, 128 resolutions, 6000 package files, 32 MiB per package file, 128 MiB per tool, 512 MiB aggregate. External node_modules targets or unreviewed links refuse. File capture does not prove registry-tarball equality. Optional component branches remain unexecuted.

The original dffa body uses inline HTTP2 and does not call the separate Rust TLS peer fixture or OpenSSL. Those unrelated compiler/rlib/OpenSSL inputs are not required here. App libgit2 initializer/linkage provenance remains a separate mandatory gate, unchanged by package capture.

The collector reads the actual Bun binary, fixed PowerShell/System.Management.Automation paths and five Framework64 files (including csc identity) without loading or executing them. Numeric PE fixed versions are parsed as data. PATH-selected PowerShell must equal the captured standard path. It records PATH hash, execArgv, Bun version/revision and refuses ambient preload/module overrides. This covers declared tool identities, not the entire Windows/CLR loader closure or arbitrary ambient reads.

Root-only commands, after reviewing/copying source bytes, from the literal root cwd:

```powershell
$env:INSOMNIUM_GRPC_INPUT_CAPTURE='reviewed-root-source-only'
bun artifacts/grpc-package-tool-preflight-preparation/preflight.mjs --capture
# Pin the emitted capture.json SHA in the reviewed operator, then:
$env:INSOMNIUM_GRPC_INPUT_CAPTURE_SHA256='<actual capture SHA>'
bun artifacts/grpc-package-tool-preflight-preparation/preflight.mjs --verify
```

The destination `artifacts/grpc-package-tool-preflight-root` must be absent; capture has no overwrite path. This proposal grants no launch authorization. Source-check-to-use races and general ambient/runtime loader completeness remain open. Quarantine, retained process-object physical settlement, full Git13783/profile654/resources43/history20/layout5 restoration and root claim release are unchanged separate operator/auditor obligations.

Preparation checks: 17 pure refusal guards, complete synthetic PE version traversal, exact copied 42 guard/ledger pins, two in-memory syntax transforms; all passed, no live handles. The manifest binds every offered source and check output. No actual package capture or native acceptance is claimed.

Official references: [Bun resolver/which](https://bun.com/docs/runtime/utils), [module resolution](https://bun.com/docs/runtime/module-resolution), [JSONC](https://bun.com/reference/bun/JSONC), [PE format](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format), [VS_FIXEDFILEINFO](https://learn.microsoft.com/en-us/windows/win32/api/verrsrc/ns-verrsrc-vs_fixedfileinfo). Commands use Bun only. This interface cannot invoke `/compact`; the frozen manifest/report, topic commit and STATUS are the handoff.
