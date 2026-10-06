<script>
  import DialogShell from "./DialogShell.svelte";
  /** @type {{title?:string,heading?:import('svelte').Snippet,children:import('svelte').Snippet,onclose:()=>void,inert?:boolean,element?:HTMLDialogElement}} */
  let {
    title = "",
    heading,
    children,
    onclose,
    inert = false,
    element = $bindable(),
  } = $props();
</script>

<DialogShell {title} {heading} {inert} bind:element onrequestclose={onclose}>
  {@render children()}
</DialogShell>
