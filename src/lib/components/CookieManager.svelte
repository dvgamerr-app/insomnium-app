<script>
  import { invokeCookie } from '../cookie-native.js';

  import FormPanel from "./ui/FormPanel.svelte";
  import Feedback from "./ui/Feedback.svelte";
  import Field from "./ui/Field.svelte";
  import Textarea from "./ui/Textarea.svelte";
  import Button from "./ui/Button.svelte";
  import Input from "./ui/Input.svelte";
  import { onMount, onDestroy } from "svelte";
  import { isTauri } from "@tauri-apps/api/core";
  import { createWorkspaceWorkScope, workspace, persist } from "../workspace.svelte.js";
  import {cookieTemplateSources,replaceCookieTemplateSources} from '../cookie-template-sources.js';
  import CookieTemplateSources from './CookieTemplateSources.svelte';
  import Icon from "./Icon.svelte";
  import LegacyCookieImport from "./LegacyCookieImport.svelte";
  /** @type {{ workspaceId: string }} */
  let { workspaceId } = $props();
  const workScope = createWorkspaceWorkScope();
  onDestroy(workScope.dispose);
  let cookies = $state(/** @type {Record<string, any>[]} */ ([]));
  let nativeBusy = $state(false),
    error = $state(""),
    notice = $state("");
  let templateBusy=$state(false);
  const busy=$derived(nativeBusy||templateBusy);
  const templateSources=$derived(cookieTemplateSources(workspace.data.resources,workspaceId));
  let url = $state(""),
    raw = $state("");
  let previous = $state(/** @type {Record<string, any> | null} */ (null));
  let fieldError = $state.raw(/** @type {{field:'url'|'raw',message:string}|null} */ (null));
  let formOwner = 0;
  let confirmClear = $state(false);
  function resetFields() {
    formOwner++;
    fieldError = null;
    previous = null;
    raw = "";
    url = "";
  }
  /** @param {Event & {currentTarget:HTMLInputElement}} event */
  function correctUrl(event) {
    if (fieldError?.field !== "url" || !event.currentTarget.validity.valid) return;
    try {
      if (["http:", "https:"].includes(new URL(event.currentTarget.value).protocol)) fieldError = null;
    } catch {}
  }
  /** @param {Event & {currentTarget:HTMLTextAreaElement}} event */
  function correctRaw(event) {
    if (fieldError?.field === "raw" && new TextEncoder().encode(event.currentTarget.value).byteLength <= 8192) fieldError = null;
  }
  async function refresh() {
    if (!isTauri()) return;
    /** @type {import("../workspace.svelte.js").ScopedWorkspaceWork|undefined} */ let work;
    nativeBusy = true;
    try {
      work = workScope.begin();
      const result = await invokeCookie("list_cookies", { workspaceId }, work.signal);
      if (!work.current()) return;
      cookies = result;
      error = "";
    } catch (e) {
      if (!work || work.current()) error = String(e);
    } finally {
      work?.finish();
      nativeBusy = false;
    }
  }
  onMount(() => {
    void refresh();
  });
  async function change(/** @type {Record<string, any>} */ patch) {
    if (busy) return;
    const formPatch = typeof patch.url === "string" && typeof patch.raw === "string";
    const owner = formOwner;
    if (formPatch) fieldError = null;
    /** @type {import("../workspace.svelte.js").ScopedWorkspaceWork|undefined} */ let work;
    let nativePending = false;
    nativeBusy = true;
    error = "";
    notice = "";
    try {
      work = workScope.begin();
      nativePending = true;
      await invokeCookie("change_cookie", {
        workspaceId,
        url: null,
        raw: null,
        previous: null,
        clear: false,
        ...patch,
      }, work.signal);
      nativePending = false;
      if (!work.current()) return;
      if(patch.clear&&templateSources.length){
        workspace.data.resources=replaceCookieTemplateSources(workspace.data.resources,workspaceId,[]);
        if(!(await persist()))throw Error('Template cookie sources could not be cleared.');
        if(!work.current())return;
      }
      resetFields();
      confirmClear = false;
      await refresh();
      if (work.current()) notice = "Cookies saved.";
    } catch (e) {
      if (!work || work.current()) {
        const message = String(e);
        const field = message === "Cookie URL must use HTTP or HTTPS" ? "url"
          : message === "Cookie exceeds the 8 KiB editor limit" ? "raw" : null;
        if (nativePending && formPatch && field) {
          if (owner === formOwner && patch.url === url && patch.raw === raw && patch.previous === previous) fieldError = { field, message };
        } else error = message;
      }
    } finally {
      work?.finish();
      nativeBusy = false;
    }
  }
  function edit(/** @type {Record<string, any>} */ cookie) {
    formOwner++;
    fieldError = null;
    previous = { domain: cookie.domain, path: cookie.path, name: cookie.name };
    const domain = String(cookie.domain);
    const host = domain.includes(":") && !domain.startsWith("[")
      ? `[${domain}]` : domain;
    url = `${cookie.secure ? "https" : "http"}://${host}${cookie.path}`;
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
  <CookieTemplateSources {workspaceId} disabled={nativeBusy} onbusy={value=>templateBusy=value} />
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
      disabled={busy || (!cookies.length&&!templateSources.length)}
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
      <Field label="Cookie URL" error={fieldError?.field === "url" ? fieldError.message : ""}
        ><Input
          type="url"
          required
          placeholder="https://api.example.com/"
          bind:value={url}
          oninput={correctUrl}
          disabled={busy}
        /></Field
      >
      <Field label="Set-Cookie value" error={fieldError?.field === "raw" ? fieldError.message : ""}
        ><Textarea
          required
          spellcheck="false"
          class="code-editor small-editor"
          placeholder="session=value; Path=/; Secure; HttpOnly"
          bind:value={raw}
          oninput={correctRaw}
          disabled={busy}
        ></Textarea></Field
      >
    </FormPanel>
    <div class="modal-actions">
      {#if previous}<Button
          variant="secondary"
          class="secondary-button"
          type="button"
          onclick={resetFields}>New cookie</Button
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
