# API Design attachment layout

Expanded example/reference lists previously consumed the flex column and
compressed source/preview. The saved production-component fixture reproduces
source/preview13.6875px at760px width with three example and two reference files
open; its heading lies outside the preview pane. At1440px, preview only uses138px
rather than filling its pane.

API filename/validation/loading/example/reference management now sits in a named
scroll region capped at min(240px,25vh). It keeps its bounded height rather than
shrinking to zero. Top navigation and generation toolbars keep their height.
Source/preview minimum split height is240px horizontally and366px stacked;
preview fills its pane. The page scrolls vertically when the host is shorter
than the combined controls and panes. Existing shared controls/layout remain.

The API-only sizing selectors explicitly outrank Svelte's scoped SplitPane
defaults. This avoids load-order dependence without changing the shared
component or using !important.

## Saved headless evidence

bun tests/ui/api-design-layout.js passes24 unique profiles:
dark/light ×1440/900/760 widths ×960/600 heights ×3example+2reference or32+32files.
Both lists are expanded. Each verifies source/preview>=160px, the heading within
its preview, no horizontal overflow and keyboard focus revealing each list's
last input through all scroll ancestors. Controlled shell geometry mounts the
production ApiDesign/CodeEditor/SplitPane and shared controls; it is not native
acceptance. api-design-layout-headless-audit.json independently checks all24
recorded profiles and the exact source/scenario freeze.

Final compiler reports0errors0warnings; selected Prettier check passes.
Inventory has57Svelte/672shared sites/117tokens/1728CSS declarations,10 additional
feature layout declarations, with no new raw control or style owner. Source hash:
0be51b9a0d96b290397b3210395bf0ff93c8cd309cafcca716bb43937c78fadf.
Static inventory does not prove full runtime/accessibility/CSS acceptance.

## Native acceptance

Current production-profile build12655 is terminal0: start1791569928400 /
finish1791570301584 / hash17938830593973612643. Current source/scenario hashes
independently match api-design-layout-source-freeze.json, base0723d8b; successful
build saved in api-design-layout-build.json.

Saved native3.2.1 scenario23669/artifact1791570317843 is terminal0/passed,
18:25:18.236Z–18:28:27.901Z. Owned native56252 exits0, native-hidden/visible:false.
It accepts12 dark/light ×width ×height geometry/focus profiles with both lists
expanded, retaining3byte request groups/4loading controls/management/refs/
worker literals/persistence/send checks.

Per-run layout-independent-audit.json checks all12 geometry profiles, headless24,
exact source/scenario/build and method/target/base64/SHA-256, original source/ref
text and asset/reference Git round trips. cleanup-audit.json records owned
native/profile processes absent and fixture65053 listener gone. Final
artifacts/playwright/api-design-layout-final-audit.json repeats source identity
and combines those acceptance/cleanup gates. No live feature process handle.
Actual native dark1440×960, light900×960, dark760×960 and dark/light760×600
screenshots were inspected; source/preview headings remain usable. Shorter hosts
use page scrolling to reach setup and generation controls.

## Retained failures

Baseline result/metrics/PNG are retained in
artifacts/playwright/api-design-layout-baseline-760 and-baseline-1440; both images
were inspected. Initial960px layout passed, but cascade review showed shared
scoped defaults could override feature minima. That first build15457 is terminal0
(start1791569389374/finish1791569764257/hash17938830593973612643); its source/build
snapshots are archived as api-design-layout-*-first.json and do not prove final
source.

After strengthening selectors, the600px regression found setup flex-shrinking to
zero. api-design-layout-short-height-failure preserves result/metrics/PNG, which
was inspected. Keeping setup's bounded flex size fixes that failure. Sources
changed only after the earlier build terminated.

## Saved commands

```powershell
bun tests/ui/api-design-layout.js
bun run check
bun tests/ui/build-recovery-copy-probe.js
```

After the exact native build handle terminates successfully:

```powershell
$env:INSOMNIUM_UI_BUILD_STATE = 'artifacts/native-recovery-copy-probe/build-state.json'
$env:INSOMNIUM_OPENAPI_VERSION = '3.2.1'
bun tests/ui/openapi-external-example.js
```

Run app/scenarios unchanged through build and native acceptance. Browser fixtures
use launchUiBrowser with fixed headless:true. Native helpers hide their owned host
before CDP and report native-hidden/visible:false.

## Documentation consulted and remaining scope

- [CSS overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow)
- [CSS min-height](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/min-height)
- [Svelte scoped style specificity](https://svelte.dev/docs/svelte/scoped-styles)

Full migration/OpenAPI/UX/CSS/provider/platform requirements remain active.
This bounded attachment fix is not full UI, accessibility, small-host or platform
acceptance. /compact is unavailable in this interface; STATUS carries the handoff.
