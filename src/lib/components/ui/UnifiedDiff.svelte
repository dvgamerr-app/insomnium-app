<script>
  import CodeEditor from "../CodeEditor.svelte";
  import { unifiedDiff } from "../../unified-diff.js";
  /** @type {{identity:string,before:string|null,after:string|null,mode?:string}} */
  let { identity, before, after, mode = "yaml" } = $props();
  const diff = $derived(unifiedDiff(before, after));
</script>

<section class="ui-unified-diff" aria-label="Unified changes">
  <header class="diff-heading">
    <span>{mode === "yaml" ? "YAML" : "JSON"}</span>
    <span class="diff-count diff-count-deleted">−{diff.removed} removed</span>
    <span class="diff-count diff-count-added">+{diff.added} added</span>
    <span class="spacer"></span>
    <small>Before → After</small>
  </header>
  {#if diff.replacement}<p class="diff-note">
      Large change: showing the full replacement.
    </p>{/if}
  <CodeEditor
    {identity}
    {mode}
    value={diff.value}
    lineDecorations={diff.decorations}
    readOnly
    label="Unified change diff"
  />
  {#if diff.beforeNoNewline || diff.afterNoNewline}
    <p class="diff-note">
      No newline at end of {diff.beforeNoNewline && diff.afterNoNewline
        ? "either version"
        : diff.beforeNoNewline
          ? "before version"
          : "after version"}.
    </p>
  {/if}
</section>
