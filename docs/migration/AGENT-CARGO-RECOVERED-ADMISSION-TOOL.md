# Exact recovered Cargo archive admission tool

The revised artifact tool `artifacts/cargo-recovered-admission-tool/admit.mjs` is prepared for root review. This lane has **not executed it**, including dry-run. Root's failed dry-run of the prior46d1 version is retained below. No cache, root, private admission, resources, profile or build was changed by this lane. Parent-owned native build62029 was left untouched during original preparation. Own live handles: none.

Source SHA256: `66d353b8ba023405ef9e4067d67ce60c6fab661d33f09f39ae4299b14676956d` (14889 bytes). The tool admits only the three archives in the accepted recovery receipt: openssl-probe0.1.6, tree_magic_mini3.2.2 and wl-clipboard-rs0.9.4, totaling72660 bytes. No collection or linkage promotion occurs.

The earlier reliability revision replaced the hash helper with standard `createHash` from `node:crypto` under Bun and renamed the script constant to `CARGO_CACHE_ROOT`; its46d1 source and8-file proof remain immutable. Root's actual dry-run then failed before cache/stages because Bun returned literal `D:` for the ordinary absolute `D:\` root. That negative receipt is retained verbatim in the new proof.

This revision changes only `ordinaryDirectory`: check directory/non-symlink metadata first, then accept raw `D:` only when the supplied path exactly equals the known absolute `resolve('D:/')`. For every other path, a bare drive-relative realpath is explicitly refused before generic normalization. Normal canonical path checks remain unchanged. There is no drive-relative environment or alias exception. Exact inverse substitution restores all14560 bytes of the46d1 source. Syntax passed without executing this module. The revised source tokens below bind these exact new bytes.

Manual guard cases: ordinary absolute `D:\` plus raw `D:` passes; ordinary `D:\` plus canonical `D:\` uses the original comparison; raw `E:` or `d:` for `D:\` refuses; raw `D:` for a subdirectory, drive-relative supplied `D:`, or alias supplied `D:/` refuses. Non-directory or symbolic-link metadata refuses before any canonical exception. These are source-reviewed cases, not a claim of repeated root runtime acceptance.
## Future root commands

After independently reviewing and copying the exact frozen source bytes into the same artifact path in root, root may run this read-only command from canonical `E:\.dvgamerr-app\insomnium-app`. Rehash the destination first: Git checkout newline conversion may change script bytes, and the supplied source guard deliberately refuses any such change. The frozen handoff copy is authoritative for these commands.

```powershell
$env:CARGO_HOME = 'D:\home\.cargo'
bun artifacts/cargo-recovered-admission-tool/admit.mjs --dry-run --source-sha256 66d353b8ba023405ef9e4067d67ce60c6fab661d33f09f39ae4299b14676956d
```

Only after the native source freeze is terminal and Cargo/cache writers are stopped, root may deliberately execute:

```powershell
bun artifacts/cargo-recovered-admission-tool/admit.mjs --write --source-sha256 66d353b8ba023405ef9e4067d67ce60c6fab661d33f09f39ae4299b14676956d --token cargo3:5156ae8fa74230bd84ddf53706b8961a5e4d6c14e7069138394c1ccc5d782873:21d82d6f97c1aae7b878895bc76b116312d649d732c76c9fb8f5788d5a6a48f1:66d353b8ba023405ef9e4067d67ce60c6fab661d33f09f39ae4299b14676956d --exclusive-cache-window --after-native-freeze
```

The two final flags attest root's exclusive window and terminal native build; the tool does not inspect or terminate processes. The intent token is a source/input identity guard, not a secret or authorization system. No other root, home, namespace, archive or destination selector exists.

## Admission and failure behavior

The tool checks Windows, canonical root cwd, explicit canonical Cargo home, its own source hash, current Cargo.lock, the immutable recovery receipt/parser, current production parser, registry configuration, all three archive checksums/counts, published manifest identities and complete parsed entry/text hashes. Frozen archive inputs are reparsed with the pinned data parser. No ambient source discovery or package code execution occurs.

Every existing cache namespace must be an ordinary canonical directory. Any mismatching fixed archive filename in any namespace refuses admission; exact existing destination bytes skip. Namespace directory identities are compared before each publication and after the complete run. Root's exclusive cache window remains necessary: portable path operations do not constitute protection against hostile concurrent filesystem replacement.

Write mode creates a unique exclusive stage inside the existing destination namespace, flushes and closes it, verifies bytes, journals publication intent, then uses a same-volume hard link that cannot overwrite an existing destination. EEXIST is accepted only after exact byte/hash validation. No rename-overwrite or copy fallback exists. Cleanup removes only the recorded closed stage with matching file identity. Published cache entries are never removed or rolled back. A failed/interrupting run emits its completed dispositions, owned-stage cleanup state and synced JSONL receipt; an interruption between publication and verification can be resolved from the preceding publication-intent and exact target bytes. Abrupt process termination can leave an owned stage; the tool never recursively cleans unrelated files.

Dry-run performs only validation and stdout receipt output. It does not create a journal or directory. Write mode journals under root `artifacts/cargo-recovered-admission-tool-runs/`. Both modes hash current packaged native notice files, private source snapshots/admissions and producer packaging stamp before/after. The tool never invokes the collector, changes an admission pointer, rewrites resources, builds or launches an app. A later deliberate recollection is a separate topic; historical unavailable-source receipts and all discovery/target-linkage gaps remain valid historical evidence.

## Verification and remaining gates

An isolated `Bun.Transpiler.transformSync` syntax invocation passed exit0 without resolving or executing this module. Manual source review checked closed rows, write token, namespace conflicts, no-overwrite linking, identity-restricted cleanup and partial journal ordering. A combined Bun eval containing transpilation and a file-hash loop crashed with segmentation fault0x48/exit1; that tooling negative is retained in review.json. The isolated syntax check passed and PowerShell independently rehashed all35 proposal,3181 authority and2741 original collector files with unchanged manifests. No runtime admission/dry-run/publication acceptance is claimed.

References: [Bun Transpiler](https://bun.com/docs/runtime/transpiler), [filesystem link API implemented by Bun's compatibility layer](https://nodejs.org/api/fs.html#fspromiseslinkexistingpath-newpath), [Windows hard-link volume restrictions](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createhardlinkw). No Node executable was used.

Root dry-run review, deliberate writes, partial-run/publication acceptance and any new notice generation remain pending. Full platform, redistribution and target-linkage coverage remain open. This interface cannot invoke `/compact`; the frozen manifest and STATUS record provide the handoff.
