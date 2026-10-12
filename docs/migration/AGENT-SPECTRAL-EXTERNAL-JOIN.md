# Captured external references → structural preview/generation

2026-10-12, isolated shared-ui handoff against root e762057. Product changes are restricted to ApiDesign's check pipeline, optional structural source input, the existing worker, and one pure source adapter. No backend/provider/SDK/dependency/style/native profile changes.

## Behavior and authority

Native Validate/Generate first awaits a fresh accepted Spectral job, then posts that same validated captured catalog to the structural worker. Main/attached bytes must exactly match the captured raw saved input; external bytes come only from the returned catalog. The adapter revalidates URI/name/origin/uniqueness through the existing catalog utility, puts main first, parses bounded raw bytes into Scalar's existing filesystem API, and never fetches or persists references. Original source, attachments and example metadata remain unchanged. Browser fallback omits the optional input and keeps original attached-only analysis.

Existing source/workspace/repository/options guards remain. The native await holds workspace work until physical host settlement, including cancellation; structural analysis/generation is not dispatched after a stale or cancelled reply. Original non-check ApiDesign bytes are preserved. Shared editor/layout/tokens remain unchanged.

Capacity: **32 attached files**, not 32 total external files. No new external-count cap is introduced. Each parsed document remains limited to2MiB; captured raw aggregate and existing parsed aggregate remain limited to8MiB. Producer source/result/transport limits, worker15s deadline and native CPU/process quotas remain unchanged. A real catalog with main+40 repository references validates and generates successfully. This is bounded capacity evidence, not unlimited/exhaustive reference parity.

## Evidence

- Strict predecessor scenario4771 failed after all original six profiles/seven cancellations: actual producer returned repository main/three external sources with warnings only, while Generate remained disabled. Immutable negative: `artifacts/spectral-external-join-proof/negative-disconnected-catalog`.
- Initial fixed replay97694 passed UI assertions but exited1 because the source freeze checker correctly detected the deliberate owned fixture `nested/value.yaml` revision change. Preserved in `negative-deliberate-fixture-mutation`; not accepted as a green run. The new saved entry declares exactly one owned mutable fixture path with both known revision hashes. Every other source, ruleset, executable and emitted asset remains byte-frozen. No blanket directory exclusion.
- Final compiler45526: exit0, zero errors/warnings. Final saved scenario7672: exit0, six original profiles/seven lifecycle cancellations plus12 repository/HTTP×dark/light×1440/900/760×600 profiles. Actual producer6231e95d returned complete ranges and distinct same-basename/nested sources; readonly navigation and raw persistence checks pass. Changing external bytes between Validate and Generate changes the generated JSON body to the freshly linted `two😀` value. Exact36 HTTP reads belong to two actual producer jobs per HTTP profile; the worker performs zero extra fetches.
- Main+40 repository references validates and actually generates; captured attachment at the same URI overrides an existing repository file and actually generates `attached😀`. All48 normal owned executable processes physically exited; seven cancelled jobs publish no result. Browser/server closed; exact executable-path process audit finds zero live matches. These fixtures are explicitly **native=false**, not Rust/jobtree/registered-Git acceptance.
- Retained saved schema-resources:83 checks, exit0 (`d33e76`). Retained serialized contract:168 checks/11controls/8signing controls plus8external/68controls, exit0 (`4137cb`). Frontend `bun run --bun build`: exit0 (`1ddb28`),49 emitted files. Manual Bun eval13 guards bind actual41-source host output and verify last-schema resolution, main ordering, raw immutability, mismatch/duplicate/unknown/missing refusal, unresolved-reference/browser fallback,32attached/2MiB/8MiB bounds, with fetch replaced by a throwing guard.

## Frozen handoff and replay

Run `bun tests/ui/spectral-api-design.js` with `INSOMNIUM_SPECTRAL_FIXTURE_EXE` pointing to the exact6231e95d executable, or use root's target-specific default binary path. This lane used root's existing `src-tauri/binaries/spectral-linter-x86_64-pc-windows-msvc.exe`; the scenario verifies its full SHA before copying it to the owned fixture. No new tracked test script beyond the existing saved scenario/fixture/helper edits.

Final audit: `artifacts/spectral-external-join-proof/final/audit.json`, SHA256 `5df64fd25ca49a0d7ee39b97c8aa032b731a5fef3061200bf04f82dce387739a`. Eight guarded path originals/new SHA/byte counts are in `delta`; frozen offered bytes map `final/handoff/<path>`. Exact688 input hashes map `final/run/preflight.json`, source/harness snapshots `final/run/input-snapshot/<original path>`, emitted fixture/worker `final/run/bundle`, actual executable/rules/files/jobs `final/run/host`, frontend hashes `final/frontend/<path>`, retained scenario outputs `final/regressions`, and manual receipt `final/manual-guards.json`. `outputHashes` binds acceptance/process/job receipts. All inputs and proof are frozen; no live handles.

| Offered path | New SHA256 |
| --- | --- |
| src/lib/components/ApiDesign.svelte | 224f996048c2d62c73691818367c374daf168c890b5595efe9db1a6d192daae7 |
| src/lib/openapi.js | cf135bd8add1423491b4c0d85778af3c1bb1792a9a48d467a75dd189da6c86ec |
| src/lib/openapi.worker.js | a688808eeec147657b7274ba8eff310afb4f51c6f4fb52f100734cea1c8f0b39 |
| src/lib/openapi-captured-sources.js (new) | b4ae4aec89b1e1d07b2f76bad3a5b6ee214515ca81f67a6ce8d24bf54123a848 |
| tests/ui/spectral-api-design.js | e90054427851ef53562dd86660d5b2565227999796ddc693c3c5394695873b3d |
| tests/ui/helpers/spectral-api-design.js | 05c63484078a6ca3f9a37adb0fd8d2a66885e2ec337be309371a261bca9de831 |
| tests/ui/helpers/spectral-fixture-host.js | 906079f032c79ad3d699166972b68b4adbb5a85ac0401b65430629ddc58db07b |
| tests/ui/fixtures/spectral-api-design.svelte | 7874ccea2cd22099e9bff8d67a6c7e268f0fd5026f6275a8d1b9e0b59c08002c |

Copied CodeEditor/catalog/client and prior dirty baseline are not offered. Supporting isolated source closure is explicit, not a whole-current-root or current native-generation claim. Prior Spectral/GraphQL/Runner/CRUD proofs remain immutable.

Primary source consulted before implementation: [Scalar official parser README](https://github.com/scalar/scalar/blob/main/packages/openapi-parser/README.md), installed0.29.7 README and `dist/utils/dereference.js`/`make-filesystem.js`. Its filesystem dereference contract supplies the existing local-data resolver; no fetch/read plugins were added.

Remaining gates: current-root independent integration/replay; fresh native candidate and real Rust commands; repository consumed-read/generation lease; full reference/version/platform/distribution parity. Structural diagnostics still use main-document positions and need a separate source-aware/full-range topic. Full migration remains open. Root owns topic commit and STATUS update. `/compact` is unavailable in this interface; this handoff replaces any claim of compaction.

## Root integrated captured-source checkpoint — 2026-10-13

Root independently verifies agent687 immutable inputs plus one exact two-revision owned fixture (688 checked inputs), output hashes/frontend49 and eight offered byte guards. Current native helper9943 callbacks are preserved through the exact efa5-based differential; three added case controls route through optional revision callback, and four spec identity assertions use the actual adapter identity/default original preview identity. Git-applied CRLF whitespace is normalized before adapter plumbing; original partial copy/patch hash guards passed before resume. New producer f5690ce1 strict pin is preserved over old6231 frozen proof. No assertion removed or count weakened.

Root compiler85618 exits0/0errors/0warnings; SAME whole saved headless scenario37161 exits0: six original profiles/seven cancellations,12external profiles,48actual f569 hosts all closed,36HTTP reads, main+40 actual Generate and attached precedence. Schema83 (3150ad), serialization168/11/signing plus external8/68 (f37e78) pass. Root production build7c120d exits0; manual actual-capacity/no-fetch/raw equality/order/missing/duplicate/unknown/unreturned/fallback/2MiB/8MiB/32attachment13 guards pass. Selected source hashes remain unchanged. Full archived root source/assets/results/guard/regression proof: artifacts/spectral-external-root-proof/root-audit.json.

This accepts the current frontend/captured-source structural slice, explicitly native:false. Prior d478/f569 native20 accepted85730 and is historical after this parent/worker change. Native external adapter preparation bf28f056/eightpaths/doc c661cd57 is frozen but requires independent integration and a fresh app/frontend/worker/source/sidecar capture before actual48native jobs/restoration. Repository consumed-read/in-flight changes, full structural diagnostic source/ranges, versions/platform/private/distribution/full original migration and UX remain OPEN. License override handoff efb06999 is separate. All root/agent handles terminal, no native profile claim. /compact unavailable; explicit handoff.
