<script>
  import Field from "./ui/Field.svelte";
  import Select from "./ui/Select.svelte";
  import Toolbar from "./ui/Toolbar.svelte";
  import { exampleChoiceError } from "../openapi-example-choices.js";
  /** @type {{groups:ReturnType<typeof import('../openapi-example-choices.js').operationExampleGroups>,selections:Record<string,import('../openapi-example-choices.js').ExampleChoice>,disabled?:boolean,onchange:(key:string,choice:import('../openapi-example-choices.js').ExampleChoice|null)=>void}} */
  let { groups, selections, disabled = false, onchange } = $props();
</script>

{#each groups as group (group.key)}
  {@const choice = selections?.[group.key]}
  {@const error = exampleChoiceError(group, choice)}
  <Toolbar variant="design" class="design-toolbar">
    {#if group.kind === "body"}
      {@const mime = choice?.mediaType || group.defaultMediaType || ""}
      {@const options = group.options.filter(
        (option) => option.mediaType === mime,
      )}
      <Field label="Request body media type" {disabled}>
        <Select
          value={mime}
          onchange={(event) =>
            onchange(group.key, {
              mediaType: event.currentTarget.value,
              name: null,
            })}
        >
          {#if !group.mediaTypes?.includes(mime)}<option value={mime} disabled
              >Unavailable saved media type</option
            >{/if}
          {#each group.mediaTypes || [] as type}<option value={type}
              >{type}</option
            >{/each}
        </Select>
      </Field>
      <Field label={group.label} {disabled} {error}>
        <Select
          value={choice?.name != null ? JSON.stringify(choice.name) : ""}
          onchange={(event) =>
            onchange(group.key, {
              mediaType: mime,
              name: event.currentTarget.value
                ? JSON.parse(event.currentTarget.value)
                : null,
            })}
        >
          <option value="">Default (first example)</option>
          {#if choice?.name != null && !options.some((option) => option.name === choice.name)}<option
              value={JSON.stringify(choice.name)}
              disabled>Unavailable saved example</option
            >{/if}
          {#each options as option}<option value={JSON.stringify(option.name)}
              >{option.name || "(empty name)"}{option.summary
                ? ` · ${option.summary}`
                : ""}</option
            >{/each}
        </Select>
      </Field>
    {:else}
      {@const selected = choice
        ? JSON.stringify([choice.level, choice.name])
        : ""}
      <Field label={group.label} {disabled} {error}>
        <Select
          value={selected}
          onchange={(event) => {
            const value = event.currentTarget.value;
            const [level, name] = value ? JSON.parse(value) : [];
            onchange(group.key, value ? { level, name } : null);
          }}
        >
          <option value="">Default (first example)</option>
          {#if error}<option value={selected} disabled
              >Unavailable saved example</option
            >{/if}
          {#each group.options as option}<option
              value={JSON.stringify([option.level, option.name])}
              >{option.level === "media" ? "Content · " : ""}{option.name ||
                "(empty name)"}{option.summary
                ? ` · ${option.summary}`
                : ""}</option
            >{/each}
        </Select>
      </Field>
    {/if}
  </Toolbar>
{/each}
