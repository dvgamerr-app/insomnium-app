# Rename and file/directory merge review

The Windows native fixture reproduces a rename/rename history and a file at `collision` competing with a directory containing `collision/child.txt`. Both histories contain the complete managed collection. The rename conflict preserves the original/current/incoming byte paths and modes; selecting every current or incoming side produces the exact root tree of that side.

libgit2 can expose a conflicted parent file while keeping a directory child at stage0. Previously the final collision guard correctly rejected selecting the file, but the child was not available to review. Preparation now rebuilds a fresh in-memory index and promotes stage0 paths that collide with any conflict path to explicit ancestor/current/incoming file entries from the pinned trees. Directory tree entries are not file sides. Every promoted path requires a choice; selecting a missing side explicitly removes that file. No unreviewed child is silently deleted.

Existing exact descriptor, complete choice, duplicate path and file/directory prefix collision guards remain mandatory. A mixed selection that keeps the parent file and directory child refuses before a target, journal, ref, disk-index or workspace transition. Preparation reads raw bytes without checking out external paths. Single-base promotion may expose that real ancestor file. For recursive bases, a promoted path has no fabricated stage1 entry; the UI labels a missing ancestor entry `No ancestor entry`.

Saved commands:

- `bun tests/ui/git-merge-paths.js`: real rename and file/directory complete choices, mixed/incomplete refusal, unchanged workspace/ref/index and no advancement artifacts. Run1791376467375 passes5 groups.
- `bun tests/ui/git-pull-paths.js`: actual native smart-HTTP Pull, pinned per-side path/content review, cancel, mixed refusal with fresh retry, both complete choices through a second review and confirmation. Run1791376482685 passes7 groups with7 advertisement/pack rounds; exact complete selected root (including modes and managed files), ordered parents, full workspace/index and cleanup verified.
- `bun run check`; targeted Rust formatting and Cargo check/Clippy `-D warnings`; `bun tests/ui/build-recovery-copy-probe.js`. Fresh build1791376053818/1791376441357/result0.

Official API/fixture references: [git2 MergeOptions](https://docs.rs/git2/0.21.0/git2/struct.MergeOptions.html), [Git mktree](https://git-scm.com/docs/git-mktree), installed git2-0.21.0 Index/Tree byte-entry APIs. Existing subsystem and documented Git plumbing reused; no initializer is needed.

This verifies these real rename/rename and parent-file/child-directory cases. Other rename histories, server/source shallow histories, network uncertainty, fault/provider/platform/clone/push/full parity remain required. Full migration and the later shared input/UX goal are unfinished. Feature commit and compact handoff must precede the next capability; do not claim an unavailable compact tool ran.

Current-build regression evidence: recursive bases1791376528168 passes8; preparation1791376599665 passes11; edge Pull1791376622570 passes5; divergent Pull1791376659299 passes5 including actual post-ref Windows write refusal/authoritative recovery/no duplicate/fresh200. All apps exit0 and owned servers/handles are released. Final compiler0 errors/0 warnings and diff check pass.
