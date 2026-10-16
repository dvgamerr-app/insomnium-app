<script>
  import { base } from "$app/paths";
  import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
  import Button from "./ui/Button.svelte";
  import Input from "./ui/Input.svelte";
  import Field from "./ui/Field.svelte";
  import Select from "./ui/Select.svelte";
  /** @type {{bytes:string|undefined}} */
  let {bytes} = $props();
  let document = $state.raw(/** @type {import('pdfjs-dist').PDFDocumentProxy|null} */ (null));
  let canvas = $state(/** @type {HTMLCanvasElement|undefined} */ (undefined));
  let pageNumber = $state(1), scale = $state(1), loading = $state(true), rendering = $state(false);
  let error = $state(""), renderError = $state(""), pageText = $state("");
  let passwordRequired = $state(false), password = $state(""), passwordError = $state("");
  let unlock = $state(/** @type {((value:string)=>void)|null} */ (null));
  $effect(() => {
    const source = bytes;
    let active = true;
    let task = /** @type {import('pdfjs-dist').PDFDocumentLoadingTask|undefined} */ (undefined);
    let timer = /** @type {ReturnType<typeof setTimeout>|undefined} */ (undefined);
    document = null;pageNumber = 1;loading = true;error = "";pageText = "";
    passwordRequired = false;password = "";passwordError = "";unlock = null;
    const armDeadline = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!active) return;
        active = false;loading = false;passwordRequired = false;unlock = null;
        error = "PDF loading timed out. Source, Raw and Save remain available.";
        void task?.destroy().catch(() => {});
      },15000);
    };
    armDeadline();
    void (async () => {
      if (typeof source !== "string" || !source) throw new Error("Original PDF bytes are unavailable.");
      const data = Uint8Array.from(atob(source),(char) => char.charCodeAt(0));
      const pdf = await import("pdfjs-dist");
      if (!active) return;
      pdf.GlobalWorkerOptions.workerSrc = workerUrl;
      const assets = new URL(`${base}/pdf-assets/`,window.location.href).href;
      // Only local saved bytes and bundled decoder/font assets are provided.
      // No viewer action, annotation-link or scripting layer is installed.
      task = pdf.getDocument({data,cMapUrl:assets+"cmaps/",standardFontDataUrl:assets+"standard_fonts/",
        wasmUrl:assets+"wasm/",iccUrl:assets+"iccs/",enableXfa:false,
        disableRange:true,disableStream:true,disableAutoFetch:true});
      task.onPassword = (/** @type {(value:string)=>void} */ updatePassword,/** @type {number} */ reason) => {
        if (!active) return;
        clearTimeout(timer);loading = false;passwordRequired = true;
        passwordError = reason === pdf.PasswordResponses.INCORRECT_PASSWORD ? "Incorrect PDF password." : "";
        unlock = (value) => {
          if (!active) return;
          passwordRequired = false;loading = true;armDeadline();updatePassword(value);
        };
      };
      const loaded = await task.promise;
      if (!active) {void task.destroy().catch(() => {});return;}
      clearTimeout(timer);document = loaded;loading = false;unlock = null;password = "";
    })().catch((cause) => {
      if (active) {clearTimeout(timer);loading = false;error = String(cause);void task?.destroy().catch(() => {});}
    });
    return () => {active = false;clearTimeout(timer);unlock = null;password = "";void task?.destroy().catch(() => {});};
  });
  $effect(() => {
    const pdf = document, target = canvas, selected = pageNumber, zoom = scale;
    if (!pdf || !target) return;
    let active = true;
    let task = /** @type {import('pdfjs-dist').RenderTask|undefined} */ (undefined);
    rendering = true;renderError = "";pageText = "";
    void (async () => {
      const page = await pdf.getPage(selected);
      if (!active) return;
      const viewport = page.getViewport({scale:zoom});
      if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height) || viewport.width<=0 || viewport.height<=0)
        throw new Error("Invalid PDF page dimensions.");
      // Preserve displayed zoom while bounding the backing canvas allocation.
      const density = Math.min(window.devicePixelRatio || 1,2,
        Math.sqrt(16000000/(viewport.width*viewport.height)),16384/viewport.width,16384/viewport.height);
      target.width = Math.max(1,Math.floor(viewport.width*density));
      target.height = Math.max(1,Math.floor(viewport.height*density));
      target.style.width = `${viewport.width}px`;target.style.height = `${viewport.height}px`;
      task = page.render({canvas:target,viewport,transform:density===1?undefined:[density,0,0,density,0,0]});
      await task.promise;
      const text = await page.getTextContent();
      if (active) {pageText = text.items.map((item) => "str" in item ? item.str+(item.hasEOL?"\n":" ") : "").join("");rendering = false;}
    })().catch((cause) => {if (active) {renderError = String(cause);rendering = false;}});
    return () => {active = false;task?.cancel();};
  });
  /** @param {number} value */
  function selectPage(value) {
    if (document && Number.isFinite(value)) pageNumber = Math.max(1,Math.min(document.numPages,Math.trunc(value)));
  }
</script>

<div class="pdf-preview">
  {#if loading}<p class="hint padded" role="status">Loading PDF…</p>{/if}
  {#if error}<p class="inline-error padded" role="alert">{error}</p>{/if}
  {#if passwordRequired}<form class="padded" onsubmit={(event) => {event.preventDefault();unlock?.(password);password="";}}>
    <Field label="PDF password"><Input type="password" bind:value={password} autocomplete="off" /></Field>
    {#if passwordError}<p role="alert">{passwordError}</p>{/if}
    <Button type="submit">Unlock PDF</Button>
  </form>{/if}
  {#if document}
    <div class="pdf-navigation">
      <Button variant="ghost" disabled={pageNumber<=1} onclick={() => selectPage(pageNumber-1)}>Previous page</Button>
      <Input type="number" aria-label="PDF page" min={1} max={document.numPages} value={pageNumber} onchange={(event) => selectPage(event.currentTarget.valueAsNumber)} />
      <span>of {document.numPages}</span>
      <Button variant="ghost" disabled={pageNumber>=document.numPages} onclick={() => selectPage(pageNumber+1)}>Next page</Button>
      <Select aria-label="PDF zoom" value={scale} onchange={(event) => {scale=Number(event.currentTarget.value);}}>
        {#each [0.5,0.75,1,1.25,1.5,2,3,4] as zoom}<option value={zoom}>{zoom*100}%</option>{/each}
      </Select>
      {#if rendering}<span class="hint" role="status">Rendering PDF page…</span>{/if}
    </div>
    {#if renderError}<p class="inline-error padded" role="alert">{renderError}</p>{/if}
    <div class="pdf-page"><canvas bind:this={canvas} aria-label={`PDF page ${pageNumber}`}></canvas></div>
    <details class="padded"><summary>PDF page text</summary><pre>{pageText}</pre></details>
  {/if}
</div>

<style>
  .pdf-preview {display:flex;flex:1;flex-direction:column;min-height:0;}
  .pdf-navigation {display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 16px;}
  .pdf-navigation :global(input) {width:80px;}
  .pdf-navigation :global(select) {width:100px;}
  .pdf-page {flex:1;min-height:0;overflow:auto;padding:16px;background:var(--raised);}
  canvas {display:block;background:white;}
  pre {white-space:pre-wrap;}
</style>
