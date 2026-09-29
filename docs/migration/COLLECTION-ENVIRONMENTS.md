# Per-collection environment selection

Updated: 2026-09-29. Retention and cross-collection finite HTTP dependency dispatch implemented. See DEPENDENT-RESPONSES.md for routing and validation.

## Contract

- Store activeEnvironmentId on workspace_meta resources, matching the archived WorkspaceMeta concept. Preserve other metadata fields.
- Existing explicit metadata wins on load, including an empty/null Base selection. Old schema-1 global activeEnvironmentId seeds metadata only when that collection has no explicit selection. Loading clones metadata and the resource array before normalization, preserving caller input.
- A selection must reference an environment belonging to that collection. Missing, foreign and wrong-type references fall back to Base. Invalid saved metadata is normalized on load.
- Dropdown updates both active UI selection and metadata. Collection/request-tab switching remembers the old collection and restores the target selection. Invalid collection targets are ignored.
- Removing an environment clears all metadata that references it. Imported metadata and duplicated collection selections remap activeEnvironmentId through the shared reference key list. Export already includes resources.
- No layout changes. No new dependencies or saved test scripts.

## Sources consulted before implementation

- https://svelte.dev/docs/svelte/$state — deep reactive state and snapshots.
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn — distinguish absent metadata field from explicit Base selection.
- Archived packages/insomnia/src/models/workspace-meta.ts and network/network.ts: collection-owned environment selection. Archive remains read-only.

## Validation

20 inline Bun assertions passed: old-global migration/input preservation, explicit Base precedence, foreign/wrong-type fallback, metadata preservation, duplicate/import ID mapping, compiled Svelte collection and request-tab actions, Base retention, active/inactive environment deletion, invalid collection target, serialization/reload.

Commands launched directly with shell:false/windowsHide:true through node_repl:

- bun node_modules/prettier/bin/prettier.cjs --write src/lib/model.js src/lib/resources.js src/lib/workspace.svelte.js src/routes/+page.svelte
- bun node_modules/svelte-check/bin/svelte-check --tsconfig ./jsconfig.json --config ./svelte.config.js --fail-on-warnings — 0 errors, 0 warnings.
- bun node_modules/vite/bin/vite.js build — passed.
- git diff --check — passed (existing CRLF notices only).

No real user state loaded/saved, no native changes or new installer. Real WebView acceptance remains pending.

## Next steps

Scoped dependency routing, shared OAuth resources and target source guards are now implemented and checked (see DEPENDENT-RESPONSES.md). Continue streaming completion semantics, remaining renderer callers, native transport parity and real WebView/provider acceptance. Full migration remains incomplete.
