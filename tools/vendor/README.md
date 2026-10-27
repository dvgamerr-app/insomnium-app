# Restorable native sources

`src-tauri/vendor/` is generated and ignored. Git retains the pinned upstream archive SHA256, exact file inventory/tree SHA256 and only changed/added source files in `overrides/`. The small protobufjs Google reference set is retained here in full, including its original license and provenance.

`bun run prepare:vendor` restores missing directories before the standard prepare/build/dev/Tauri/native-check commands. Direct Cargo invocations require this command first: Cargo resolves path patches before the application's `build.rs` can run. Desktop CI already runs `bun run prepare`.

Restoration uses the project archive cache or `$CARGO_HOME/registry/cache` (`~/.cargo` by default) before downloading the exact version from static.crates.io. Archives are checked before use; the complete patched output must match its pinned tree hash before publication. `bun scripts/prepare-vendor.mjs --offline` forbids downloads. Existing source directories must already match the manifest; local edits are never overwritten. Repeated builds validate existing files without downloading or rewriting them.

Patch maintenance must update `overrides`, the manifest inventory and tree hash together. Preserve and review changes made inside a generated vendor directory before removing it. Explicit CRLF entries and `-text` Git attributes preserve the original source bytes across checkout platforms. Cargo path patches and native notice paths remain unchanged.

Verified: 11 directories/475 files restored offline from existing Cargo archives, byte-identical to the original tree; idempotence, local-edit refusal, traversal refusal and corrupt download refusal. Evidence: `artifacts/vendor-restore-20261027/verification.json`. No native executable rebuild is claimed. Verification copies `artifacts/vendor-restore-20261027/{clean,fetch-check}` remain: automatic approval review rejected their recursive cleanup (`blocked by policy`); no retry or alternate deletion was attempted.

Primary contracts: [Cargo path patches](https://doc.rust-lang.org/cargo/reference/overriding-dependencies.html#the-patch-section), [Cargo build script lifecycle](https://doc.rust-lang.org/cargo/reference/build-scripts.html#life-cycle-of-a-build-script), [Bun Archive](https://bun.com/docs/runtime/archive).
