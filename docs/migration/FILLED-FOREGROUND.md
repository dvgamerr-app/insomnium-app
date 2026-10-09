# Filled surface foreground tokens

2026-10-09. Base `b89c530`; headless policy checkpoint `80d542f`.
Native regression and independent final audit pass; exact checkpoint is recorded in STATUS.

Primary/Send buttons, branding and response badges previously declared white
independently. They now consume three semantic foreground tokens, each defaulting
to white in the theme owner:

| Token          | Consumers                                          |
| -------------- | -------------------------------------------------- |
| `--on-accent`  | Primary, Send, `.brand-mark`, `.large-brand`       |
| `--on-danger`  | Danger hover/focus fallback, failed response badge |
| `--on-success` | Successful response badge                          |

Danger focus still accepts an explicit `--focus-danger-text` override. Its root
default declaration is removed; the consuming rule uses
`var(--focus-danger-text, var(--on-danger))`. This lets a component-local
`--on-danger` override reach focus as well as hover. Reading the raw custom
property now yields empty when no explicit focus override is supplied; the
rendered default remains white. Existing explicit focus overrides retain priority.

The CSS substitution/inheritance model was checked against the
[W3C custom properties specification](https://www.w3.org/TR/css-variables-1/).
No framework or subsystem was initialized.

## Saved verification

All browser scenarios use the fixed headless `launchUiBrowser` helper. Native
scenarios hide their owned host window before attaching to WebView2 and report
`native-hidden`.

```powershell
bun tests/ui/design-system.js
bun run check
bun tests/ui/build-recovery-copy-probe.js
bun tests/ui/nocturne-theme.js
$env:INSOMNIUM_UI_BUILD_STATE='artifacts/native-recovery-copy-probe/build-state.json'
bun tests/ui/nocturne-native-theme.js
bun scripts/ui-inventory.js
```

The reusable saved helper measures white defaults, a global override, a different
component-local override, exact restoration, and unchanged background/width/
height/font size/line height/radius. Actions never activate the measured buttons.
It restores inline values and priorities even on assertion failure.

- Design-system: 66 measured cases across dark/light and 1440/900/760, including
  Primary/Send default/hover/focus, Danger hover/focus and three brand/badge cases.
  The whole retained scenario also passes. Raw rows independently audited.
- Actual frontend: terminal exit 0; 26 rows in ten groups, with Send at all six
  profiles, visible brand at four, and actual owned local HTTP 200/500 badges in
  both themes. Retained 19 surfaces and persistence pass.
- Native build: terminal exit 0, started `1791558859119`, finished
  `1791559237464`, fixture hash `16674050803735312688`. The six CSS SHA256 hashes
  in `filled-foreground-source-freeze.json` match the sources.
- Actual native: terminal exit 0, 52 rows in twelve groups on the frozen release,
  with 12 workflow captures, 10 dialog cases, six Field profiles and twelve form
  profiles. Git HEAD is unchanged; native exit 0, native-hidden, visible:false.
  Owned Bun48476/native53720 are gone; artifact-scoped WebView processes are zero.
  Dark/light native cookie images were inspected.
- Independent final audit: design66/frontend26/native52 raw rows, source hashes,
  build identity and native terminal/visibility evidence all match. Record:
  artifacts/playwright/filled-foreground-final-audit.json.
- Compiler after saved scenario correction: zero errors and zero warnings.

Artifacts are under `artifacts/playwright`: `design-system`, `nocturne-theme`,
`filled-foreground-build.json`, `filled-foreground-source-freeze.json` and the
timestamped native directory recorded in STATUS. Artifacts are ignored by Git.

## Failures and corrections

The first baseline helper waited for a nonexistent focused element; optional
focus capture was corrected before collecting product evidence. The valid old
CSS baseline then fails the Primary global token assertion: actual white versus
expected `rgb(1, 2, 3)`. Its result/progress/image are preserved under
`filled-foreground-baseline`, and the image was inspected.

Compiler found three possibly missing lookup results in restoration; explicit
guards fixed them without changing accepted runtime behavior.

The first actual frontend run failed waiting for a visible brand at 760px. Its
image and existing CSS confirm the intentional `max-width: 800px` hiding rule.
The original evidence is preserved under `filled-foreground-narrow-failure`.
Both saved actual-app scenarios now assert the breakpoint visibility explicitly,
measure the brand only at 1440/900, and still measure Send at every width.
Actual expected totals are 26 frontend and 52 native, replacing the earlier
incorrect 28/54 plan. No product breakpoint was changed.

## Scope and remaining gates

Brand-mark is currently a raster image: computed CSS foreground acceptance does
not prove recoloring its pixels. The fixture large-brand case measures text.
The tests prove token propagation/restoration and measured geometry, not WCAG
contrast for arbitrary user colors, other-platform native behavior, native OS
file dialogs or completion of the full migration/design-system debt checklist.

Current inventory is source SHA256
`60e841406d173995f8247dc7109c78fba7770945eae3d858cf4a375d8c2e8fbe`:
57 production Svelte files, 664 shared markup sites, 14 feature scoped style
files, 120 tokens and 1722 CSS declarations. There are no multiple-owner token
files or duplicate local CSS imports. The inventory's unresolved
`--focus-danger-text` reference is an intentional optional override with an
explicit fallback; it remains visible in the report. Three unused-var candidates
and dynamic method color references remain for broader debt review.

All original PLAN/PARITY migration requirements and broader UI/CSS adoption,
ownership, interaction, provider/platform and distribution gates remain required.
