<script>
  import { onDestroy } from "svelte";
  import { readBodyUpload } from "../uploads.js";
  import { createWorkspaceWorkScope } from "../workspace.svelte.js";
  /** @type {{request:Record<string,any>,onchange:(patch:Record<string,any>)=>void}} */
  let { request, onchange } = $props();
  let error = $state("");
  const workScope = createWorkspaceWorkScope();
  const generations = new Map();
  let alive = true;
  onDestroy(() => {
    alive = false;
    workScope.dispose();
  });
  /** @param {string} id @param {Record<string,any>} patch */
  function patchSegment(id, patch) {
    onchange({
      curlSegments: request.body.curlSegments.map(
        /** @param {any} row */ (row) =>
          row.id === id ? { ...row, ...patch } : row,
      ),
    });
  }
  /** @param {Event} event @param {Record<string,any>} segment */
  async function selectFile(event, segment) {
    const file = /** @type {HTMLInputElement} */ (event.currentTarget)
      .files?.[0];
    if (!file) return;
    const requestId = request._id;
    const generation = (generations.get(segment.id) || 0) + 1;
    generations.set(segment.id, generation);
    const work = workScope.begin();
    const current = () =>
      alive &&
      work.current() &&
      request._id === requestId &&
      generations.get(segment.id) === generation &&
      request.body?.curlSegments?.some(
        /** @param {any} row */ (row) => row === segment,
      );
    try {
      const upload = await readBodyUpload(file, segment);
      if (current()) {
        patchSegment(segment.id, upload);
        error = "";
      }
    } catch (e) {
      if (current()) error = String(e);
    } finally {
      work.finish();
    }
  }
</script>

<p class="hint">
  {request.body.curlQuery
    ? "These parts are appended to the URL query; no request body is sent."
    : "Body parts are sent in the order shown."} Select each referenced file before
  sending.
</p>
{#if error}<p class="inline-error">{error}</p>{/if}
{#each request.body.curlSegments as segment, index (segment.id)}
  {#if segment.type === "file"}
    <label class="binary-picker"
      >Part {index + 1}: {segment.fileName}<input
        aria-label={"File for body part " + (index + 1)}
        type="file"
        onchange={(event) => selectFile(event, segment)}
      /></label
    >
  {:else}
    <label
      >Part {index + 1}<textarea
        aria-label={"Text for body part " + (index + 1)}
        value={segment.value}
        oninput={(event) =>
          patchSegment(segment.id, { value: event.currentTarget.value })}
      ></textarea></label
    >
  {/if}
{/each}
