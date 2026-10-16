<script>
  /** @type {{html:string,title?:string}} */
  let { html, title = "HTML response preview" } = $props();
  let source = $state("");
  let frame = $state(/** @type {HTMLIFrameElement|undefined} */ (undefined));
  export function focus() { frame?.focus(); }
  $effect(() => {
    // The first policy cannot be relaxed by later response markup. Combined
    // with the empty iframe sandbox and parent's blob-only frame-src, this
    // blocks scripts, resource requests, forms, popups and remote navigation.
    const policy = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; media-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    const content = '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + policy + '">' + html;
    const url = URL.createObjectURL(new Blob([content], {type:"text/html;charset=utf-8"}));
    source = url;
    return () => URL.revokeObjectURL(url);
  });
</script>

<div class="html-preview">
  <p class="hint padded">Scripts and network requests are disabled in this preview.</p>
  {#if source}<iframe bind:this={frame} src={source} sandbox="" referrerpolicy="no-referrer" {title}></iframe>{/if}
</div>

<style>
  .html-preview { display:flex; flex:1; flex-direction:column; min-height:0; }
  iframe { flex:1; width:100%; min-height:240px; border:0; background:white; }
</style>
