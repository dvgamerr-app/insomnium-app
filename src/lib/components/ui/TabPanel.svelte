<script>
  /** @type {{id:string,labelledBy:string,children?:import('svelte').Snippet}} */
  let { id, labelledBy, children } = $props();
</script>

<div {id} role="tabpanel" aria-labelledby={labelledBy} class="ui-tab-panel">
  {@render children?.()}
</div>
