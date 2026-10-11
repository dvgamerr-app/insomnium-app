# Owned plugin helper integration

The runtime, worker/session transport, registry and request renderer now activate the previously verified helper foundations together. Real request services supply captured model/history/cookie data and saved-ID native sends; guest data never supplies host capabilities. ExtraRenderInfo, nested helper ancestry, callback generations, interaction waits, synchronous app calls and retained DOM callbacks use the original operation owner. HTTP/gRPC completion permits owned dialog continuation without promoting cancellation. OAuth preview uses its registered editor lease and history guard.

The integration includes the isolated Buffer generator/dependency lock, clipboard-manager native registration and permissions, operation-owned save commands and their platform source, COOP/COEP prerequisites, app dialog/prompt component support, and saved helper/native acceptance assembly. It preserves the existing application layout. Response history menu and collections CSS changes are separate pending work.

## Reproducible checkout verification — 2026-10-12

The staged application, backend, generator/dependency and scenario files were exported with `git checkout-index` into `artifacts/plugin-helper-integration-checkout`. That checkout started without `node_modules`, `.svelte-kit`, `build` or generated sources. It contains the proposed Git tree, rather than a copy of the entire dirty workspace. The verified code tree was `20d97f74b86173d5f89601a85842601880ef05b7`; final commit adds this documentation and migration checkpoint entries.

Commands executed inside that checkout:

- `bun install --frozen-lockfile`: exit0,248packages, prepare generated OpenAPI validators and the isolated Buffer source.
- `bun run check`: exit0,zero errors/warnings.
- `bun run build`: exit0,frontend build17.12s.
- Saved headless scenarios: `bun tests/ui/plugin-dom-render-owner.js`, `plugin-helper-render.js`, `plugin-app-sync.js`, `plugin-dom-session.js`, `plugin-app-dialogs.js`, `plugin-save-client.js`, `plugin-helper-context.js` and `plugin-cancel-recovery.js` all exit0.
- Windows `cargo check --manifest-path <checkout>/src-tauri/Cargo.toml --release --locked`: exit0. It uses the existing compiler/dependency cache, MSVC/SDK and an explicitly configured external LLVM, as documented in OS-TEMPLATE.md. First Cargo attempt failed because the clean checkout had no ignored LLVM tool directory; setting LIBCLANG_PATH to the existing external installation fixed that build prerequisite. The application source was unchanged.

`bun artifacts/audit-plugin-helper-integration.mjs` verifies all64proposed code/dependency/scenario/historical topic-document files against both the staged Git blobs and isolated checkout (normalizing Git checkout line endings), and preserves their exact exported bytes. Fresh generated Buffer bytes match the previously accepted artifact. Both built workers match native acceptance: plugin4b6a566bd674472269eb5e2f95d2103c8e2f2561cd11aa52ca82fddcc7592197/template4e2fff42f3f6f09211b401d951e3bf691f0ec250fcaf041541583a0f95cf4419. Eight result hashes and successful Windows Cargo logs/state are retained in `artifacts/plugin-helper-integration-proof/manifest.json`, `accepted` and `sources`.

The backend/runtime/provider/helper files in this checkout match the exact native source snapshots and explicit three-file harness variant accepted by native427cf713. That native acceptance proves41checks/14terminated plugin workers/68HTTP, WebSocket/ninegRPC/reflection, six post-completion guest/native child-send callbacks, normal onHide and two workspace buffers/store/all653original cookie files restored. See PLUGIN-DOM-RENDER-OWNER.md. The prior native executable contains the broader working UI, including pending response-history/CSS changes; no new native executable or native run of this isolated checkout is claimed. This checkout proves fresh dependency/generator/frontend/worker/headless/compiler/native-check activation of the committed integration.

## Remaining scope

Committing this assembly closes the missing clean-checkout integration/dependency gate. It does not close the entire helper/app facade or migration. Nested response-tag and stream lifetimes, ordered guest onHide before terminal revocation, full DOM/live collections/property handlers/event cancellation, generic HTML/private React/ReactDOM/axios, complete native clipboard-format restoration, save platform/runtime gates and all remaining provider/migration parity stay open. Linux/macOS runtime acceptance is not inferred from Windows Cargo check. The deferred shared-input and UX/UI/CSS phase still follows full migration, per POST-MIGRATION-UX.md.

No live processes remain from this checkpoint. This interface cannot invoke `/compact`; STATUS.md records the current commit/evidence/remaining gates and handoff before the next feature.
