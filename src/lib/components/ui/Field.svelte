<script>
  /** @type {{id:string,label:string,description?:string,error?:string,required?:boolean,children:import('svelte').Snippet}} */
  let {
    id,
    label,
    description = "",
    error = "",
    required = false,
    children,
  } = $props();
</script>

<div class="ui-field">
  <label for={id}
    >{label}{#if required}<span aria-hidden="true"> *</span>{/if}</label
  >
  {@render children()}
  {#if description}<small id={`${id}-description`} class="hint"
      >{description}</small
    >{/if}
  {#if error}<small id={`${id}-error`} class="inline-error" role="alert"
      >{error}</small
    >{/if}
</div>
