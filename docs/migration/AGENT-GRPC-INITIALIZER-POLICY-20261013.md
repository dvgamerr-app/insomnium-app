# Original gRPC initializer eligibility proposal

Source-only refinement of the immutable 49-file owned-runtime offer. No native process, profile read/write, Temp directory, marker, move, deletion, Cargo/cache, browser, or root modification occurred. Root retains authority to review a concrete receipt; this agent issues no authorization. UI7/default-helper/006b/49 offers remain unchanged.

## Authentic initializer evidence

New artifact directory: `artifacts/grpc-initializer-policy-evidence`. Downloaded official crates with Bun fetch, verified SHA against current root Cargo.lock, extracted with `tar -xzf` into this directory only:

| Crate | Locked SHA256 |
| --- | --- |
| git2 0.21.0 | ddddbf932745a6be37109b6112d3ee09696106f848449069d3a57bba937ab82e |
| libgit2-sys 0.18.8+1.9.7 | 7f7c568b25d7489bc3fb2988ed69ab111d2944d2f5fec3d5c987fe545ea97b50 |

Root `src-tauri/src/git.rs:245–278` exclusively creates absent `git-v1/repo-ID`, rejects links, disables reinit/external template and sets main. Existing directory opens separately; failed initialization remains on disk. `git2/src/repo.rs:3556` clears external-template flag. In pinned libgit2 `repository.c:2534–2646`, that excludes global/system template copying and uses `repo_template.h` internal files. `repository.c:2098–2115` writes HEAD directly, without creating reflogs.

| Initial file | Bytes | SHA256 |
| --- | ---: | --- |
| .git/HEAD | 21 | 28d25bf82af4c0e2b72f50959b2beb859e3e60b9630a5e8c603dad4ddb2b6e80 |
| .git/description | 73 | 85ab6c163d43a17ea9cf7788308bca1466f1b0a8d1cc92e26e9bf63da4062aee |
| .git/hooks/README.sample | 177 | 7319d7f1803fda2b3416143e426b9ec4c3c3c817c75188b2b82cb3e68ff293ab |
| .git/info/exclude | 113 | fdb7dc7be17051c3c5067cdf2b8fdf2ca3a8daf2b5e91f34c6ce1ff3a94c5f6a |
| .git/config | Runtime bytes required | No invented SHA |

Exactly ten initial directories including candidate root: empty relative path, `.git`, hooks, info, objects, objects/info, objects/pack, refs, refs/heads, refs/tags. No index, logs, packed refs, remotes, extra hooks, external template, or object files at successful initialization. Windows `.git` hidden attribute is deliberate; hidden is not treated as reparse. Internal executable-mode defaults are not an NTFS ownership proof.

## Config and compiled-library prerequisites

`repository.c:2277–2378` sets core.bare=false, repositoryformatversion=0, filemode from chmod probe, logallrefupdates=true; ignorecase=true only on case-insensitive filesystem, symlinks=false only if support disabled. Windows symlink support needs global/system opt-in plus filesystem support (`2184–2212`). Windows p_chmod calls `_wchmod` (`util/win32/posix_w32.c:747`). No filesystem/global configuration observation was made here. Natural nonbare worktree means no core.worktree entry; shared mode and SHA256 extensions are not requested.

Locked crate does not alone prove compiled library: `libgit2-sys/build.rs:87–119` can choose system libgit2 1.9.7..<1.10 rather than vendored source. Its vendored branch enables iconv only on Apple (`301–303`). Root must bind actual final build output/generated feature header/link provenance to the executable. Generator currently refuses system/other-version/iconv/other-target provenance. Its provenance inputs are assertions provided by caller, not independently verified build evidence. Do not treat synthetic pure-test provenance as authentic.

## Commit, object, and reflog expectations

Current default native entry has exactly one `gitCollection` call and no later Git commit/checkout/restore command. Source-derived expected graph is the initial three exact snapshot blobs, three resource-group trees, `.insomnium` tree, root tree, one initial commit: nine unique objects for the actual fixture, counted from derived IDs rather than admitting arbitrary object paths. Blob bytes are opaque original UTF8 YAML; no persisted-resource rewrite. Exact loose-object decompression/OID/tree/author/message/no-parent/ref checks remain in the prior `git-objects.mjs`.

Root `git.rs:796–817` creates commit with update_ref=None, then transaction sets refs/heads/main with signature and `commit: Insomnium resources`. Locked but unchanged HEAD transaction node unlocks without modification (`transaction.c:347–368`). Branch update goes through refdb_fs write_tail (`1658–1674`) and invokes maybe_append_head (`1570–1586`). `refdb.c:340–380` follows symbolic unborn HEAD and recognizes matching main even when old ref does not exist. Therefore **both** `.git/logs/refs/heads/main` and `.git/logs/HEAD` are expected after successful first commit; each zero old OID → actual commit OID, actual fixture signature, TAB, exact message, LF. Serialization is pinned `refdb_fs.c:2174–2211`; no init-time log is expected. Corresponding logs/refs/heads parent directories and exact object-prefix directories must be added only for committed stage. Unknown index, lock, pack, sibling, extra ref/object or partial-init path still refuses cleanup.

The final postexit candidate must equal this derived manifest. A future workflow adding Git commands would require a new audited policy; it is not present in this current entry. Original 13783-file Git baseline remains exact, separated from the sole registered candidate; no cap widening/filter/deletion.

## Proposed generator and verification

`eligibility.mjs` exports pure `templateFiles`, `validateConfig`, `proposeEligibility`. It performs no IO/profile access/commands. Inputs are pinned internal header text, already-observed exact initialized files/directories, and root-supplied build provenance. Narrow fresh-core grammar refuses includes, remote/worktree/extensions, duplicate/unknown entries and unsupported values. It computes all five byte hashes from the accepted observation, yielding `status: proposed-root-eligibility`, `authorized:false`, `runnable:false`. Root independently binds pre-init absence/registered ID/actual init reply/current app closure before accepting a concrete receipt, then actual commit/exit/layout/protected/Git manifest before phase2. This generator cannot replace those guards or approve a quarantine.

Commands run only in isolated worktree:

```
bun artifacts/grpc-initializer-policy-evidence/guards.mjs
bun build artifacts/grpc-initializer-policy-evidence/eligibility.mjs --target=bun --outdir artifacts/grpc-initializer-policy-evidence/syntax
```

Pure 22 refusals and two supported config shapes pass; syntax bundle passes. All observations/provenance used by guards are explicitly synthetic. Template hashes derive from checksum-authenticated crate source, not a runtime repo. Final `audit.json` binds selected upstream/root snapshots, crate archives, generator, guards, output, report and prior49 proof hash; it is not the whole native source closure. Full original gRPC/native cleanup/platform/physical creator/unobserved process birth/adversarial filesystem race gates remain open. Handles:none; profile unclaimed. `/compact` unavailable in this interface; explicit handoff only.

Primary references consulted: [libgit2 initialization options](https://libgit2.org/docs/reference/main/repository/git_repository_init_options.html), [Git repository layout](https://git-scm.com/docs/gitrepository-layout). Version-sensitive implementation evidence comes from the checksum-pinned archives above, including their COPYING license, rather than assuming current documentation matches compiled bytes.
