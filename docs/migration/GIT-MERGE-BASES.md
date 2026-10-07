# Recursive merge bases and advancement recovery

Verified checkpoint: 2026-10-07. Native bases1791374388057 passes8, actual smart-HTTP Pull UI1791374071314 passes3, current reader20/preparation11/writer8/divergent5/contract9/check/Cargo/Clippy and native build1791373637707/1791374019966/result0 pass. This document does not mark full Pull/Merge or migration complete.

The merge preparation command requires complete selected histories. It obtains every actual common ancestor with `Repository::merge_bases`, sorts full OIDs, and supports at most 64 actual bases. A single-base merge keeps the previous complete-root-tree merge. Multiple bases use `Repository::merge_commits` with recursive defaults: libgit2 consolidates the ancestors and carries conflicting base regions into the virtual ancestor. It does not choose one actual ancestor. No `no_recursive` flag or recursion limit is supplied, because reaching libgit2's recursion limit selects the next ancestor instead of merging it.

The result still describes each final conflict with exact byte path/OID/mode triples. Its ancestor entry may describe a generated virtual-base blob rather than a blob in one historical commit. Existing bounded native content previews read that exact object. Preparation and cancellation may retain unreachable objects, but never move refs or write workspace/on-disk index state.

| Operation | Candidate identity | Resolution pin | Journal |
| --- | --- | --- | --- |
| Up to date | Existing source commit | No resolutions | No advancement |
| Fast forward | `mergeBaseOid = sourceOid` | No resolutions | Schema2 |
| Single-base divergence | One actual `mergeBaseOid` | `expectedMergeBaseOid` | Schema2 |
| Multiple-base divergence | `mergeBaseOid = null`, sorted unique `mergeBaseOids` | Exact `expectedMergeBaseOids`, no single base | Schema3 |

Schema3 is an explicit extension of the same-branch journal. `advance` contains `kind: "merge"`, the incoming OID and 2..64 sorted unique actual base OIDs; `mergeBaseOid` must be absent. Native application/recovery verifies that the recorded base set equals the actual complete base set of the pinned old/incoming commits, verifies exactly two ordered target parents, rejects ancestor/up-to-date relationships, and validates every involved managed collection tree. It performs graph validation rather than merge computation under StorageState. Schema2 rejects an attached base list and requires exactly one actual base for divergence. Schema1 checkout recovery remains separate.

The frontend verifies full lowercase OIDs, bounds, uniqueness/order, null single-base field and merge kind before admission. Private reviews retain the native set through resolution and emit schema3 only for multiple-base candidates. The existing full workspace reconciliation, final review, run drain, baseline persistence, immutable source proof and authoritative recovery paths remain in use.

Saved acceptance scenarios:

- `bun tests/ui/git-merge-bases.js`: real clean two/three/nested recursive graphs compared against Git's complete result trees, conflicting bases/pinned virtual ancestor preview, exact resolution set, malformed schema2/schema3 graph admission, actual Windows post-ref write refusal/authoritative full workspace recovery and synthetic old-before/new-after/contradictory old-after reader states.
- `bun tests/ui/git-merge-bases-ui.js`: actual loopback smart-HTTP recursive Pull, virtual/current/incoming previews, cancellation, resolution/second review and schema3 confirmation preserving full workspace, selected blob, unrelated files and ordered parents.
- `bun tests/ui/git-merge-contract.js`: injected candidate validation/coordinator contract, supplementary to native evidence.
- Regression: saved merge preparation, advancement reader/writer and divergent Pull scenarios on the same successful build.

Sources: [git2 0.21 MergeOptions](https://docs.rs/git2/0.21.0/git2/struct.MergeOptions.html), [libgit2 merge_commits](https://libgit2.org/docs/reference/main/merge/git_merge_commits.html), installed git2-0.21.0/libgit2-1.9.7 headers/source. Existing documented APIs reused; no initializer/generator is needed. Native checks use Cargo with the existing MSVC environment; JavaScript tooling uses Bun only.

These scenarios verify the listed two/three/nested graphs, not every possible history or a process/power interruption. Additional history/provider/platform/network-fault/path choices and full migration parity remain required until separately verified. The multiple-base capability handoff is saved in STATUS; commit by topic and compact before the next capability, without claiming an unavailable compact tool ran.
