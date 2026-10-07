# Nocturne controls

The application imports `src/lib/styles.css` once; it forwards to `styles/index.css`, which orders foundation/theme, layout and UI styles. Use that entry for application and component fixtures. The redundant `ui/controls.css` and unused `button-config.css` entry files have been removed. UI styles own control surfaces, borders, focus, disabled states and dialog presentation; feature styles own layout.

`src/lib/styles/tokens/foundation.css` owns shared spacing, typography, sizes and shape. Button corners use `--button-radius: 0px`. Percentage widths and fill-parent heights remain layout rules. Input and dialog radii are separate from button shape.

CodeEditor's text and lint tooltips use `--font-size-12` and `--font-mono`.
GraphQL schema information and lint popup shadows use `--editor-popup-shadow`;
their corner radius uses `--radius-group`. These shared values preserve the existing
12px text, 1.6 editor line height, 4px radius and popup shadow defaults. CodeMirror
engine DOM, completion placement and syntax behavior remain the editor adapter's
responsibility.

Single-choice `Select` and `Dropdown` use the same Lucide SVG chevron by default, including collection, environment, body type/JSON, response history, authentication and redirects. `styles/select.css` owns the arrow; `styles/variants.css` owns layout variants and full-surface hover. Method/protocol values have equal left/right padding and centered horizontal/vertical alignment. Consumers must not replace the arrow or paint hover on a text child. Native `multiple`/`size` listboxes have no dropdown arrow. `svgArrow={false}` is an explicit opt-out, not an application default.

`SplitPane` accepts `collapsedPane="first"` or `"second"` (default) to choose which side disappears when collapsed. The workspace uses the first pane for Collections on the left and the second for the main view.

| Component      | Use                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button         | `variant="primary\|secondary\|danger\|ghost"`, `busy`, native button attributes/events; defaults to `type="button"`                                           |
| EditableName   | Text until focus, then input; `value`, `onchange`; Enter/blur saves, Escape cancels                                                                           |
| WindowControls | Windows desktop minimize/maximize/restore/close; `onerror`; uses existing native close guard                                                                  |
| Input          | Text/password/number/search/URL fields, native validation, bindable `value` and native `element`, `invalid`                                                   |
| Select         | Dropdowns with option/optgroup snippets; SVG arrow by default; `variant="method\|protocol"` centers the value; native listbox `size` semantics                |
| Dropdown       | Data-driven single-choice control: `options=[{value,label,disabled?}]`, optional placeholder, bindable string `value`                                         |
| Textarea       | Multiline fields, native attributes/events, bindable `value`, `invalid`                                                                                       |
| Field          | Label, required marker, description and error; control id must match Field id                                                                                 |
| Modal          | Native dialog focus containment, Escape/cancel, focus restoration; `title` or heading snippet, children, `onclose`                                            |
| SplitPane      | Resizable first/second snippets; see `docs/migration/NOCTURNE-WORKSPACE.md`                                                                                   |
| UnifiedDiff    | One read-only YAML/JSON change view; `identity`, nullable `before`/`after`, `mode`; old/new line numbers, minus/plus markers and themed red/green backgrounds |
| Checkbox       | Bindable `checked`, `indeterminate`, native `element`; native change/currentTarget and Field disabled/invalid/description context |
| FilePicker     | Native file input with `compact\|inline\|dropzone` presentation; native attributes including `multiple`, `accept`, `webkitdirectory`; resets after awaited change by default |
| TabList / TabButton / TabPanel | Shared tab/panel IDs, selected tab focus and keyboard navigation; `aria-orientation="vertical"` enables Up/Down, horizontal uses Left/Right; Home/End skip disabled tabs |
| SegmentedControl | Bindable string/boolean `value`, `options`, `label`, `onchange`; native pressed buttons in a labelled group |
| Toolbar        | Shared toolbar placement and spacing; feature owns actions and accessible naming |
| EmptyState     | Shared empty/loading presentation with feature-owned content and actions |
| FormPanel      | Shared form layout container; does not create a form or change submission/validation policy |
| Feedback       | Shared error/hint presentation; `as="p\|pre\|div"`, `tone="error\|hint"`; supply alert/live semantics when the workflow needs them |
| DialogShell    | Shared native dialog heading, containment, focus restoration and Escape policy; `dismissible={false}` locks dismissal; feature owns queue, abort and recovery decisions |

`Field` supplies its ID, description/error association, invalid, required, disabled/loading and supported read-only state through reactive context. Input, Textarea, Select, Checkbox and FilePicker inherit native `required`; a control's explicit `required={false}` opts out. Native HTML validity and form submission apply, including checkbox/file value requirements; feature handlers still own domain validation. FilePicker inherits the Field error's `aria-invalid`. Keep `resetAfterChange={false}` for file inputs that must retain their selected file for form submission; its default reset is for repeated action-style imports. Git author Preferences uses Field as the owner of ID, required and busy state.

`UnifiedDiff` uses the existing `CodeEditor`, which exposes optional `lineDecorations` (`line`, `className`, `gutterText`, `gutterLabel`). Decorations are reset when content changes; ordinary editors retain their normal line numbers/folding. The diff preserves source text, highlights YAML directly, and uses CodeMirror's viewport rendering. It does not deserialize or rewrite resources. Diff styles belong to `styles/diff.css`.

```svelte
<script>
  import Dropdown from "$lib/components/ui/Dropdown.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  let name = $state("");
  let mode = $state("dark");
  let saving = $state(false);
</script>

<Field
  id="profile-name"
  label="Name"
  description="Used on your commits."
  required
>
  <Input
    id="profile-name"
    aria-describedby="profile-name-description"
    required
    bind:value={name}
  />
</Field>
<Dropdown
  aria-label="Theme"
  bind:value={mode}
  options={[
    { value: "dark", label: "Nocturne Dark" },
    { value: "light", label: "Nocturne Light" },
  ]}
/>
<Button variant="primary" type="submit" busy={saving}>Save</Button>
```

Native DOM events retain `event.currentTarget` (for example `valueAsNumber`, form validation and file-free text input). Number/range bindings produce a number, or undefined for an empty field. Checkbox/radio/file inputs retain their native specialized bindings; CodeMirror owns its editor textarea. Specialized tabs/tree rows with class directives retain their existing interaction implementation.

`Field` provides control IDs, description/error associations, disabled/busy and read-only context. An explicit control prop overrides context. `required` displays the marker; set the native control's `required` attribute when browser validation is required. Use one control per Field. `FilePicker` keeps its native element available while an async change handler runs, then clears the value so selecting the same file fires another change. Set `resetAfterChange={false}` only when the feature intentionally retains the native file selection. File size/type limits belong to the feature.

`TabButton` owns its active class, selected presentation and roving tabindex from `aria-selected` (boolean or the native `"true"`/`"false"` strings). Consumers provide selection state and their selection callback; do not repeat `class="active"` in feature code. The selected tab publishes its ID to TabList/TabPanel for the accessible relationship. TabList owns horizontal/vertical arrow, Home/End navigation and skips disabled tabs.

For wrapped checkbox choices, use `Field layout="inline" align="start"`; shared Field styles align the checkbox with the first text line and prevent it from shrinking. `align="center"` is the default. Feature code may set row gap/margins, while checkbox dimensions and alignment belong to the shared owner. `Feedback tone="hint" density="compact"` keeps protocol hints at the shared 1.5 line height; normal density retains 1.7. Use `as="li"` for feedback that is an actual list item. Feature styles supply placement, not hint font/color.

Application adoption inventory (2026-10-07, static markup outside `ui`, excluding generated outputs): Button 173 sites/24 files; Input 70/22; Select 44/17; Textarea 16/13; Checkbox 22/9; FilePicker 12/8; Field 109/20; TabList and TabPanel 9/6 each; SegmentedControl 2/2; Toolbar and EmptyState 16/9 each; FormPanel 7/4; Feedback 29/21; direct DialogShell 2/2 and Modal 2/2. The only raw input/select/textarea/button markup outside `ui` is CodeEditor's textarea, required by CodeMirror. Native summaries, links and domain data tables retain their native semantics. These counts show adoption, not full workflow acceptance.

`native.css` owns browser resets and default native interaction, `controls.css` primitive surfaces/states, `select.css` picker/chevron, `variants.css` placement variants, `forms.css` Field/FormPanel composition, `navigation.css` tabs/segmented presentation, and `dialog.css` dialog presentation. Component-owned layout remains in SplitPane/EditableName/WindowControls. Feature scoped styles still require the remaining ownership audit in `docs/migration/UI-DESIGN-SYSTEM-DEBT.md`; this inventory does not close that debt.

Dropdown pickers use `appearance: base-select` under `@supports`, with themed options, checkmarks, keyboard selection and top-layer placement. Older engines fall back to native select behavior. There is no custom listbox keyboard implementation to maintain. Actual adoption covers request composition, authentication editors, preferences, imports, environments/resources, Git, runner, protocols and response filtering: 253 additional input/select/button sites and 15 textarea sites now use the shared controls.

The saved workspace scenario checks picker rendering in both themes, keyboard selection, Escape ordering, numeric persistence and modal focus restoration. The broader Nocturne scenario covers request/auth/body/import/editor/protocol controls.

References consulted: [MDN customizable select](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select), [MDN Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using), [Svelte bindable props](https://svelte.dev/docs/svelte/$bindable).
