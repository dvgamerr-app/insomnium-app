<script>
  import Select from "./ui/Select.svelte";
  import Icon from "./Icon.svelte";
  import ClientCertificates from "./ClientCertificates.svelte";
  import PluginsPanel from "./PluginsPanel.svelte";
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
  import { persist, updateSettings, workspace, pluginRegistry } from "$lib/workspace.svelte.js";
  import { onMount } from 'svelte';
  import { pluginThemeOptions } from '../plugin-themes.js';
  let pluginThemes=$state(/** @type {ReturnType<typeof pluginThemeOptions>} */([]));
  onMount(()=>pluginRegistry.subscribe(()=>{
    pluginThemes=pluginThemeOptions(pluginRegistry.captureThemes());
  }));
  /** @param {string} selected */
  const themeOptions=selected=>[
    {value:'dark',label:'Nocturne Dark'},{value:'light',label:'Nocturne Light'},
    ...pluginThemes.map(({value,label})=>({value,label})),
    ...(String(selected).startsWith('plugin:')&&!pluginThemes.some(item=>item.value===selected)
      ?[{value:selected,label:'Selected plugin theme (unavailable)'}]:[]),
  ];

  /** @type {{settings:Record<string, any>,tab?:string,onclose?:()=>void}} */
  let { settings, tab = $bindable("General"), onclose = () => {} } = $props();
  const tabs = ["General", "Editor", "Requests", "Network", "Git", "Plugins"];
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
  <div class="settings-body">
    <TabList
      class="settings-nav"
      aria-orientation="vertical"
      panelId="settings-panel-content"
      bind:activeId={activeTab}
      aria-label="Preference pages"
    >
      {#each tabs as name}<TabButton
          aria-selected={tab === name}
          onclick={() => (tab = name)}>{name}</TabButton
        >{/each}
    </TabList>
    <TabPanel id="settings-panel-content" labelledBy={activeTab}>
      <div class="settings-scroll">
        <div class="settings-content">
          {#if tab === "Plugins"}
            <PluginsPanel {settings} />
          {:else if tab === "General"}
            <section
              class="settings-section"
              aria-labelledby="settings-appearance-title"
            >
              <h3 id="settings-appearance-title">Appearance</h3>
              <p class="hint">Colour theme for the whole application.</p>
              <div class="settings-grid">
                <Field layout="inline" class="checkbox-label" description="Show password fields as text throughout the application."><Checkbox checked={settings.showPasswords === true} onchange={event=>updateSettings({showPasswords:event.currentTarget.checked})}/>Reveal passwords</Field>
                <Field layout="inline" class="checkbox-label" description="Response source links open in your system browser. Alt+Enter opens the link at the caret."><Checkbox checked={settings.disableResponsePreviewLinks === true} onchange={event=>updateSettings({disableResponsePreviewLinks:event.currentTarget.checked})}/>Disable response preview links</Field>
                <Field label="Request and response layout"><Select
                  value={settings.forceVerticalLayout === false ? "horizontal" : "vertical"}
                  onchange={event => updateSettings({forceVerticalLayout:event.currentTarget.value === "vertical"})}>
                  <option value="vertical">Vertical (stacked)</option>
                  <option value="horizontal">Horizontal (side by side)</option>
                </Select><span class="hint">Narrow panels always stack vertically.</span></Field>
                <Field label="Interface font" description="Comma-separated font families. Leave blank for the application default.">
                  <Input placeholder='"Segoe UI", sans-serif' value={settings.fontInterface ?? ""}
                    onchange={event => updateSettings({fontInterface:event.currentTarget.value})}/></Field>
                <Field label="Interface font size (px)"><Input type="number" min="8" max="24" step="1"
                  value={settings.fontSize ?? 12}
                  onchange={event => { if(event.currentTarget.reportValidity()) updateSettings({fontSize:event.currentTarget.valueAsNumber}); }}/></Field>
                <Field label="Window zoom"><Select value={settings.windowZoom ?? 1}
                  onchange={event => updateSettings({windowZoom:Number(event.currentTarget.value)})}>
                  {#each [...new Set([0.25,0.5,0.75,1,1.25,1.5,1.75,2,2.5,3,4,5,settings.windowZoom ?? 1])].sort((a,b)=>a-b) as zoom}
                    <option value={zoom}>{Math.round(zoom*100)}%</option>
                  {/each}
                </Select></Field>
                <Field label="Theme"
                  ><Dropdown
                    value={settings.theme}
                    onchange={(event) =>
                      updateSettings({ theme: event.currentTarget.value })}
                    options={themeOptions(settings.theme)}
                  /></Field
                >
                <Field layout="inline" class="checkbox-label"><Checkbox checked={settings.autoDetectColorScheme===true} onchange={event=>updateSettings({autoDetectColorScheme:event.currentTarget.checked})}/>Follow system colour scheme</Field>
                {#if settings.autoDetectColorScheme}
                  {#each [['lightTheme','Light theme','light'],['darkTheme','Dark theme','dark']] as [key,label,fallback]}
                    <Field {label}><Dropdown value={settings[key]??fallback} options={themeOptions(settings[key]??fallback)} onchange={event=>updateSettings({[key]:event.currentTarget.value})}/></Field>
                  {/each}
                {/if}
              </div>
            </section>
            <section
              class="settings-section"
              aria-labelledby="settings-shortcuts-title"
            >
              <h3 id="settings-shortcuts-title" tabindex="-1">Shortcuts</h3>
              <p class="hint">
                Ctrl/Cmd + Enter, Ctrl/Cmd + R or F5: send.
                Ctrl/Cmd + N or Ctrl/Cmd + Alt + N: new request · + P: switch requests.
                Ctrl + Tab / Ctrl + Shift + Tab: recent requests (release Ctrl to open).
                + L: URL · + E: environment · + K: cookies · + ,: preferences.
                Ctrl/Cmd + Shift + F: format the focused body editor, or filter requests outside an editor.
                Ctrl/Cmd + Shift + Enter: request options.
                Ctrl/Cmd + Shift + ,: collection settings.
                Ctrl/Cmd + Shift + E: switch environment · + Shift + L: HTTP method.
                Ctrl/Cmd + D: duplicate request · + Shift + Delete: delete request.
                Ctrl/Cmd + Shift + N: new folder.
                Ctrl/Cmd + Shift + H: response or connection history.
                Ctrl/Cmd + Shift + P: pin/unpin request.
                Ctrl/Cmd + Shift + R: reload loaded plugins.
                Ctrl/Cmd + Shift + G: generate request code.
                Ctrl/Cmd + Shift + I: focus the loaded GraphQL schema filter.
                Ctrl/Cmd + \: toggle sidebar · + ': focus and select HTTP response.
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
                <Field layout="inline" class="checkbox-label"><Checkbox checked={settings.useBulkHeaderEditor === true} onchange={event=>updateSettings({useBulkHeaderEditor:event.currentTarget.checked})}/>Bulk edit headers</Field>
                <Field layout="inline" class="checkbox-label"><Checkbox checked={settings.useBulkParametersEditor === true} onchange={event=>updateSettings({useBulkParametersEditor:event.currentTarget.checked})}/>Bulk edit query parameters</Field>
                <Field label="Keymap"
                  ><Dropdown
                    value={settings.editorKeyMap}
                    onchange={(event) =>
                      updateSettings({
                        editorKeyMap: event.currentTarget.value,
                      })}
                    options={[
                      { value: "default", label: "Default" },
                      { value: "vim", label: "Vim" },
                      { value: "emacs", label: "Emacs" },
                      { value: "sublime", label: "Sublime" },
                    ]}
                  /></Field
                >
                <Field label="Text editor font" description="Comma-separated font families. Leave blank for the application default.">
                  <Input placeholder='Consolas, monospace' value={settings.fontMonospace ?? ""}
                    onchange={event => updateSettings({fontMonospace:event.currentTarget.value})}/></Field>
                <Field layout="inline" class="checkbox-label"><Checkbox checked={settings.fontVariantLigatures !== false}
                  onchange={event => updateSettings({fontVariantLigatures:event.currentTarget.checked})}/>Font ligatures</Field>
                <Field label="Font size (px)"><Input type="number" min="8" max="24" step="1"
                  value={settings.editorFontSize ?? 12}
                  onchange={event => { if (event.currentTarget.reportValidity()) updateSettings({editorFontSize:event.currentTarget.valueAsNumber}); }} /></Field>
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
              <Field layout="inline" class="checkbox-label"><Checkbox checked={settings.showVariableSourceAndValue === true} onchange={event=>updateSettings({showVariableSourceAndValue:event.currentTarget.checked})}/>Show variable source and value in code editors</Field>
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
                <Field label="HTTP version"><Select value={settings.httpVersion ?? "default"}
                  onchange={event => updateSettings({httpVersion:event.currentTarget.value})}>
                  <option value="default">Automatic</option><option value="1.0">HTTP/1.0</option>
                  <option value="1.1">HTTP/1.1</option><option value="2-prior-knowledge">HTTP/2 (prior knowledge)</option>
                </Select></Field>
                <Field label="Request timeout (ms, 0 = unlimited)"
                  ><Input
                    type="number"
                    min="0"
                    max="3600000"
                    step="1"
                    value={settings.timeout}
                    onchange={(event) =>
                      updateSettings({ timeout: optionalNumber(event) })}
                  /></Field
                >
                <Field label="Maximum redirects"><Input type="number" min="-1" max="2147483647" step="1"
                  value={settings.maxRedirects ?? 10}
                  onchange={event=>{if(event.currentTarget.reportValidity()) updateSettings({maxRedirects:optionalNumber(event)})}}/></Field>
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
              <p class="hint">Maximum redirects applies unless a request overrides it. Use -1 for unlimited, or 0 to reject redirects.</p>
              <Field layout="inline" class="checkbox-label"
                ><Checkbox
                  checked={settings.filterResponsesByEnv}
                  onchange={(event) => updateSettings({ filterResponsesByEnv: event.currentTarget.checked })}
                />Filter response history by environment</Field
              >
              <Field layout="inline" class="checkbox-label"
                ><Checkbox
                  checked={settings.followRedirects}
                  onchange={(event) =>
                    updateSettings({
                      followRedirects: event.currentTarget.checked,
                    })}
                />Follow redirects</Field
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
              <Field layout="inline" class="checkbox-label"><Checkbox checked={settings.proxyEnabled !== false}
                onchange={event => updateSettings({proxyEnabled:event.currentTarget.checked})}/>Enable app proxy settings</Field>
              {#each [["httpProxy","HTTP proxy URL"],["httpsProxy","HTTPS proxy URL"]] as [key,label]}
                <Field {label}><Input placeholder="Use fallback proxy" value={settings[key] ?? ""}
                  onchange={event => updateSettings({[key]:event.currentTarget.value})}/></Field>
              {/each}
              <Field label="Bypass proxies"><Input placeholder="localhost, .example.com, 192.168.0.0/16"
                value={settings.noProxy ?? ""} onchange={event => updateSettings({noProxy:event.currentTarget.value})}/></Field>
              <Field label="Proxy URL"
                ><Input
                  placeholder="http://127.0.0.1:8080"
                  value={settings.proxy}
                  onchange={(event) =>
                    updateSettings({ proxy: event.currentTarget.value })}
                /></Field
              >
              <p class="hint">HTTP/HTTPS, SOCKS4/4a and SOCKS5/5h URLs are supported.
                Use socks4a or socks5h to resolve destination names through the proxy.
                Scheme-specific URLs take priority over the fallback Proxy URL. With explicit rules,
                other schemes connect directly when no fallback is set. Bypass accepts comma-separated
                domains (including subdomains), IP addresses, CIDR ranges, or * for all hosts.
                Bypass applies to configured and automatic proxies. A nonempty list replaces automatic exclusions; blank keeps them.
                With no URL set, environment or Windows/macOS manual system proxy settings apply;
                disabling app proxy settings connects directly. Request-specific overrides take priority.</p>
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
                description="Fallback identity when no enabled collection certificate matches this hostname."
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
            {#if collection}
              <ClientCertificates
                collectionId={collection._id}
                collectionName={collection.name || "this collection"}
              />
            {/if}
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
                  {#if authorError}<Feedback
                      as="p"
                      class="inline-error"
                      role="alert">{authorError}</Feedback
                    >{/if}
                  <div class="settings-grid">
                    <Field
                      id="git-author-name"
                      label="Author name"
                      required
                      busy={authorBusy}><Input bind:value={authorName} /></Field
                    >
                    <Field
                      id="git-author-email"
                      label="Author email"
                      required
                      busy={authorBusy}
                      ><Input type="email" bind:value={authorEmail} /></Field
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
  </div>
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
    min-width: 0;
  }
  .settings-body {
    display: flex;
    flex: 1;
    min-height: 0;
    min-width: 0;
  }
  .settings-body :global(.settings-nav) {
    flex: 0 0 220px;
  }
  @media (max-width: 760px) {
    .settings-body :global(.settings-nav) {
      flex-basis: 150px;
    }
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
  p,
  .settings-panel :global(.settings-section h3),
  .settings-panel :global(.settings-section p) {
    margin: 0;
  }
  h2 {
    font-size: var(--font-size-15);
    font-weight: 600;
  }
  h3,
  .settings-panel :global(.settings-section h3) {
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
  .settings-panel :global(.settings-section),
  .settings-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
  }
  .settings-panel :global(.settings-section) {
    padding: var(--space-18);
    border: 1px solid var(--line);
  }
  .settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
    gap: var(--space-12);
    align-items: start;
  }
  .settings-actions {
    display: flex;
    align-items: center;
    gap: var(--space-12);
  }
</style>
