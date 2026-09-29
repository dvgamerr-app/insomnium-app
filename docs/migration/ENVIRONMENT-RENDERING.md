# Recursive environment and value rendering

Checkpoint: 2026-09-28. Implemented in preview and shared session API; **actual Send still uses model.render**. Full migration is incomplete.

## Sources and commands

Read archived packages/insomnia/src/common/render.ts and templating/index.ts before implementation. The former is authoritative for merge/pass/disabled/path behavior.

Official references consulted:
- https://mozilla.github.io/nunjucks/api.html#asynchronous-support
- https://mozilla.github.io/nunjucks/templating.html#variables
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/fromEntries
- https://github.com/develohpanda/json-order (README and installed source)
- https://bun.sh/docs/pm/cli/add and https://bun.sh/docs/pm/cli/remove

Tried documented bun add --ignore-scripts --exact json-order@1.1.3 first. Inline probes proved that incomplete property maps drop unlisted keys and own hasOwnProperty breaks ordering. Removed using bun remove --ignore-scripts json-order. No final dependency remains. Reference jirasync-hub-app has no environmentPropertyOrder/json-order implementation. A bounded own-key ordering adapter is necessary to preserve imported data without these defects.

All programs launched hidden through node_repl execFile(shell:false, windowsHide:true); Bun performs scripting and file writes. No saved test scripts, Node/npm/yarn/Python invocation, native change, installer, commit or publication.

## Implemented contract

- template-environment.js collects base environment, selected ancestry within the workspace (base not duplicated), then outer-to-inner request_group environments. A request without a resolvable workspace returns null for caller fallback. Cross-workspace selected environments are ignored, matching current model behavior. Preview uses authoritative resource layers; supplied context is the fallback only when no workspace resolves.
- Saved property maps use $ root and ~| separators, including array indexes. Specified existing own keys come first; duplicate/stale entries ignored and all omitted own keys appended. Numeric keys still obey JavaScript object enumeration. __proto__, constructor and hasOwnProperty stay ordinary own data properties. No map path is assigned through object prototypes.
- Stable ordering processes literal values before strings containing {{ or {%. Bare same-name interpolation is rendered against the parent value before overriding it. Nested plain objects merge; arrays/null/scalars replace. Regex metacharacters in key names are escaped. Parent same-name syntax retains the original narrow regex: underscore-alias self-overrides are not newly supported.
- After merge, three sequential self-render passes use KEEP_ON_ERROR. Unchanged top-level values skip further passes; objects are cloned each pass. Unresolved or cyclic template strings may remain, matching the original bounded algorithm. This is not a topological resolver.
- template-object.js clones values before rendering. Arrays/objects render sequentially, keys do not render, disabled objects and blacklisted paths skip, first-level underscore wrapper names are omitted from diagnostic paths. Date/RegExp/Error/boxed primitives are preserved by cloning. Complete variable/tag/comment delimiter pairs invoke the isolated renderer; otherwise text stays literal. A result containing a tag receives one additional render, retaining the first result if that second render fails under KEEP.
- Field errors have type=render, path, reason and optional multi-digit line/column. No source/context values are logged. Template language error messages can still contain user-authored text; do not export diagnostic text as telemetry.
- Abort, TimeoutError and TemplateLimitError propagate through KEEP. Bounds: 128 environment layers, depth64, 10000 visited values and20Mi aggregate string/key characters per input/result. Actual cyclic object data is rejected. Worker/VM bounds remain. Input layers are checked together before merging; final context checked after each pass.
- template-session.js snapshots optional environmentLayers. Preparation is lazy and happens once even for simultaneous field calls. Environment request-tag callbacks receive the current partial context directly, avoiding recursive preparation deadlock. The session exposes render(text, field?), renderValue(value, {path?, keepOnError?, blacklist?}) and getContext() (returns a clone), plus signal/dispose(). Caller without environmentLayers retains its supplied context behavior.
- All environment and field workers share session interaction/cancellation and aggregate1000-render limit. Each string/reference chain allows64 renders/depth12;16 workers active. Limit failure aborts the session. Preview now has a30-second whole-session cap; send remains10 minutes. Per-worker5-second active/heartbeat and VM2-second entry budgets remain. Application-side native callback interruptions preserve their error kind instead of passing them back as an ordinary tag error.

## Verification

49 inline assertions passed:
-22 isolated-VM/helper cases: property order/nested arrays/special own keys, same-name and deep inheritance, replacement and snapshot isolation, references/comments/unresolved/cyclic strings, resource layer ordering, disabled/blacklist/wrapper handling, error location, variable-to-tag extra pass/KEEP, incomplete delimiters, abort/timeout/cycle/layer bounds.
-7 compiled-worker session cases: preview with inherited environment and request reference during preparation, concurrent once-only prompt and snapshot, cloned context, recursive fields, disposal, cancellation during prepare, and field error cancelling the session. All workers disposed (live=0).
-8 boundary cases: depth/size/node caps, unchanged error called once, multi-digit location, abort after callback, special-key merge without prototype mutation, primitive/date cloning.
-2 compiled-client/session cases: native TimeoutError propagation and accelerated30-second preview total deadline, with cleanup.
-10 existing shared-session regression assertions including multi-level prompt waiting6.1seconds, snapshots, Cancel, preview, cycles and external cancellation.

Svelte check:0 errors/0 warnings. Vite production build passed. Exact executed validation uses Bun directly on node_modules/svelte-check/bin/svelte-check with --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings, and node_modules/vite/bin/vite.js build. Prettier applied to changed JS. Initial compilation found2 missing JSDoc index-type errors; fixed. Two inline file-construction attempts failed parsing before mutation (template-literal escaping); corrected. One assertion fixture omitted base64's kind argument; corrected to encode,normal,hi and reran all22 cases. No product change needed for that fixture.

## Next steps / acceptance gates

1. Build full request/cookieJar rendering around session.renderValue; preserve description KEEP, body rendering opt-out, GraphQL #} workaround, disabled-row removal and URL normalization. Register cancellation before preparation begins.
2. Implement dependent-response send callback, trigger modes, chain/cycle/cache ownership and network-wait timing. Current send-purpose response modes always/no-history/when-expired explicitly reject; never/default reads saved history.
3. Wire actual HTTP/auth/OAuth/GraphQL/gRPC/stream Send call sites to the shared rendered snapshot and prepared environment. Remove repeated synchronous model.render calls only after protocol payload/auth parity is verified. Editor completion still uses model.environmentFor for names.
4. Preserve prompt session cache lifecycle and disposal. Verify recursive field errors in the UI, actual WebView worker/WASM CSP, native tags and dialog interaction. Inline compiled-worker adapters are not real WebView acceptance.
5. Source is newer than BUILD.json; rebuild packaging only after the integration milestones. Do not claim current installer contains these changes or mark environment/full migration VERIFIED yet.
