<script>
  import FormPanel from "./ui/FormPanel.svelte";
  import Feedback from "./ui/Feedback.svelte";
  import Field from "./ui/Field.svelte";
  import Textarea from "./ui/Textarea.svelte";
  import Button from "./ui/Button.svelte";
  import Input from "./ui/Input.svelte";
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
        <Button
          variant="ghost"
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
        </Button>
        <Button
          variant="ghost"
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
            })}><Icon name="trash" size={15} /></Button
        >
      </div>
    {:else}<p class="hint">
        {busy ? "Loading cookies…" : "No cookies in this collection."}
      </p>{/each}
  </div>
  <div class="resource-tools">
    <Button
      variant="secondary"
      class="secondary-button"
      disabled={busy}
      onclick={refresh}>Refresh</Button
    >
    <Button
      variant="danger"
      class="danger-button"
      disabled={busy || !cookies.length}
      onclick={() => (confirmClear = true)}>Clear all…</Button
    >
    {#if confirmClear}<span>Clear every cookie in this collection?</span><Button
        variant="danger"
        class="danger-button"
        disabled={busy}
        onclick={() => change({ clear: true })}>Confirm clear</Button
      ><Button
        variant="secondary"
        class="secondary-button"
        onclick={() => (confirmClear = false)}>Cancel</Button
      >{/if}
  </div>
  <form
    onsubmit={(event) => {
      event.preventDefault();
      void change({ url, raw, previous });
    }}
  >
    <FormPanel class="form-panel resource-form cookie-form">
      <Field
        >Cookie URL<Input
          type="url"
          required
          placeholder="https://api.example.com/"
          bind:value={url}
          disabled={busy}
        /></Field
      >
      <Field
        >Set-Cookie value<Textarea
          required
          spellcheck="false"
          class="code-editor small-editor"
          placeholder="session=value; Path=/; Secure; HttpOnly"
          bind:value={raw}
          disabled={busy}
        ></Textarea></Field
      >
    </FormPanel>
    <div class="modal-actions">
      {#if previous}<Button
          variant="secondary"
          class="secondary-button"
          type="button"
          onclick={() => {
            previous = null;
            raw = "";
            url = "";
          }}>New cookie</Button
        >{/if}
      <Button
        variant="primary"
        class="primary-button"
        type="submit"
        disabled={busy}
        >{busy ? "Saving…" : previous ? "Save cookie" : "Add cookie"}</Button
      >
    </div>
  </form>
  {#if notice}<p class="hint" role="status">{notice}</p>{/if}
  {#if error}<Feedback as="p" class="inline-error" role="alert"
      >{error}</Feedback
    >{/if}
{/if}
