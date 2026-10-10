<script>
  /** @type {{id:string,labelledBy:string,children?:import('svelte').Snippet,tabindex?:number}} */
  let { id, labelledBy, children, tabindex = 0 } = $props();
</script>

<div
  {id}
  {tabindex}
  role="tabpanel"
  aria-labelledby={labelledBy}
  class="ui-tab-panel"
>
  {@render children?.()}
</div>
