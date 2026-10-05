<script>
  import { onMount, onDestroy } from "svelte";
  import Button from "./Button.svelte";
  import Icon from "../Icon.svelte";
  /** @type {{title?:string,heading?:import('svelte').Snippet,children:import('svelte').Snippet,onclose:()=>void,inert?:boolean,element?:HTMLDialogElement}} */
  let {
    title = "",
    heading,
    children,
    onclose,
    inert = false,
    element = $bindable(),
  } = $props();
  const id = $props.id();
  let previous = /** @type {HTMLElement|null} */ (null);
  onMount(() => {
    previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    element?.showModal();
  });
  onDestroy(() => {
    element?.close();
    if (previous?.isConnected && !previous.closest("[inert]")) previous.focus();
  });
</script>

<dialog
  bind:this={element}
  class="modal ui-modal"
  {inert}
  aria-labelledby={id}
  oncancel={(event) => {
    event.preventDefault();
    onclose();
  }}
>
  <div class="modal-heading">
    <h2 {id}>
      {#if heading}{@render heading()}{:else}{title}{/if}
    </h2>
    <Button
      variant="ghost"
      class="icon-button"
      aria-label="Close dialog"
      onclick={onclose}><Icon name="close" /></Button
    >
  </div>
  <div class="modal-content">{@render children()}</div>
</dialog>
