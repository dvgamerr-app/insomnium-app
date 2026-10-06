<script>
  import Button from "./Button.svelte";
  /** @type {{value:string|boolean,options:Array<{value:string|boolean,label:string,disabled?:boolean}>,label:string,variant?:'default'|'compact',onchange?:(value:string|boolean)=>void}} */
  let {
    value = $bindable(),
    options,
    label,
    variant = "default",
    onchange,
  } = $props();
</script>

<div
  class={`ui-segmented ui-segmented-${variant}`}
  role="group"
  aria-label={label}
>
  {#each options as option}
    <Button
      variant="plain"
      aria-pressed={value === option.value}
      disabled={option.disabled}
      class={`ui-segmented-choice ${value === option.value ? "active chosen" : ""}`}
      onclick={() => {
        value = option.value;
        onchange?.(value);
      }}>{option.label}</Button
    >
  {/each}
</div>
