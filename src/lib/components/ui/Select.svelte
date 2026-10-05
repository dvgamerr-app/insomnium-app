<script>
  import Icon from "../Icon.svelte";
  /** @type {Omit<import('svelte/elements').HTMLSelectAttributes, 'value'> & {value?:string|number, children?:import('svelte').Snippet, invalid?:boolean, svgArrow?:boolean}} */
  let {
    value = $bindable(""),
    children,
    invalid = false,
    svgArrow = false,
    class: className = "",
    onchange,
    ...rest
  } = $props();
</script>

{#snippet control()}
  <select
    {...rest}
    {value}
    aria-invalid={invalid || rest["aria-invalid"] || undefined}
    class={`ui-select ${className}`}
    onchange={(event) => {
      value =
        typeof value === "number"
          ? Number(event.currentTarget.value)
          : event.currentTarget.value;
      onchange?.(event);
    }}>{@render children?.()}</select
  >
{/snippet}

{#if svgArrow}
  <span class={`select-with-icon ${className}-wrapper`}>
    {@render control()}
    <span class="select-arrow"><Icon name="down" size={14} /></span>
  </span>
{:else}
  {@render control()}
{/if}

<style>
  .select-with-icon {
    position: relative;
    display: flex;
    flex-shrink: 0;
  }
  .select-with-icon :global(select.ui-select) {
    width: 100%;
    height: 100%;
    appearance: none;
    text-align: center;
    text-align-last: center;
    padding: 0 24px 0 8px;
    line-height: normal;
  }
  .select-with-icon :global(select::picker-icon) {
    display: none;
  }
  .select-arrow {
    position: absolute;
    right: 7px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    pointer-events: none;
    color: var(--muted);
  }
  .method-select-wrapper {
    width: 96px;
  }
  .protocol-select-wrapper {
    width: 78px;
  }
</style>
