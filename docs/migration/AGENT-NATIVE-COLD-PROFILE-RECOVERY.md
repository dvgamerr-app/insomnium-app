# Cold native profile binding correction and guarded recovery

2026-10-12, root reviewed authorization. No native relaunch or profile mutation
in this lane. Shared UI retains isolated CRUD namespace; root separately owns
default SDL. All own handles terminal.

Actual cold CRUD on proven current99f88 executable failed before the scenario
callback: Tauri returned exact fixed app_data_dir, but it remained absent until
host55764 closed. Host exited0/native-hidden. Closing created ONLY
`.window-state.json`,212bytes, SHA
`afa8dbc1198f6677fb053f160a03b00e106a8f670b638df2431827886107752f`,
created/modified `2026-10-12T05:34:40.379Z` within recorded host lifetime.
No workspace/store/cookies/fixtures existed. Old marker remained reserved with
zero recorded launches. Negative audit48f371 and original marker are immutable.

[Tauri's app_data_dir resolver](https://docs.rs/tauri/latest/tauri/path/struct.PathResolver.html#method.app_data_dir)
returns a suggested application path; it does not promise directory creation.
The old15312e19 helper incorrectly waited2seconds and required lstat success
before the first UI Save. New helper records exact native-resolved path/PID and
validated candidate ownership before checking directory. An absent directory is
allowed ONLY for the original first binding with initially-absent proof. No mkdir
is added. KnownFolder parent and candidate byte hashes/identity are revalidated;
present directory requires exact realpath/nonlink. Subsequent missing owned
profiles refuse. Pending/unverified path binding cannot restart. Existing default
native helper behavior and NativeApp b5a7d840 remain unchanged.

Existing saved CRUD scenario already checks true initial one-collection/disabled
Delete/keyboard behavior, clicks Save, then performs lazy buffer capture that
validates the created owned profile before any fixture writes. No assertion changed.

## Frozen source delta for root topic integration

| File | Before | After |
| --- | --- | --- |
| `tests/ui/helpers/native-profile-ownership.js` |15312e1964f8bbdbf6c989471c6f47d3c064bdf6a08f38d2a1a13bd430000ecc|5a2f3739220760a54fbc6eaa39971af6d243bd50258ba89fd7454c920bac9ce0|
| `tests/ui/native-probe-identity-guards.js` |5dee902d9e5484f8ac2c106e51cda95e3f15dc44ae35743ce7dc5c8d895a13f1|fb459e8f5a163568d7323932fc4a1aecbd79c09758543b6176292ad14e1baba2|
| `tests/ui/native-cold-profile-guards.js` |new|7ebc843c6a2ff6f9eebbece278a32d8204ff1cd4b32098b31bd6f73aee4df8c3|

Compiler73494/9d5f4e: terminal0errors/0warnings. Original identity17 guards pass;
new cold23 guards validate original first absence versus missing retired profile,
foreign path/identifier, live/pending owner, failed foreign PID/reason/visibility,
recovery-extra-file and incorrect oldproof refusals. No native launch/profile
access in guard scenarios. Root must review/integrate exact source before relaunch.

## New recovery record preparation, not executed

Artifact-only saved administrative script
`artifacts/prepare-current-crud-directory-recovery-20261012.mjs`, SHA
`86588179ef76a1c99da0195106dda0a138f52ba04e51b7251623c8d26416dbe1`,
passed readonly c32fd1 from shared cwd. It pins exact hashes of prelaunch, failed
host result, old reserved marker, negative audit and original window-state bytes;
validates all752 frozen source and51 frontend snapshots, exact exe99f88/build
record/embedded closed ID, consumed old15312e19/b5 source, first prepared marker
time after candidate completion, recorded host timing, exit0/native-hidden/PID,
KnownFolder parent and owned normal directory/only normal212byte window-state,
exact SHA/creation/mtime, and current absence of old PID (PID reuse also refuses).
Existing original reserved marker must match its frozen bytes exactly.

Native path success is explicitly INFERRED from the frozen old bind reaching its
ENOENT line50 AFTER exact nativePath comparison. No independently recorded native
resolve_directory return is invented. Recovery scope is limited to this exact
failed first attempt; extra files, an unowned profile, foreign candidate or live
old PID refuse.

After root review, shared may run the copied saved script in its own cwd with
`--create-reviewed-record`. It creates ONLY a new marker
`artifacts/native-crud-recovery-directory-20261012/profile-ownership-recovered.json`,
with inherited exact candidate binding, owned-exited failed PID and observed
exit, explicit inferred-path provenance, immutable old-marker/proof hashes and
inventory. It never overwrites/moves/resets the original marker or profile.
Relaunch must use this NEW proof path plus revised helper, frozen explicit
supplemental source closure and independently reaudited same executable/assets.

`artifacts/native-cold-profile-fix-20261012/handoff-freeze.json` binds final4 source
files, copies6 negative evidence files and original153 helper bytes. Current
native9b3f/default and99f88/CRUD immutable manifests are not rewritten. No product,
backend, identity, permission or dependency changes; no new native acceptance.
Parent owns STATUS/topic commit. `/compact` is unavailable; this is the handoff.
