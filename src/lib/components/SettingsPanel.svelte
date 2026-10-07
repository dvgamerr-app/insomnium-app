<script>
  import Icon from "./Icon.svelte";
  import Button from "./ui/Button.svelte";
  import Checkbox from "./ui/Checkbox.svelte";
  import Dropdown from "./ui/Dropdown.svelte";
  import Feedback from "./ui/Feedback.svelte";
  import Field from "./ui/Field.svelte";
  import Input from "./ui/Input.svelte";
  import TabButton from "./ui/TabButton.svelte";
  import TabList from "./ui/TabList.svelte";
  import TabPanel from "./ui/TabPanel.svelte";
  import Textarea from "./ui/Textarea.svelte";
  import { nativeGitBinding } from "../git-client.js";
  import { persist, updateSettings, workspace } from "$lib/workspace.svelte.js";

  /** @type {{settings:Record<string, any>,tab?:string,onclose?:()=>void}} */
  let { settings, tab = $bindable("General"), onclose = () => {} } = $props();
  const tabs = ["General", "Editor", "Requests", "Network", "Git"];
  let activeTab = $state("");
  /** @param {Event & {currentTarget:HTMLInputElement}} event */
  const optionalNumber = (event) =>
    event.currentTarget.value === ""
      ? undefined
      : event.currentTarget.valueAsNumber;

  const collection = $derived(
    workspace.data.resources.find(
      (r) => r._id === workspace.data.activeWorkspaceId,
    ),
  );
  const gitBinding = $derived.by(() => {
    try {
      return nativeGitBinding(
        workspace.data.resources,
        workspace.data.activeWorkspaceId,
      );
    } catch {
      return null;
    }
  });
  let authorName = $state(""),
    authorEmail = $state(""),
    authorBusy = $state(false),
    authorError = $state(""),
    authorSaved = $state(false);
  $effect(() => {
    authorName = String(gitBinding?.author?.name || "");
    authorEmail = String(gitBinding?.author?.email || "");
    authorSaved = false;
  });
  async function saveAuthor() {
    if (!gitBinding || !authorName.trim() || !authorEmail.trim()) return;
    authorBusy = true;
    authorError = "";
    authorSaved = false;
    try {
      gitBinding.author = {
        name: authorName.trim(),
        email: authorEmail.trim(),
      };
      gitBinding.modified = Date.now();
      if (!(await persist()))
        throw new Error("Could not save author settings.");
      authorSaved = true;
    } catch (error) {
      authorError = String(error);
    } finally {
      authorBusy = false;
    }
  }
</script>

<section class="settings-panel" aria-label="Preferences">
  <header class="settings-heading">
    <div>
      <h2>Preferences</h2>
      <span class="hint">Applies to every collection on this device</span>
    </div>
    <span class="spacer"></span>
    <Button
      variant="ghost"
      aria-label="Close Preferences"
      title="Close Preferences"
      onclick={onclose}><Icon name="close" /></Button
    >
  </header>
  <TabList
    panelId="settings-panel-content"
    bind:activeId={activeTab}
    aria-label="Preference pages"
  >
    {#each tabs as name}<TabButton
        class={tab === name ? "active" : ""}
        aria-selected={tab === name}
        onclick={() => (tab = name)}>{name}</TabButton
      >{/each}
  </TabList>
  <TabPanel id="settings-panel-content" labelledBy={activeTab}>
    <div class="settings-scroll">
      <div class="settings-content">
        {#if tab === "General"}
          <section
            class="settings-section"
            aria-labelledby="settings-appearance-title"
          >
            <h3 id="settings-appearance-title">Appearance</h3>
            <p class="hint">Colour theme for the whole application.</p>
            <div class="settings-grid">
              <Field label="Theme"
                ><Dropdown
                  value={settings.theme}
                  onchange={(event) =>
                    updateSettings({ theme: event.currentTarget.value })}
                  options={[
                    { value: "dark", label: "Nocturne Dark" },
                    { value: "light", label: "Nocturne Light" },
                  ]}
                /></Field
              >
            </div>
          </section>
          <section
            class="settings-section"
            aria-labelledby="settings-shortcuts-title"
          >
            <h3 id="settings-shortcuts-title">Shortcuts</h3>
            <p class="hint">
              Ctrl/Cmd + Enter: send · + N: new request · + P: filter.
            </p>
          </section>
        {:else if tab === "Editor"}
          <section
            class="settings-section"
            aria-labelledby="settings-editor-title"
          >
            <h3 id="settings-editor-title">Code editor</h3>
            <p class="hint">Code editors for bodies, scripts and specs.</p>
            <div class="settings-grid">
              <Field label="Keymap"
                ><Dropdown
                  value={settings.editorKeyMap}
                  onchange={(event) =>
                    updateSettings({ editorKeyMap: event.currentTarget.value })}
                  options={[
                    { value: "default", label: "Default" },
                    { value: "vim", label: "Vim" },
                    { value: "emacs", label: "Emacs" },
                    { value: "sublime", label: "Sublime" },
                  ]}
                /></Field
              >
              <Field label="Indent width"
                ><Input
                  type="number"
                  min="1"
                  max="16"
                  value={settings.editorIndentSize}
                  onchange={(event) =>
                    updateSettings({
                      editorIndentSize: event.currentTarget.valueAsNumber,
                    })}
                /></Field
              >
              <Field
                label="Autocomplete delay (ms)"
                description="0 disables automatic suggestions."
                ><Input
                  type="number"
                  min="0"
                  max="2000"
                  value={settings.autocompleteDelay}
                  onchange={(event) =>
                    updateSettings({
                      autocompleteDelay: event.currentTarget.valueAsNumber,
                    })}
                /></Field
              >
            </div>
            <Field layout="inline" class="checkbox-label"
              ><Checkbox
                checked={settings.editorIndentWithTabs}
                onchange={(event) =>
                  updateSettings({
                    editorIndentWithTabs: event.currentTarget.checked,
                  })}
              />Indent with tabs (except YAML)</Field
            >
            <Field layout="inline" class="checkbox-label"
              ><Checkbox
                checked={settings.editorLineWrapping}
                onchange={(event) =>
                  updateSettings({
                    editorLineWrapping: event.currentTarget.checked,
                  })}
              />Wrap long lines</Field
            >
          </section>
        {:else if tab === "Requests"}
          <section
            class="settings-section"
            aria-labelledby="settings-requests-title"
          >
            <h3 id="settings-requests-title">Sending</h3>
            <p class="hint">
              Defaults used when a request does not override them.
            </p>
            <div class="settings-grid">
              <Field label="Request timeout (ms)"
                ><Input
                  type="number"
                  min="1"
                  max="3600000"
                  value={settings.timeout}
                  onchange={(event) =>
                    updateSettings({ timeout: optionalNumber(event) })}
                /></Field
              >
              <Field label="Response history limit"
                ><Input
                  type="number"
                  min="1"
                  max="100"
                  value={settings.maxHistory}
                  onchange={(event) =>
                    updateSettings({ maxHistory: optionalNumber(event) })}
                /></Field
              >
            </div>
            <Field layout="inline" class="checkbox-label"
              ><Checkbox
                checked={settings.followRedirects}
                onchange={(event) =>
                  updateSettings({
                    followRedirects: event.currentTarget.checked,
                  })}
              />Follow redirects (maximum 10)</Field
            >
            <Field layout="inline" class="checkbox-label"
              ><Checkbox
                checked={settings.useCookies}
                onchange={(event) =>
                  updateSettings({ useCookies: event.currentTarget.checked })}
              />Send and store cookies</Field
            >
          </section>
        {:else if tab === "Network"}
          <section
            class="settings-section"
            aria-labelledby="settings-proxy-title"
          >
            <h3 id="settings-proxy-title">Proxy</h3>
            <Field label="Proxy URL"
              ><Input
                placeholder="http://127.0.0.1:8080"
                value={settings.proxy}
                onchange={(event) =>
                  updateSettings({ proxy: event.currentTarget.value })}
              /></Field
            >
          </section>
          <section
            class="settings-section"
            aria-labelledby="settings-tls-title"
          >
            <h3 id="settings-tls-title">Certificates</h3>
            <p class="hint">Stored locally in the workspace file.</p>
            <Field layout="inline" class="checkbox-label"
              ><Checkbox
                checked={settings.validateCertificates}
                onchange={(event) =>
                  updateSettings({
                    validateCertificates: event.currentTarget.checked,
                  })}
              />Validate TLS certificates</Field
            >
            <Field label="Custom CA (PEM)"
              ><Textarea
                class="code-editor small-editor"
                value={settings.caPem}
                onchange={(event) =>
                  updateSettings({ caPem: event.currentTarget.value })}
              ></Textarea></Field
            >
            <Field
              label="Client certificate host"
              description="Client identity applies only to matching hostnames."
              ><Input
                placeholder="api.example.com"
                value={settings.identityHost}
                onchange={(event) =>
                  updateSettings({ identityHost: event.currentTarget.value })}
              /></Field
            >
            <Field label="Client certificate and private key (PEM)"
              ><Textarea
                class="code-editor small-editor"
                value={settings.identityPem}
                onchange={(event) =>
                  updateSettings({ identityPem: event.currentTarget.value })}
              ></Textarea></Field
            >
          </section>
        {:else if tab === "Git"}
          <section
            class="settings-section"
            aria-labelledby="settings-author-title"
          >
            <h3 id="settings-author-title">Commit author</h3>
            <p class="hint">
              Used for commits and branch changes in {collection?.name ||
                "the active collection"}.
            </p>
            {#if !gitBinding}
              <p class="hint">
                Source Control is not set up for this collection yet. Open
                Source Control to create or connect a repository, then set the
                author here.
              </p>
            {:else}
              <form
                class="settings-form"
                onsubmit={(event) => {
                  event.preventDefault();
                  void saveAuthor();
                }}
              >
                {#if authorError}<Feedback as="p" class="inline-error" role="alert"
                    >{authorError}</Feedback
                  >{/if}
                <div class="settings-grid">
                  <Field id="git-author-name" label="Author name" required
                    ><Input
                      id="git-author-name"
                      required
                      bind:value={authorName}
                      disabled={authorBusy}
                    /></Field
                  >
                  <Field id="git-author-email" label="Author email" required
                    ><Input
                      id="git-author-email"
                      type="email"
                      required
                      bind:value={authorEmail}
                      disabled={authorBusy}
                    /></Field
                  >
                </div>
                <div class="settings-actions">
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={authorBusy ||
                      !authorName.trim() ||
                      !authorEmail.trim()}>Save author</Button
                  >
                  {#if authorSaved}<span class="hint" role="status"
                      >Author saved</span
                    >{/if}
                </div>
              </form>
            {/if}
          </section>
        {/if}
      </div>
    </div>
  </TabPanel>
</section>

<style>
  .settings-panel {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .settings-panel :global(.ui-tab-panel) {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }
  .settings-heading {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-14) var(--space-18);
    border-bottom: 1px solid var(--line);
  }
  h2,
  h3,
  p {
    margin: 0;
  }
  h2 {
    font-size: var(--font-size-15);
    font-weight: 600;
  }
  h3 {
    font-size: var(--font-size-13);
    font-weight: 600;
  }
  .settings-scroll {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: auto;
  }
  .settings-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-20);
    padding: var(--space-20);
  }
  .settings-section,
  .settings-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
  }
  .settings-section {
    padding: var(--space-18);
    border: 1px solid var(--line);
  }
  .settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--space-12);
    align-items: start;
  }
  .settings-actions {
    display: flex;
    align-items: center;
    gap: var(--space-12);
  }
</style>
