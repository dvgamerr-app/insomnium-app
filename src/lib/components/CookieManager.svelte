<script>
  import { onMount, onDestroy } from "svelte";
  import { invoke, isTauri } from "@tauri-apps/api/core";
  import { createWorkspaceWorkScope } from "../workspace.svelte.js";
  import Icon from "./Icon.svelte";
  import LegacyCookieImport from "./LegacyCookieImport.svelte";
  /** @type {{ workspaceId: string }} */
  let { workspaceId } = $props();
  const workScope = createWorkspaceWorkScope();
  onDestroy(workScope.dispose);
  let cookies = $state(/** @type {Record<string, any>[]} */ ([]));
  let busy = $state(false),
    error = $state(""),
    notice = $state("");
  let url = $state(""),
    raw = $state("");
  let previous = $state(/** @type {Record<string, any> | null} */ (null));
  let confirmClear = $state(false);
  async function refresh() {
    if (!isTauri()) return;
    /** @type {import("../workspace.svelte.js").ScopedWorkspaceWork|undefined} */ let work;
    busy = true;
    try {
      work = workScope.begin();
      const result = await invoke("list_cookies", { workspaceId });
      if (!work.current()) return;
      cookies = result;
      error = "";
    } catch (e) {
      if (!work || work.current()) error = String(e);
    } finally {
      work?.finish();
      busy = false;
    }
  }
  onMount(() => {
    void refresh();
  });
  async function change(/** @type {Record<string, any>} */ patch) {
    if (busy) return;
    /** @type {import("../workspace.svelte.js").ScopedWorkspaceWork|undefined} */ let work;
    busy = true;
    error = "";
    notice = "";
    try {
      work = workScope.begin();
      await invoke("change_cookie", {
        workspaceId,
        url: null,
        raw: null,
        previous: null,
        clear: false,
        ...patch,
      });
      if (!work.current()) return;
      previous = null;
      raw = "";
      url = "";
      confirmClear = false;
      await refresh();
      if (work.current()) notice = "Cookies saved.";
    } catch (e) {
      if (!work || work.current()) error = String(e);
    } finally {
      work?.finish();
      busy = false;
    }
  }
  function edit(/** @type {Record<string, any>} */ cookie) {
    previous = { domain: cookie.domain, path: cookie.path, name: cookie.name };
    url = `${cookie.secure ? "https" : "http"}://${cookie.domain}${cookie.path}`;
    raw = cookie.raw;
    notice = "";
  }
</script>

{#if !isTauri()}
  <p>Cookie management is available in the desktop app.</p>
{:else}
  <p class="hint">
    Cookies are isolated by collection and saved locally, including session
    cookies.
  </p>
  <LegacyCookieImport {workspaceId} onimported={refresh} disabled={busy} />
  <div class="cookie-list">
    {#each cookies as cookie (`${cookie.domain}\n${cookie.path}\n${cookie.name}`)}
      <div class="cookie-entry">
        <button
          class="cookie-detail"
          disabled={busy}
          onclick={() => edit(cookie)}
          title="Edit cookie"
        >
          <strong>{cookie.name}</strong><span>{cookie.domain}{cookie.path}</span
          >
          <small
            >{cookie.hostOnly ? "Host only" : "Domain"}{cookie.secure
              ? " · Secure"
              : ""}{cookie.httpOnly ? " · HttpOnly" : ""}</small
          >
        </button>
        <button
          class="icon-button subtle"
          disabled={busy}
          aria-label={`Delete cookie ${cookie.name}`}
          title="Delete cookie"
          onclick={() =>
            change({
              previous: {
                domain: cookie.domain,
                path: cookie.path,
                name: cookie.name,
              },
            })}><Icon name="trash" size={15} /></button
        >
      </div>
    {:else}<p class="hint">
        {busy ? "Loading cookies…" : "No cookies in this collection."}
      </p>{/each}
  </div>
  <div class="resource-tools">
    <button class="secondary-button" disabled={busy} onclick={refresh}
      >Refresh</button
    >
    <button
      class="danger-button"
      disabled={busy || !cookies.length}
      onclick={() => (confirmClear = true)}>Clear all…</button
    >
    {#if confirmClear}<span>Clear every cookie in this collection?</span><button
        class="danger-button"
        disabled={busy}
        onclick={() => change({ clear: true })}>Confirm clear</button
      ><button class="secondary-button" onclick={() => (confirmClear = false)}
        >Cancel</button
      >{/if}
  </div>
  <form
    onsubmit={(event) => {
      event.preventDefault();
      void change({ url, raw, previous });
    }}
  >
    <div class="form-panel resource-form cookie-form">
      <label
        >Cookie URL<input
          type="url"
          required
          placeholder="https://api.example.com/"
          bind:value={url}
          disabled={busy}
        /></label
      >
      <label
        >Set-Cookie value<textarea
          required
          spellcheck="false"
          class="code-editor small-editor"
          placeholder="session=value; Path=/; Secure; HttpOnly"
          bind:value={raw}
          disabled={busy}></textarea></label
      >
    </div>
    <div class="modal-actions">
      {#if previous}<button
          class="secondary-button"
          type="button"
          onclick={() => {
            previous = null;
            raw = "";
            url = "";
          }}>New cookie</button
        >{/if}
      <button class="primary-button" type="submit" disabled={busy}
        >{busy ? "Saving…" : previous ? "Save cookie" : "Add cookie"}</button
      >
    </div>
  </form>
  {#if notice}<p class="hint" role="status">{notice}</p>{/if}
  {#if error}<p class="inline-error" role="alert">{error}</p>{/if}
{/if}
