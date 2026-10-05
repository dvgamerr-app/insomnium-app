<script>
  import Button from "./ui/Button.svelte";
  import { onDestroy } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { workspace, createWorkspaceWorkScope } from "../workspace.svelte.js";
  import { legacyCookiePlan } from "../legacy-cookies.js";
  /** @type {{ workspaceId: string, onimported: () => Promise<void>, disabled?: boolean }} */
  let { workspaceId, onimported, disabled = false } = $props();
  const workScope = createWorkspaceWorkScope();
  onDestroy(workScope.dispose);
  let plan = $derived(legacyCookiePlan(workspace.data.resources, workspaceId));
  let busy = $state(false),
    overwrite = $state(false),
    error = $state(""),
    notice = $state("");
  let report = $state(/** @type {Record<string, any> | null} */ (null));
  let reviewed = $state("");
  let input = $derived(
    JSON.stringify({ workspaceId, cookies: plan.entries, overwrite }),
  );
  async function restore(/** @type {boolean} */ preview) {
    if (busy || disabled || (!preview && reviewed !== input)) return;
    /** @type {import("../workspace.svelte.js").ScopedWorkspaceWork|undefined} */ let work;
    busy = true;
    error = "";
    notice = "";
    const snapshot = input;
    reviewed = "";
    try {
      work = workScope.begin();
      const result = await invoke("import_legacy_cookies", {
        ...JSON.parse(snapshot),
        preview,
      });
      if (!work.current() || input !== snapshot) return;
      report = result;
      if (preview) reviewed = snapshot;
      else {
        reviewed = "";
        notice = `Restored ${report?.imported || 0} cookies. Kept ${report?.kept || 0} existing cookies; ${report?.replaced || 0} replaced; ${report?.expired || 0} expired during review.`;
        await onimported();
      }
    } catch (e) {
      if (!work || work.current()) error = String(e);
      reviewed = "";
    } finally {
      work?.finish();
      busy = false;
    }
  }
</script>

{#if plan.jars}
  <details class="legacy-cookie-import">
    <summary>Restore cookies from imported collections ({plan.total})</summary>
    <p class="hint">
      {plan.entries.length} candidates · {plan.expired} expired · {plan.superseded}
      duplicate source records superseded · {plan.issues.length} need attention. Original
      imported records are kept. Restoring uses their original expiry dates.
    </p>
    <label class="checkbox-label"
      ><input
        type="checkbox"
        bind:checked={overwrite}
        disabled={busy || disabled}
      /> Replace cookies with the same name, domain and path</label
    >
    <div class="resource-tools">
      <Button
        variant="secondary"
        class="secondary-button"
        disabled={busy || disabled || !plan.entries.length}
        onclick={() => restore(true)}>Preview restore</Button
      >
      {#if report && reviewed === input}<Button
          variant="primary"
          class="primary-button"
          disabled={busy || disabled || !report.imported}
          onclick={() => restore(false)}
          >Restore {report.imported} cookies</Button
        >{/if}
    </div>
    {#if report && reviewed === input}<p class="hint">
        {report.imported} ready ({report.replaced} replacements) · {report.kept} conflicts
        kept · {report.expired} expired · {report.issues.length} rejected by native
        parser.
      </p>{/if}
    {#if plan.issues.length || report?.issues?.length}<ul
        class="legacy-cookie-issues"
      >
        {#each plan.issues as issue}<li>{issue}</li>{/each}
        {#each report?.issues || [] as issue}<li>
            {plan.entries[issue.index]?.label || `Cookie #${issue.index + 1}`}: {issue.message}
          </li>{/each}
      </ul>{/if}
    {#if notice}<p class="hint" role="status">{notice}</p>{/if}
    {#if error}<p class="inline-error" role="alert">{error}</p>{/if}
  </details>
{/if}
