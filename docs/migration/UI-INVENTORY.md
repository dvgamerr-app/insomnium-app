# Current shared UI source inventory

2026-10-08, production source at `56aed5e`. This replaces the old markup counts
for planning; the historical design-system debt report remains an accurate record
of its earlier snapshot.

Run `bun scripts/ui-inventory.js` from the repository root. The command uses
[Svelte compiler parse/parseCss](https://svelte.dev/docs/svelte/svelte-compiler)
with the modern AST and writes `artifacts/ui-inventory/report.json`. It parses
all 57 production Svelte files, follows imported shared component aliases, and
counts template sites rather than imports, comments, script strings or rendered
instances. Repeated/conditional markup counts once per source site. Internal
primitive compositions are recorded separately from feature consumers.

Accepted source SHA256:
`734cfee8ef5a4359797efd8288db718604ed070da4a337de9eae84eb3bbe3a3f`.
Svelte compiler `5.57.1`; 661 shared markup sites outside the UI directory.
The JSON includes each consumer path/line and primitive owner so subsequent
changes can be evaluated against actual adoption.

| Shared component | Feature sites | Consumer files |
| ---------------- | ------------: | -------------: |
| Button           |           204 |             29 |
| Checkbox         |            27 |             11 |
| DialogShell      |             7 |              7 |
| Dropdown         |             2 |              1 |
| EditableName     |             1 |              1 |
| EmptyState       |            16 |              9 |
| Feedback         |            42 |             22 |
| Field            |           132 |             24 |
| FilePicker       |            12 |              8 |
| FormPanel        |             7 |              4 |
| Input            |            82 |             24 |
| Modal            |             2 |              2 |
| SegmentedControl |             2 |              2 |
| Select           |            49 |             19 |
| SplitPane        |            10 |              7 |
| TabButton        |            10 |              6 |
| TabList          |             9 |              6 |
| TabPanel         |             9 |              6 |
| Textarea         |            19 |             14 |
| Toolbar          |            16 |              9 |
| UnifiedDiff      |             2 |              2 |
| WindowControls   |             1 |              1 |

## Native markup and exceptions

The sole feature-level native control is `CodeEditor.svelte:393`, its textarea
backing/fallback for CodeMirror. It binds the native element used by the editor,
preserves value/readOnly/input behavior and renders when editor initialization
fails. Replacing it with an ordinary field is not adoption work. UI primitives
own the other native input/select/textarea/button/dialog sites, including
EditableName's display button and DialogShell's native dialog.

The sole `svelte:element` site is Feedback, with the documented p/pre/div/li
presentation contract. This is a presentation exception, not a missing input
primitive. Counts do not prove label associations, keyboard behavior, domain
validation, imported-state compatibility or runtime focus behavior.

## Styles and tokens

The application has one local CSS entry import in `+page.svelte`:
`$lib/styles.css`, forwarding to `styles/index.css`. Its graph has 30 files
including the two entry wrappers; all local imports resolve, with no cycles or
duplicate file imports. The JSON records ordered traversal. Foundation and
theme load before base/native/common, feature/shell styles, form/navigation/
control/select/dialog/file/toolbar/empty/variant/focus/diff owners.

`editor-engine.js` separately imports five CodeMirror vendor stylesheets: core,
dialog, foldgutter, show-hint and lint. These belong to the editor integration;
they are not a second application control stylesheet. Package CSS and runtime
CodeMirror injected rules are outside this local stylesheet graph.

The stylesheet ASTs contain 1,714 declarations and 118 custom properties. No
custom property has definitions in more than one source file; dark/light values
within theme.css are expected. The report retains each declaration and value.
No unresolved complete literal var() name was found. ResponsePane assembles
`--method-` names dynamically with a syntax-keyword fallback; the audit records
this separately instead of reporting a partial name as undefined.

Twelve properties directly reference another token. They express shared metric
or semantic ownership: button-gap, control padding, dialog gutter, Field gaps,
focus surfaces/border and Select arrow offset. Their consumers are recorded;
these links are not automatically obsolete compatibility aliases.

Three properties have no literal production var() reference: `--code`,
`--font-size-14`, `--space-30`. These are cleanup candidates. This audit cannot
prove absence of external overrides or dynamically constructed uses; it does
not delete public scale/theme properties or claim runtime CSS reachability.

Fourteen feature components still own scoped styles:

| Feature files                                        | Intended responsibility to retain; review remaining declarations individually |
| ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| ClientCertificates, SettingsPanel, OAuthEditor       | Certificate/settings/auth layout and feedback placement                       |
| CodeEditor                                           | Editor integration, fallback and completion presentation                      |
| GitPanel, GitPushReview, GitRecovery, GitRemotePanel | Source Control lists, review/remote/recovery layout and domain states         |
| GrpcPane, ProtoManager                               | Protocol/schema/message layout                                                |
| KeyValueEditor                                       | Editable row/list layout                                                      |
| ResponsePane                                         | Response viewers and metadata layout                                          |
| RunnerPane, RunnerSidebar                            | Runner result/tree layout                                                     |

This table identifies the review owners. It does not certify every scoped rule
as necessary or nonduplicated. Primitive surfaces/fonts/states and repeated
shared metrics still require property-level review against their shared owners.

## Acceptance and remaining work

`bun scripts/ui-inventory.js` completes successfully against all production
markup and stylesheet ASTs. `bun run check` returns zero errors/warnings;
formatting and diff checks pass. No application source/style/backend changes,
new dependency, browser launch or native rebuild is involved in this inventory.
Historical runtime evidence remains in STATUS/UI-TESTING and is not rerun or
presented as new runtime acceptance here.

Next review should use the report's declaration/consumer list to resolve
remaining feature literals and scoped primitive overrides, then verify changed
owners through the existing saved headless/native scenarios. Public contracts,
validation/keyboard interactions, OS dialogs, themes/fallback widths, workflows
and whole-debt completion remain open. All original PLAN/PARITY migration gates
remain required; this inventory does not narrow or complete the migration goal.
