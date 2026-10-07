<script>
  import Icon from "./Icon.svelte";
  import Button from "./ui/Button.svelte";
  import Checkbox from "./ui/Checkbox.svelte";
  import Dropdown from "./ui/Dropdown.svelte";
  import Field from "./ui/Field.svelte";
  import Input from "./ui/Input.svelte";
  import Textarea from "./ui/Textarea.svelte";
  import { updateSettings } from "$lib/workspace.svelte.js";

  /** @type {{settings:Record<string, any>,onclose?:()=>void}} */
  let { settings, onclose = () => {} } = $props();
  const sections = [
    ["appearance", "Appearance"],
    ["editor", "Editor"],
    ["requests", "Requests"],
    ["network", "Network & certificates"],
    ["shortcuts", "Shortcuts"],
  ];
  let active = $state("appearance");
  /** @type {HTMLElement|undefined} */ let scroller = $state();
  /** @param {string} key */
  function jump(key) {
    active = key;
    scroller
      ?.querySelector(`#settings-${key}`)
      ?.scrollIntoView({ block: "start" });
  }
  /** @param {Event & {currentTarget:HTMLInputElement}} event */
  const optionalNumber = (event) =>
    event.currentTarget.value === ""
      ? undefined
      : event.currentTarget.valueAsNumber;
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
    <nav class="settings-nav" aria-label="Preference sections">
      {#each sections as [key, label]}<Button
          variant="plain"
          class={["settings-nav-item", active === key && "active"]
            .filter(Boolean)
            .join(" ")}
          aria-current={active === key ? "true" : undefined}
          onclick={() => jump(key)}>{label}</Button
        >{/each}
    </nav>
    <div class="settings-scroll" bind:this={scroller}>
      <div class="settings-content">
        <section
          class="settings-section"
          id="settings-appearance"
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
          id="settings-editor"
          aria-labelledby="settings-editor-title"
        >
          <h3 id="settings-editor-title">Editor</h3>
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

        <section
          class="settings-section"
          id="settings-requests"
          aria-labelledby="settings-requests-title"
        >
          <h3 id="settings-requests-title">Requests</h3>
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

        <section
          class="settings-section"
          id="settings-network"
          aria-labelledby="settings-network-title"
        >
          <h3 id="settings-network-title">Network &amp; certificates</h3>
          <p class="hint">
            Proxy and TLS trust. Stored locally in the workspace file.
          </p>
          <Field label="Proxy URL"
            ><Input
              placeholder="http://127.0.0.1:8080"
              value={settings.proxy}
              onchange={(event) =>
                updateSettings({ proxy: event.currentTarget.value })}
            /></Field
          >
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

        <section
          class="settings-section"
          id="settings-shortcuts"
          aria-labelledby="settings-shortcuts-title"
        >
          <h3 id="settings-shortcuts-title">Shortcuts</h3>
          <p class="hint">
            Ctrl/Cmd + Enter: send · + N: new request · + P: filter.
          </p>
        </section>
      </div>
    </div>
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
  .settings-body {
    display: flex;
    flex: 1;
    min-height: 0;
  }
  .settings-nav {
    display: flex;
    flex: 0 0 220px;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-12);
    border-right: 1px solid var(--line);
    overflow: auto;
  }
  .settings-nav :global(.settings-nav-item) {
    justify-content: flex-start;
    text-align: left;
    width: 100%;
    color: var(--muted);
  }
  .settings-nav :global(.settings-nav-item.active) {
    color: var(--text);
  }
  .settings-scroll {
    flex: 1;
    min-width: 0;
    overflow: auto;
    scroll-behavior: smooth;
  }
  .settings-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-20);
    padding: var(--space-20);
  }
  .settings-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    padding: var(--space-18);
    border: 1px solid var(--line);
    scroll-margin-top: var(--space-12);
  }
  .settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--space-12);
    align-items: start;
  }
  @media (max-width: 760px) {
    .settings-nav {
      flex-basis: 150px;
    }
  }
</style>
