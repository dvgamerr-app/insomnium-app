# Event API parallel agent handoff — 2026-10-12

Isolated worktree: `E:\.dvgamerr-app\insomnium-agent-event-api`. Baseline HEAD: `25fa97a62e55fae680ff01809fc30119396703b8`, plus copied root WIP recorded in `artifacts/agent-baseline.json`. No baseline dirt staged or committed. Root agent owns integration and topic commit; this handoff is not a full Event/migration acceptance.

Implemented bounded constructor and native packet compatibility for UIEvent, MouseEvent, PointerEvent, KeyboardEvent and CustomEvent. Native retained callbacks now receive the actual subclass prototype while retaining the existing shared private Event identity/state. Readonly subclass getters use private branded state. Constructor inheritance, dictionary defaults, DOM string/integer/finite float conversions, keyboard constants, common modifier queries, UI/custom initializers and their receiver guards are present. Chromium differential evidence requires MouseEvent fractional coordinates to floor and button -1 to normalize to0; PointerEvent preserves fractional coordinates.

`event.view` uses a frozen isolated Window facade only when the host event's view is the owned node's actual Window. Constructor views admit null or the same facade and refuse fabricated views. Window/self/document references remain realm-local; DOM methods retain existing module-init/current-owner guards. Foreign host views expose no raw Window. Related targets are forwarded only when present in the owned graph. Native pointer coordinates retain their fractional values, and native page coordinates are forwarded separately.

Changed files to integrate (compare baseline hashes before copying; ordinary `git diff HEAD` includes preexisting WIP):

- `src/lib/plugin-guest-dom.js`
- `src/lib/plugin-dom-bridge.js`
- `src/lib/plugin-runtime.js` — narrow constructor/window/self bootstrap whitelist only
- `tests/ui/fixtures/plugin-guest-dom.js` — distinct subclass fixture/tag21 plus module-load differential
- `tests/ui/helpers/plugin-dom-event-subclass-cases.js` — new independent shared browser/guest exercise
- `tests/ui/plugin-dom-event-subclasses.js` — new saved production scenario
- `tests/ui/plugin-dom-event-surface.js` — retained tag now compared with the same actual host event's browser brand rather than assuming base Event
- This handoff document

Final compiler `bun run check`49343/f16e46 exits0, zero errors/warnings. Final `bun run build`5d1934 exits0. Actual emitted worker: `build/_app/immutable/workers/plugin.worker-bG5AK-mc.js`, SHA256 `54e274cc42a92c729bedc73d9f9a0f39587b7f3234e5248dfc1eaf4d02e21ca8`.

Final saved headless checks: subclass1d7a8a/4, existing surfacefb122d/15, shared identityd4a7b4/4, nesting31a827/12, listener lifecycle92806/fa9cf9/21: **56 groups passed**, all owned workers terminated. Subclass scenario compares all five constructor surfaces both at module load and live callback in CommonJS/ES module; malformed input/foreign view checks and actual trusted pointer/Shift+K keyboard observations match the browser. Native view ownership and scalar fields compare against the exact original host events. Every scenario uses shared headless launcher, no browser-use/ad-hoc steps. Result/source hashes: `artifacts/event-api-evidence.json`. Frozen integration source and original baseline hash manifest: `artifacts/event-api-handoff/`.

Initial constructor mismatch source/oracle/log are preserved under `artifacts/event-api-negative/`. A later saved coordinate probe caught PointerEvent fractional conversion and is recorded in `artifacts/event-api-coordinate-probe.log`; it used the previous emitted worker, not the final candidate. Compiler typing errors and an audit/formatter boundary mistake were corrected before final clean check/build. No product assertions were weakened. Existing surface brand became a dynamic native oracle because native click has PointerEvent brand.

Worktree dependencies were isolated after shared node_modules junction caused Vite config-temp resolution failures. The junction was verified then renamed to `node_modules-shared`; `bun install --frozen-lockfile --ignore-scripts` installed independent dependencies without lock changes. `--configLoader runner` alone did not resolve SvelteKit's second config load. No dependency target was modified deliberately; no live process handles remain.

References consulted: https://dom.spec.whatwg.org/#interface-customevent, https://w3c.github.io/uievents/#interface-mouseevent, https://w3c.github.io/pointerevents/#pointerevent-interface, https://vite.dev/config/.

Remaining gates: full Window API, Focus/Input/other event subclasses, extended modifier state, legacy mouse/keyboard initializers, pointer coalesced/predicted samples and advanced pointer fields, full synthetic dispatch/property handlers and multiple asynchronous frames, original held-provider owner regression, fresh native-hidden Tauri acceptance and whole migration parity. These are not removed from scope. No fresh native acceptance is claimed here. Commit this verified bounded API topic only after root integration checks; update STATUS with integrated commit/evidence/gates first. This interface cannot invoke `/compact`; this document is the explicit handoff, not a claim of compaction.

## Review follow-up accepted by strengthened existing oracle

Root review found three real differences, now corrected. UI/custom legacy initializers update private base state directly and never invoke an instance/prototype replacement of initEvent. Each constructor dictionary member is read once, in browser inherited dictionary order; coordinate conversion no longer re-reads input getters or numeric coercions. Native/chromium dictionary extension keys are read once and admitted values kept privately; full unsupported surfaces remain gated below. UI ignores constructor which input; mouse which is derived before its button -1 normalization, while keyboard uses its keyCode alias. Saved helper compares exact getter traces for all five constructors, replaced-method side effects, UI/custom resulting state, and mouse/pointer/keyboard alias matrices. Selected AltGraph/CapsLock/Fn/NumLock/ScrollLock/Symbol flags now use private constructor state and actual native getModifierState scalar snapshots.

Exact original failed source, emitted worker2f35657b, raw browser/guest observations and saved failure log remain under artifacts/event-api-dictionary-negative; earlier event-api-negative is untouched. Final 54e274cc candidate passes the strengthened subclass scenario and all previously listed regressions, 56 groups total. The integration manifest is refreshed against the same original root baseline hashes. Unsupported full sourceCapabilities facade, advanced pointer sample/angle public surfaces and remaining Event/Window/native/migration gates remain open. All handles terminal; root owns verified topic commit, STATUS update and compact handoff.
