# Nocturne controls

The application imports `src/lib/styles.css` once; it forwards to `styles/index.css`, which orders foundation/theme, layout and UI styles. Do not additionally import `controls.css` in the application. It remains a standalone entry for UI-only consumers. UI styles own control surfaces, borders, focus, disabled states and dialog presentation; feature styles own layout.

`src/lib/styles/tokens/foundation.css` owns shared spacing, typography, sizes and shape; `button-config.css` is a compatibility entry importing that foundation. Button corners use `--button-radius: 0px`. Percentage widths and fill-parent heights remain layout rules. Input and dialog radii are separate from button shape.

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

Dropdown pickers use `appearance: base-select` under `@supports`, with themed options, checkmarks, keyboard selection and top-layer placement. Older engines fall back to native select behavior. There is no custom listbox keyboard implementation to maintain. Actual adoption covers request composition, authentication editors, preferences, imports, environments/resources, Git, runner, protocols and response filtering: 253 additional input/select/button sites and 15 textarea sites now use the shared controls.

The saved workspace scenario checks picker rendering in both themes, keyboard selection, Escape ordering, numeric persistence and modal focus restoration. The broader Nocturne scenario covers request/auth/body/import/editor/protocol controls.

References consulted: [MDN customizable select](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select), [MDN Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using), [Svelte bindable props](https://svelte.dev/docs/svelte/$bindable).
