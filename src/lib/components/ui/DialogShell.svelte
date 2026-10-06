<script>
  import { onMount, onDestroy } from "svelte";
  import Button from "./Button.svelte";
  import Icon from "../Icon.svelte";
  /** @type {import('svelte/elements').HTMLDialogAttributes & {title?:string,heading?:import('svelte').Snippet,children?:import('svelte').Snippet,onrequestclose?:()=>void,onopen?:(element:HTMLDialogElement)=>void,onopenerror?:(error:unknown)=>void,dismissible?:boolean,closeLabel?:string,wrapContent?:boolean,size?:'normal'|'compact'|'recovery',element?:HTMLDialogElement}} */
  let {
    title = "",
    heading,
    children,
    onrequestclose,
    onopen,
    onopenerror,
    dismissible = true,
    closeLabel = "Close dialog",
    wrapContent = true,
    size = "normal",
    element = $bindable(),
    class: className = "",
    ...rest
  } = $props();
  const headingId = $props.id();
  let previous = /** @type {HTMLElement|null} */ (null);
  onMount(() => {
    previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (element) {
      try {
        element.showModal();
        onopen?.(element);
      } catch (error) {
        if (onopenerror) onopenerror(error);
        else throw error;
      }
    }
  });
  onDestroy(() => {
    element?.close();
    if (previous?.isConnected && !previous.closest("[inert]")) previous.focus();
  });
</script>

<dialog
  {...rest}
  bind:this={element}
  class={`modal ui-modal ui-modal-${size} ${className}`}
  aria-labelledby={rest["aria-labelledby"] ?? headingId}
  oncancel={(event) => {
    event.preventDefault();
    if (dismissible) onrequestclose?.();
  }}
>
  <div class="modal-heading">
    <h2 id={headingId}>
      {#if heading}{@render heading()}{:else}{title}{/if}
    </h2>
    {#if dismissible && onrequestclose}
      <Button
        variant="ghost"
        class="icon-button"
        aria-label={closeLabel}
        onclick={onrequestclose}><Icon name="close" /></Button
      >
    {/if}
  </div>
  {#if wrapContent}<div class="modal-content">
      {@render children?.()}
    </div>{:else}{@render children?.()}{/if}
</dialog>
