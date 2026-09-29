<script>
  import { jsonPrettify } from "../json-prettify.js";
  import { environmentFor, workspaceFor } from "../model.js";
  import CodeEditor from "./CodeEditor.svelte";
  import TemplatePreview from "./TemplatePreview.svelte";
  import { workspace as app } from "../workspace.svelte.js";
  import GraphqlEditor from "./GraphqlEditor.svelte";
  import OAuthEditor from "./OAuthEditor.svelte";
  import OAuth1Editor from "./OAuth1Editor.svelte";
  import AwsEditor from "./AwsEditor.svelte";
  import HawkEditor from "./HawkEditor.svelte";
  import AsapEditor from "./AsapEditor.svelte";
  import KeyValueEditor from "./KeyValueEditor.svelte";
  import Icon from "./Icon.svelte";
  import WebSocketMessageEditor from "./WebSocketMessageEditor.svelte";
  import { readUpload } from "../uploads.js";
  /** @type {{ request: Record<string, any>, onchange: (patch: Record<string, any>) => void }} */
  let { request, onchange } = $props();
  let tab = $state("Body");
  let error = $state("");
  let formatting = $state(false);
  let cancelFormat = () => {};
  const xmlBody = $derived(
    /^(?:application|text)\/(?:[\w.-]+\+)?xml(?:;|$)/i.test(
      request.body?.mimeType || "",
    ),
  );
  $effect(() => {
    request._id;
    request.body?.text;
    request.body?.mimeType;
    tab;
    return () => cancelFormat();
  });
  let hasManualAuthorization = $derived(
    (request.headers || []).some(
      (/** @type {Record<string, any>} */ h) =>
        !h.disabled && String(h.name).toLowerCase() === "authorization",
    ),
  );
  const mimeTypes = [
    ["", "No Body"],
    ["application/json", "JSON"],
    ["application/graphql", "GraphQL"],
    ["text/plain", "Text"],
    ["application/xml", "XML"],
    ["application/x-www-form-urlencoded", "Form URL Encoded"],
    ["multipart/form-data", "Multipart Form"],
    ["application/octet-stream", "Binary File"],
  ];
  function body(/** @type {Record<string, any>} */ patch) {
    onchange({ body: { ...request.body, ...patch } });
  }
  function auth(/** @type {Record<string, any>} */ patch) {
    onchange({ authentication: { ...request.authentication, ...patch } });
  }
  function format() {
    try {
      body({ text: jsonPrettify(request.body.text, "  ") });
      error = "";
    } catch (e) {
      error = String(e);
    }
  }
  function formatXml() {
    cancelFormat();
    const requestId = request._id;
    const source = String(request.body?.text || "");
    const mime = request.body?.mimeType;
    let active = true;
    /** @type {Worker | undefined} */ let worker;
    /** @type {ReturnType<typeof setTimeout> | undefined} */ let timer;
    const current = () =>
      request._id === requestId &&
      String(request.body?.text || "") === source &&
      request.body?.mimeType === mime &&
      tab === "Body";
    cancelFormat = () => {
      active = false;
      clearTimeout(timer);
      worker?.terminate();
      formatting = false;
    };
    const fail = (/** @type {string} */ message) => {
      if (!active) return;
      const relevant = current();
      cancelFormat();
      if (relevant) error = message;
    };
    formatting = true;
    error = "";
    try {
      worker = new Worker(new URL("../xml-format.worker.js", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (event) => {
        if (!active) return;
        if (event.data.error) {
          fail(event.data.error);
          return;
        }
        const relevant = current();
        cancelFormat();
        if (relevant) body({ text: event.data.text });
      };
      worker.onerror = () => fail("Could not format XML");
      worker.onmessageerror = () => fail("Could not read formatted XML");
      timer = setTimeout(
        () => fail("XML formatting exceeded 3 seconds; original body retained"),
        3000,
      );
      worker.postMessage({ text: source, indent: "  " });
    } catch (e) {
      fail(String(e));
    }
  }
</script>

<div class="editor-tabs" role="tablist" aria-label="Request editor">
  {#each ["Body", "Auth", "Query", "Headers", "Docs", "Settings"] as name}
    <button
      role="tab"
      aria-selected={tab === name}
      class:active={tab === name}
      onclick={() => (tab = name)}
      >{name === "Body" && request._type === "websocket_request"
        ? "Message"
        : name}
      {#if name === "Headers" && request.headers?.length}<span class="count"
          >{request.headers.filter((/** @type {any} */ h) => !h.disabled)
            .length}</span
        >{/if}
      {#if name === "Query" && request.parameters?.length}<span class="count"
          >{request.parameters.filter((/** @type {any} */ h) => !h.disabled)
            .length}</span
        >{/if}
    </button>
  {/each}
</div>
<section class="request-editor" aria-label={`${tab} editor`}>
  {#if tab === "Body" && request._type === "websocket_request"}
    <WebSocketMessageEditor {request} />
  {:else if tab === "Body"}
    <div class="editor-toolbar">
      <select
        aria-label="Body type"
        value={request.body?.mimeType || ""}
        onchange={(event) =>
          body({
            mimeType: event.currentTarget.value,
            ...(event.currentTarget.value === "application/graphql"
              ? { text: JSON.stringify({ query: "", variables: "{}" }) }
              : {}),
          })}
        >{#each mimeTypes as [value, label]}<option {value}>{label}</option
          >{/each}{#if request.body?.mimeType && !mimeTypes.some(([value]) => value === request.body.mimeType)}<option
            value={request.body.mimeType}>{request.body.mimeType}</option
          >{/if}</select
      ><span class="spacer"
      ></span>{#if request.body?.mimeType === "application/json"}<button
          class="text-button"
          onclick={format}><Icon name="code" size={14} /> Format JSON</button
        >{:else if xmlBody}<button
          class="text-button"
          disabled={formatting}
          onclick={formatXml}
          ><Icon name="code" size={14} />{formatting
            ? "Formatting…"
            : "Format XML"}</button
        >{/if}
    </div>
    {#if error}<p class="inline-error">{error}</p>{/if}
    {#if !request.body?.mimeType}<div class="empty-body">
        <Icon name="code" size={32} />
        <p>This request has no body</p>
        <span>Choose a body type above to add one.</span>
      </div>
    {:else if request.body.mimeType === "application/graphql"}
      {#key request._id}<GraphqlEditor {request} onchange={body} />{/key}
    {:else if ["application/x-www-form-urlencoded", "multipart/form-data"].includes(request.body.mimeType)}<KeyValueEditor
        rows={request.body.params || []}
        label="Parameter"
        files={request.body.mimeType === "multipart/form-data"}
        onchange={(params) => body({ params })}
      />
    {:else if request.body.mimeType === "application/octet-stream"}<label
        class="binary-picker"
        ><Icon name="upload" />{request.body.fileName ||
          "Select a file to send"}<input
          type="file"
          onchange={async (event) => {
            const file = event.currentTarget.files?.[0];
            if (file) {
              try {
                const upload = await readUpload(file);
                body(upload);
                error = "";
              } catch (e) {
                error = String(e);
              }
            }
          }}
        /></label
      >
    {:else}<CodeEditor
        identity={request._id + ":body"}
        value={request.body.text || ""}
        mode={request.body.mimeType}
        label="Request body"
        settings={app.data.settings}
        environment={environmentFor(
          app.data.resources,
          request,
          app.data.activeEnvironmentId,
        )}
        onchange={(text) => body({ text })}
        placeholder="Request body…"
      /><TemplatePreview
        resources={app.data.resources}
        history={app.data.history}
        environmentId={app.data.activeEnvironmentId}
        workspaceId={workspaceFor(app.data.resources, request._id)}
        identity={request._id}
        text={request.body.text || ""}
        context={environmentFor(
          app.data.resources,
          request,
          app.data.activeEnvironmentId,
        )}
        settings={app.data.settings}
        mode={request.body.mimeType}
      />{/if}
  {:else if tab === "Headers"}<KeyValueEditor
      rows={request.headers || []}
      onchange={(headers) => onchange({ headers })}
    />
  {:else if tab === "Query"}
    {#if request.pathParameters?.length}
      <p class="hint padded">Path variables</p>
      <KeyValueEditor
        rows={request.pathParameters}
        label="Path variable"
        onchange={(pathParameters) => onchange({ pathParameters })}
      />
      <p class="hint padded">Query parameters</p>
    {/if}
    <KeyValueEditor
      rows={request.parameters || []}
      label="Parameter"
      onchange={(parameters) => onchange({ parameters })}
    />
    <p class="hint padded">
      Parameters are appended to the URL when you send the request.
    </p>
  {:else if tab === "Auth"}
    <div class="form-panel">
      <label
        >Authentication<select
          value={request.authentication?.type || ""}
          onchange={(event) =>
            auth({
              type: event.currentTarget.value,
              ...(event.currentTarget.value === "oauth1" &&
              !request.authentication?.signatureMethod
                ? {
                    signatureMethod: "HMAC-SHA1",
                    bodyMode: "standard",
                    version: "1.0",
                  }
                : {}),
              ...(event.currentTarget.value === "oauth2" &&
              !request.authentication?.grantType
                ? { grantType: "client_credentials" }
                : {}),
              ...(event.currentTarget.value === "hawk" &&
              !request.authentication?.algorithm
                ? { algorithm: "sha256", bodyMode: "standard" }
                : {}),
            })}
          ><option value="">No Auth</option><option value="basic"
            >Basic Auth</option
          ><option value="bearer">Bearer Token</option><option value="apikey"
            >API Key</option
          ><option value="digest">Digest Auth</option><option value="oauth2"
            >OAuth 2.0</option
          ><option value="oauth1">OAuth 1.0</option><option value="iam"
            >AWS IAM</option
          ><option value="hawk">Hawk</option><option value="ntlm">NTLM</option
          ><option value="netrc">Netrc</option><option value="asap">ASAP</option
          >{#if request.authentication?.type && !["basic", "bearer", "apikey", "digest", "oauth2", "oauth1", "iam", "hawk", "asap", "ntlm", "netrc"].includes(request.authentication.type)}<option
              value={request.authentication.type}
              >{request.authentication.type} (migration pending)</option
            >{/if}</select
        ></label
      >
      {#if request.authentication?.type}<label class="checkbox-label"
          ><input
            type="checkbox"
            checked={!request.authentication.disabled}
            onchange={(event) =>
              auth({ disabled: !event.currentTarget.checked })}
          />Enable authentication</label
        >{/if}
      {#if request.authentication?.type === "oauth2"}<OAuthEditor
          {request}
          onchange={auth}
        />
      {:else if request.authentication?.type === "oauth1"}<OAuth1Editor
          authentication={request.authentication}
          onchange={auth}
        />
      {:else if request.authentication?.type === "iam"}<AwsEditor
          authentication={request.authentication}
          onchange={auth}
        />
      {:else if request.authentication?.type === "hawk"}<HawkEditor
          authentication={request.authentication}
          onchange={auth}
        />
      {:else if request.authentication?.type === "asap"}<AsapEditor
          authentication={request.authentication}
          onchange={auth}
        />
      {:else if request.authentication?.type === "netrc"}
        <p class="hint">
          Reads .netrc from HOME (USERPROFILE on Windows if HOME is unset), with
          _netrc fallback on Windows. Credentials stay in the desktop process.
          Each redirect looks up its destination hostname; a default entry can
          apply to any host. Disable authentication to stop lookup.
        </p>
      {:else if ["basic", "digest", "ntlm"].includes(request.authentication?.type)}<label
          >Username<input
            autocomplete="off"
            value={request.authentication.username || ""}
            oninput={(event) => auth({ username: event.currentTarget.value })}
          /></label
        ><label
          >Password<input
            type="password"
            autocomplete="off"
            value={request.authentication.password || ""}
            oninput={(event) => auth({ password: event.currentTarget.value })}
          /></label
        >
        {#if request.authentication.type === "ntlm"}
          <label
            >Domain (optional)<input
              value={request.authentication.domain || ""}
              oninput={(event) => auth({ domain: event.currentTarget.value })}
              autocomplete="off"
            /></label
          >
          <label
            >Workstation (Type 1 negotiation only)<input
              value={request.authentication.workstation || ""}
              oninput={(event) =>
                auth({ workstation: event.currentTarget.value })}
              autocomplete="off"
            /></label
          >
          <p class="hint">
            Uses explicit NTLMv2 credentials over HTTP/1.1. Username can include
            a domain. TLS channel binding is automatic. Workstation is sent only
            in the negotiate message; Type 3 workstation parity is pending.
            Credentials apply only to the original origin; a connection closed
            during the challenge stops authentication.
          </p>
        {/if}
        {#if request.authentication.type === "basic"}
          <label class="checkbox-label"
            ><input
              type="checkbox"
              checked={request.authentication.useISO88591 === true ||
                request.authentication.useISO88591 === "true"}
              onchange={(event) =>
                auth({ useISO88591: event.currentTarget.checked })}
            />Use ISO 8859-1 (Latin-1)</label
          >
          <p class="hint">
            Default is UTF-8. Latin-1 matches the original conversion;
            characters outside its range are truncated to their low byte.
          </p>
        {/if}
      {:else if request.authentication?.type === "bearer"}<label
          >Token<input
            type="password"
            autocomplete="off"
            value={request.authentication.token || ""}
            oninput={(event) => auth({ token: event.currentTarget.value })}
            placeholder={"{{ _.access_token }}"}
          /></label
        >
        <label
          >Header prefix<input
            value={request.authentication.prefix || ""}
            placeholder="Bearer"
            oninput={(event) => auth({ prefix: event.currentTarget.value })}
          /></label
        >
      {:else if request.authentication?.type === "apikey"}<label
          >Key<input
            value={request.authentication.key || ""}
            oninput={(event) => auth({ key: event.currentTarget.value })}
          /></label
        ><label
          >Value<input
            type="password"
            value={request.authentication.value || ""}
            oninput={(event) => auth({ value: event.currentTarget.value })}
          /></label
        ><label
          >Add to<select
            value={request.authentication.addTo || "header"}
            onchange={(event) => auth({ addTo: event.currentTarget.value })}
            ><option value="header">Header</option><option value="queryParams"
              >Query</option
            ><option value="cookie">Cookie</option>
            {#if request.authentication.addTo && !["header", "queryParams", "cookie"].includes(request.authentication.addTo)}<option
                value={request.authentication.addTo}
                >{request.authentication.addTo} (unsupported)</option
              >{/if}
          </select></label
        >
        {#if request.authentication.addTo === "cookie"}<p class="hint">
            Adds a Cookie header alongside manual cookie pairs. It takes
            precedence over collection cookies, is not saved to the cookie jar,
            and requires the desktop app.
          </p>{/if}
      {/if}
      {#if ["basic", "bearer", "apikey", "digest", "oauth1", "oauth2", "hawk", "asap", "ntlm", "netrc"].includes(request.authentication?.type) && hasManualAuthorization}
        <p class="hint">
          The enabled manual Authorization header takes precedence over
          generated authentication headers. API-key query parameters still
          apply.
        </p>
        {#if request.authentication.type === "oauth2"}<p class="hint">
            Send skips automatic token fetch/refresh while this header is
            enabled. Fetch/Refresh in Auth still manages saved tokens
            explicitly.
          </p>{/if}
      {/if}
      <p class="hint">
        Environment variables work in every authentication field.
      </p>
      {#if request.authentication?.type === "digest"}<p class="hint">
          Digest uses the server challenge in the desktop app. Credentials apply
          only to the original origin.
        </p>{/if}
    </div>
  {:else if tab === "Settings"}
    <div class="form-panel">
      {#if request._openapiIssues?.length}<div class="inline-error">
          <p>This generated request needs manual corrections:</p>
          <ul>
            {#each request._openapiIssues as issue}<li>{issue}</li>{/each}
          </ul>
          <button
            class="secondary-button"
            onclick={() =>
              onchange({ _openapiIssues: [], _openapiReviewedAt: Date.now() })}
            >I have corrected these request fields</button
          >
        </div>{/if}
      <label
        >Redirects<select
          value={request.settingFollowRedirects || "global"}
          onchange={(event) =>
            onchange({ settingFollowRedirects: event.currentTarget.value })}
        >
          <option value="global">Use global preference</option><option
            value="on">Follow redirects</option
          ><option value="off">Do not follow redirects</option>
        </select></label
      >
      <label class="checkbox-label"
        ><input
          type="checkbox"
          checked={request.settingSendCookies !== false}
          onchange={(event) =>
            onchange({ settingSendCookies: event.currentTarget.checked })}
        /> Send collection cookies</label
      >
      <label class="checkbox-label"
        ><input
          type="checkbox"
          checked={request.settingStoreCookies !== false}
          onchange={(event) =>
            onchange({ settingStoreCookies: event.currentTarget.checked })}
        /> Store response cookies</label
      >
      <p class="hint">
        The global cookie preference must also be enabled. Browser preview uses
        the browser’s cookie policy.
      </p>
    </div>
  {:else}<textarea
      class="code-editor body-text"
      aria-label="Request documentation"
      value={request.description || ""}
      oninput={(event) => onchange({ description: event.currentTarget.value })}
      placeholder="Document this request in Markdown…"></textarea>{/if}
</section>
