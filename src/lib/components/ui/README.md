# Nocturne controls

Import `controls.css` once after the application layout stylesheet (already done in `+page.svelte`). This stylesheet owns control surfaces, radii, borders, focus, selected/disabled states and modal presentation. Keep feature-specific layout in its feature stylesheet.

| Component | Use |
| --- | --- |
| Button | `variant="primary\|secondary\|danger\|ghost"`, `busy`, native button attributes/events; defaults to `type="button"` |
| Input | Text/password/number/search/URL fields, native validation, bindable `value` and native `element`, `invalid` |
| Select | Dropdowns with option/optgroup snippets; also preserves native listbox `size` semantics |
| Dropdown | Data-driven single-choice control: `options=[{value,label,disabled?}]`, optional placeholder, bindable string `value` |
| Textarea | Multiline fields, native attributes/events, bindable `value`, `invalid` |
| Field | Label, required marker, description and error; control id must match Field id |
| Modal | Native dialog focus containment, Escape/cancel, focus restoration; `title` or heading snippet, children, `onclose` |
| SplitPane | Resizable first/second snippets; see `docs/migration/NOCTURNE-WORKSPACE.md` |

```svelte
<script>
  import Dropdown from '$lib/components/ui/Dropdown.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  let name = $state('');
  let mode = $state('dark');
  let saving = $state(false);
</script>

<Field id="profile-name" label="Name" description="Used on your commits." required>
  <Input id="profile-name" aria-describedby="profile-name-description" required bind:value={name}/>
</Field>
<Dropdown aria-label="Theme" bind:value={mode}
  options={[{value:'dark',label:'Nocturne Dark'},{value:'light',label:'Nocturne Light'}]}/>
<Button variant="primary" type="submit" busy={saving}>Save</Button>
```

Native DOM events retain `event.currentTarget` (for example `valueAsNumber`, form validation and file-free text input). Number/range bindings produce a number, or undefined for an empty field. Checkbox/radio/file inputs retain their native specialized bindings; CodeMirror owns its editor textarea. Specialized tabs/tree rows with class directives retain their existing interaction implementation.

Dropdown pickers use `appearance: base-select` under `@supports`, with themed options, checkmarks, keyboard selection and top-layer placement. Older engines fall back to native select behavior. There is no custom listbox keyboard implementation to maintain. Actual adoption covers request composition, authentication editors, preferences, imports, environments/resources, Git, runner, protocols and response filtering: 253 additional input/select/button sites and 15 textarea sites now use the shared controls.

The saved workspace scenario checks picker rendering in both themes, keyboard selection, Escape ordering, numeric persistence and modal focus restoration. The broader Nocturne scenario covers request/auth/body/import/editor/protocol controls.

References consulted: [MDN customizable select](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select), [MDN Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using), [Svelte bindable props](https://svelte.dev/docs/svelte/$bindable).
