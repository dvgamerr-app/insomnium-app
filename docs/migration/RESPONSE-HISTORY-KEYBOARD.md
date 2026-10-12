# Response history keyboard and shared styling

2026-10-12: the existing response history popup left Escape unhandled when focus
was inside an item and rendered an interactive button inside each listbox option.
The saved component scenario reproduces the original Escape timeout. Exact old
source, fixture, result and screenshot are frozen at
`artifacts/response-history-negative/manifest.json`.

The popup uses shared Button for its trigger and actual focusable options, with
one option in the tab order and unique popup IDs. Arrow keys open on the current
response and move focus, Home/End move to the first/last entry, Escape closes and
returns focus, Enter/Space select exactly once, and leaving the popup or clicking
outside closes it. Moving focus never selects a response. History colors and
layout remain; feature CSS now has one owner at
`src/lib/styles/features/response-history.css` and uses existing shared tokens.

Contract reference: [W3C listbox keyboard and roles](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)
and [popup selection keyboard guidance](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/).
No new subsystem or generator was required. Svelte JavaScript and Bun only.

Saved commands: `bun tests/ui/response-history.js` (six theme/width profiles),
`bun tests/ui/response-history-app.js` (six actual production-app profiles),
`bun tests/ui/nocturne-theme.js`, `bun run check`, `bun run build`.
All browser launches use launchUiBrowser with headless:true. Actual app checks
select exact503/200 responses, exact rendered bodies, Space/Escape/focus, unchanged
full resources/history across each action, and reload. Theme persistence/setup
settles before each read-only action boundary; no workspace metadata is excluded.

An invalid object-header fixture failed because production response headers are
string tuples; subsequent textarea locator and rendered gutter assertions were
corrected to inspect actual CodeMirror content. These are scenario defects, not
product bugs. Original invalid-fixture result/PNG are retained with an explicit
provenance limitation: its scenario snapshot was captured after correction and
is not asserted to be the original consumed source. The original Escape product
negative has exact source/hash proof. No result is accepted based on those failures.

This is headless acceptance of the current history popup and shared styling.
Fresh native acceptance and broader history/platform/accessibility/whole UI
consolidation/full migration remain open. Existing baseline collection CSS and
other unrelated work are not included in this topic. `/compact` is unavailable;
commit/evidence/live handles and remaining gates are recorded in STATUS.
