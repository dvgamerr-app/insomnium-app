<script>
  import Select from "./Select.svelte";
  /** @type {Omit<import('svelte/elements').HTMLSelectAttributes,'value'> & {value?:string, options:{value:string,label:string,disabled?:boolean}[],placeholder?:string,invalid?:boolean}} */
  let { value = $bindable(""), options, placeholder, ...rest } = $props();
</script>

<Select {...rest} bind:value>
  {#if placeholder}<option value="" disabled>{placeholder}</option>{/if}
  {#each options as option (option.value)}<option
      value={option.value}
      disabled={option.disabled}>{option.label}</option
    >{/each}
</Select>
