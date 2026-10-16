<script>
  import Button from "./ui/Button.svelte";
  import Input from "./ui/Input.svelte";
  /** @type {{text:string}} */
  let {text} = $props();
  const pageSize = 200;
  let rows = $state.raw(/** @type {string[][]} */ ([]));
  let warnings = $state(/** @type {string[]} */ ([]));
  let warningCount = $state(0), loading = $state(true), error = $state("");
  let page = $state(1);
  const pages = $derived(Math.max(1,Math.ceil(rows.length/pageSize)));
  const visible = $derived(rows.slice((page-1)*pageSize,page*pageSize));
  $effect(() => {
    const source = text;
    rows = [];warnings = [];warningCount = 0;page = 1;loading = true;error = "";
    const worker = new Worker(new URL("../csv-preview.worker.js",import.meta.url),{type:"module"});
    let active = true;
    const timer = setTimeout(() => {
      if (!active) return;
      active = false;worker.terminate();loading = false;
      error = "CSV parsing timed out. Source and Raw remain available.";
    },10000);
    worker.onmessage = (event) => {
      if (!active) return;
      active = false;clearTimeout(timer);worker.terminate();loading = false;
      if (event.data.error) error = event.data.error;
      else {rows = event.data.rows;warnings = event.data.warnings;warningCount = event.data.warningCount;}
    };
    worker.onerror = () => {
      if (!active) return;
      active = false;clearTimeout(timer);worker.terminate();loading = false;
      error = "CSV preview could not be prepared. Source and Raw remain available.";
    };
    worker.postMessage(source);
    return () => {active = false;clearTimeout(timer);worker.terminate();};
  });
  /** @param {number} value */
  function selectPage(value) {
    if (Number.isFinite(value)) page = Math.max(1,Math.min(pages,Math.trunc(value)));
  }
</script>

<div class="csv-preview">
  {#if loading}<p class="hint padded" role="status">Preparing CSV preview…</p>
  {:else if error}<p class="inline-error padded" role="alert">{error}</p>
  {:else}
    {#if warningCount}<details class="padded"><summary>CSV parsing reported {warningCount} issues</summary>
      {#each warnings as warning}<p>{warning}</p>{/each}
      {#if warningCount>warnings.length}<p>Showing the first {warnings.length} issues.</p>{/if}
    </details>{/if}
    {#if rows.length}
      <div class="csv-navigation" aria-label="CSV pages">
        <Button variant="ghost" disabled={page<=1} onclick={() => selectPage(page-1)}>Previous rows</Button>
        <label>Page <Input type="number" aria-label="CSV page" min={1} max={pages} value={page} onchange={(event) => selectPage(event.currentTarget.valueAsNumber)} /></label>
        <span>of {pages}</span>
        <Button variant="ghost" disabled={page>=pages} onclick={() => selectPage(page+1)}>Next rows</Button>
        <span class="hint">Rows {(page-1)*pageSize+1}–{Math.min(page*pageSize,rows.length)} of {rows.length}</span>
      </div>
      <div class="csv-scroll"><table aria-label="CSV response"><tbody>
        {#each visible as row,index}<tr aria-label={`CSV row ${(page-1)*pageSize+index+1}`}>
          {#each row as cell}<td>{cell}</td>{/each}
        </tr>{/each}
      </tbody></table></div>
    {:else}<p class="hint padded">No CSV rows.</p>{/if}
  {/if}
</div>

<style>
  .csv-preview {display:flex;flex:1;flex-direction:column;min-height:0;}
  .csv-navigation {display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 16px;}
  label {display:flex;align-items:center;gap:6px;}
  label :global(input) {width:80px;}
  .csv-scroll {overflow:auto;flex:1;min-height:0;}
  table {border-collapse:collapse;min-width:100%;}
  td {border:1px solid var(--line);padding:6px 10px;white-space:pre-wrap;vertical-align:top;}
  tr:nth-child(even) {background:var(--raised);}
</style>
