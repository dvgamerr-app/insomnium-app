<script>
  import Button from "./ui/Button.svelte";
  import { renderRequestPreview } from "../template-preview.js";
  import { clearPromptValues } from "../template-prompt.js";
  import CodeEditor from "./CodeEditor.svelte";
  /** @type {{history:Record<string,any>[], environmentId?:string|null, resources:Record<string,any>[], workspaceId?:string, identity:string, text:string, context:Record<string,any>, settings:Record<string,any>, mode:string}} */
  let {
    history,
    environmentId,
    resources,
    workspaceId,
    identity,
    text,
    context,
    settings,
    mode,
  } = $props();
  let open = $state(false);
  let promptRevision = $state(0);
  let result = $state("");
  let error = $state("");
  let busy = $state(false);
  $effect(() => {
    identity;
    promptRevision;
    if (!open) return;
    const controller = new AbortController();
    let active = true;
    result = "";
    error = "";
    busy = true;
    renderRequestPreview(text, $state.snapshot(context), {
      signal: controller.signal,
      resources: $state.snapshot(resources),
      history: $state.snapshot(history),
      environmentId,
      requestId: identity,
      workspaceId,
    }).then(
      (value) => {
        if (active) {
          result = value;
          busy = false;
        }
      },
      (reason) => {
        if (active) {
          error = String(reason);
          busy = false;
        }
      },
    );
    return () => {
      active = false;
      controller.abort();
    };
  });
</script>

<details bind:open class="template-preview">
  <summary>Template preview</summary>
  {#if open}
    <p class="hint">
      Preview supports Nunjucks expressions and Base64, Timestamp, UUID, Hash
      and JSONPath tags. Sending currently supports variable substitutions only;
      File tags are available in the desktop app (up to 20 MiB). Cookie tags use
      the current collection’s cookie store. Request references support name,
      folder, header, query parameter and URL, plus cookies on desktop. OAuth
      references read the latest saved token for this request without refreshing
      it. Response references support saved URL, header and raw body for the
      selected environment, with JSONPath/XPath body filters. Preview never
      resends dependent requests. Prompt tags preview cached/default values;
      masked prompts stay hidden. OS tags read system information in the desktop
      app. Interactive prompting on Send is still pending.
    </p>
    <Button
      variant="ghost"
      class="secondary"
      onclick={() => {
        clearPromptValues();
        promptRevision++;
      }}>Clear prompt values</Button
    >
    {#if busy}<p class="hint" role="status">Rendering…</p>
    {:else if error}<p class="inline-error" role="alert">{error}</p>
    {:else}<CodeEditor
        identity={identity + ":template-preview"}
        value={result}
        label="Rendered template preview"
        readOnly
        {settings}
        {mode}
      />{/if}
  {/if}
</details>

<style>
  .template-preview {
    padding: 6px 12px;
  }
  summary {
    cursor: pointer;
    font-size: 12px;
  }
</style>
