<script>
  import TabPanel from "./ui/TabPanel.svelte";
  let activeTab0 = $state("");
  import Toolbar from "./ui/Toolbar.svelte";
  import Feedback from "./ui/Feedback.svelte";
  import EmptyState from "./ui/EmptyState.svelte";
  import FormPanel from "./ui/FormPanel.svelte";
  import TabList from "./ui/TabList.svelte";
  import TabButton from "./ui/TabButton.svelte";
  import FilePicker from "./ui/FilePicker.svelte";
  import Field from "./ui/Field.svelte";
  import Checkbox from "./ui/Checkbox.svelte";
  import Textarea from "./ui/Textarea.svelte";
  import Select from "./ui/Select.svelte";
  import Button from "./ui/Button.svelte";
  import Input from "./ui/Input.svelte";
  import { onDestroy } from "svelte";
  import { jsonPrettify } from "../json-prettify.js";
  import { environmentFor, workspaceFor } from "../model.js";
  import CodeEditor from "./CodeEditor.svelte";
  import CurlBodyEditor from "./CurlBodyEditor.svelte";
  import {
    workspace as app,
    createWorkspaceWorkScope,
  } from "../workspace.svelte.js";
  import GraphqlEditor from "./GraphqlEditor.svelte";
  import OAuthEditor from "./OAuthEditor.svelte";
  import OAuth1Editor from "./OAuth1Editor.svelte";
  import AwsEditor from "./AwsEditor.svelte";
  import HawkEditor from "./HawkEditor.svelte";
  import AsapEditor from "./AsapEditor.svelte";
  import KeyValueEditor from "./KeyValueEditor.svelte";
  import Icon from "./Icon.svelte";
  import WebSocketMessageEditor from "./WebSocketMessageEditor.svelte";
  import { readCurrentBodyUpload } from "../uploads.js";
  import { isBinaryBody } from "../binary-body.js";
  import { isJsonBodyMediaType } from "../media-type.js";
  /** @type {{ request: Record<string, any>, onchange: (patch: Record<string, any>) => void }} */
  let { request, onchange } = $props();
  let tab = $state("Body");
  const binaryBody = $derived(isBinaryBody(request.body));
  const headerRows = $derived([
    ...(request.headers || []),
    ...(Array.isArray(request.cookieParameters)
      ? request.cookieParameters
      : []),
  ]);
  let error = $state("");
  const fileWork = createWorkspaceWorkScope();
  let fileSelection = 0;
  onDestroy(() => {
    fileSelection++;
    fileWork.dispose();
  });
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
    /** @type {import("../workspace.svelte.js").ScopedWorkspaceWork|undefined} */ let work;
    /** @type {Worker | undefined} */ let worker;
    /** @type {ReturnType<typeof setTimeout> | undefined} */ let timer;
    const current = () =>
      (!work || work.current()) &&
      request._id === requestId &&
      String(request.body?.text || "") === source &&
      request.body?.mimeType === mime &&
      tab === "Body";
    cancelFormat = () => {
      active = false;
      clearTimeout(timer);
      worker?.terminate();
      work?.signal.removeEventListener("abort", cancelFormat);
      work?.finish();
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
      work = fileWork.begin();
      work.signal.addEventListener("abort", cancelFormat, { once: true });
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

<TabList
  panelId="request-editor-panel"
  bind:activeId={activeTab0}
  class="editor-tabs"
  role="tablist"
  aria-label="Request editor"
>
  {#each ["Body", "Auth", "Query", "Headers", "Docs", "Settings"] as name}
    <TabButton
      role="tab"
      aria-selected={tab === name}
      onclick={() => (tab = name)}
      >{name === "Body" && request._type === "websocket_request"
        ? "Message"
        : name}
      {#if name === "Headers" && headerRows.length}<span class="count"
          >{headerRows.filter((/** @type {any} */ h) => !h.disabled)
            .length}</span
        >{/if}
      {#if name === "Query" && request.parameters?.length}<span class="count"
          >{request.parameters.filter((/** @type {any} */ h) => !h.disabled)
            .length}</span
        >{/if}
    </TabButton>
  {/each}
</TabList>
<TabPanel id="request-editor-panel" labelledBy={activeTab0}
  ><section class="request-editor" aria-label={`${tab} editor`}>
    {#if tab === "Body" && request._type === "websocket_request"}
      <WebSocketMessageEditor {request} />
    {:else if tab === "Body"}
      <Toolbar variant="editor" class="editor-toolbar">
        <Select
          aria-label="Body type"
          value={binaryBody
            ? "application/octet-stream"
            : request.body?.mimeType || ""}
          onchange={(event) =>
            body({
              mimeType: event.currentTarget.value,
              binary: undefined,
              _openapiSerialization: undefined,
              ...(request.body?.curlFileMode || request.body?.curlSegments
                ? {
                    curlFileMode: undefined,
                    curlSegments: undefined,
                    curlJoin: undefined,
                    curlQuery: undefined,
                    curlFilePrefix: undefined,
                    base64: undefined,
                    fileName: undefined,
                  }
                : {}),
              ...(event.currentTarget.value === "application/graphql"
                ? { text: JSON.stringify({ query: "", variables: "{}" }) }
                : {}),
            })}
          >{#each mimeTypes as [value, label]}<option {value}>{label}</option
            >{/each}{#if request.body?.mimeType && !mimeTypes.some(([value]) => value === request.body.mimeType)}<option
              value={request.body.mimeType}>{request.body.mimeType}</option
            >{/if}</Select
        ><span class="spacer"
        ></span>{#if !binaryBody && isJsonBodyMediaType(request.body?.mimeType)}<Button
            variant="ghost"
            class="text-button"
            onclick={format}><Icon name="code" size={14} /> Format JSON</Button
          >{:else if !binaryBody && xmlBody}<Button
            variant="ghost"
            class="text-button"
            disabled={formatting}
            onclick={formatXml}
            ><Icon name="code" size={14} />{formatting
              ? "Formatting…"
              : "Format XML"}</Button
          >{/if}
      </Toolbar>
      {#if error}<Feedback as="p" class="inline-error">{error}</Feedback>{/if}
      {#if !request.body?.mimeType}<EmptyState
          variant="body"
          class="empty-body"
        >
          <Icon name="code" size={32} />
          <p>This request has no body</p>
          <span>Choose a body type above to add one.</span>
        </EmptyState>
      {:else if binaryBody}
        {#if request.body.mimeType !== "application/octet-stream"}<Feedback
            tone="hint"
            density="compact">Content-Type: {request.body.mimeType}</Feedback
          >{/if}
        {#if request.body.curlSegments}
          {#key request._id}<CurlBodyEditor {request} onchange={body} />{/key}
        {:else}
          {#if request.body.curlFileMode}<p class="hint">
              Select the file referenced by the imported command. {[
                "data",
                "data-ascii",
              ].includes(request.body.curlFileMode)
                ? "CR, LF and NUL bytes are removed."
                : request.body.curlFileMode === "data-urlencode"
                  ? "File bytes are URL-encoded."
                  : "File bytes are preserved."}
            </p>{/if}
          <FilePicker
            class="binary-picker"
            variant="dropzone"
            onchange={async (event) => {
              const file = event.currentTarget.files?.[0];
              if (file) {
                const requestId = request._id;
                const originalBody = request.body;
                const selection = ++fileSelection;
                /** @type {import("../workspace.svelte.js").ScopedWorkspaceWork|undefined} */ let work;
                const current = () =>
                  selection === fileSelection && (!work || work.current());
                try {
                  work = fileWork.begin();
                  const upload = await readCurrentBodyUpload(
                    requestId,
                    originalBody,
                    () => request,
                    current,
                    file,
                  );
                  if (
                    !current() ||
                    request._id !== requestId ||
                    request.body !== originalBody
                  )
                    return;
                  body(upload);
                  error = "";
                } catch (e) {
                  if (
                    current() &&
                    request._id === requestId &&
                    request.body === originalBody
                  )
                    error = String(e);
                } finally {
                  work?.finish();
                }
              }
            }}
            ><Icon name="upload" />{request.body.fileName ||
              "Select a file to send"}</FilePicker
          >
        {/if}
      {:else if request.body.mimeType === "application/graphql" && request.body._openapiSerialization?.style !== "serialized"}
        {#key request._id}<GraphqlEditor {request} onchange={body} />{/key}
      {:else if ["application/x-www-form-urlencoded", "multipart/form-data"].includes(request.body.mimeType) && request.body._openapiSerialization?.style !== "serialized"}<KeyValueEditor
          rows={request.body.params || []}
          label="Parameter"
          files={request.body.mimeType === "multipart/form-data"}
          onchange={(params) => body({ params })}
        />
      {:else}{#if request.body._openapiSerialization?.style === "serialized"}<Feedback
            density="compact"
            tone="hint"
            >Already serialized body; sent as written using {request.body
              .mimeType}.</Feedback
          >{/if}<CodeEditor
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
        />{/if}
    {:else if tab === "Headers"}<KeyValueEditor
        rows={request.headers || []}
        onchange={(headers) => onchange({ headers })}
      />
      {#if Array.isArray(request.cookieParameters)}<div
          role="group"
          aria-label="Cookie parameters"
        >
          <p class="hint padded">Cookie parameters</p>
          <KeyValueEditor
            rows={request.cookieParameters}
            label="Cookie"
            onchange={(cookieParameters) => onchange({ cookieParameters })}
          />
          <p class="hint padded">
            These cookies are sent with explicit Cookie headers and take
            precedence over collection cookies.
          </p>
        </div>{/if}
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
      <FormPanel class="form-panel">
        <Field
          >Authentication<Select
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
            ><option value="netrc">Netrc</option><option value="asap"
              >ASAP</option
            >{#if request.authentication?.type && !["basic", "bearer", "apikey", "digest", "oauth2", "oauth1", "iam", "hawk", "asap", "ntlm", "netrc"].includes(request.authentication.type)}<option
                value={request.authentication.type}
                >{request.authentication.type} (migration pending)</option
              >{/if}</Select
          ></Field
        >
        {#if request.authentication?.type}<Field
            layout="inline"
            class="checkbox-label"
            ><Checkbox
              checked={!request.authentication.disabled}
              onchange={(event) =>
                auth({ disabled: !event.currentTarget.checked })}
            />Enable authentication</Field
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
            Reads .netrc from HOME (USERPROFILE on Windows if HOME is unset),
            with _netrc fallback on Windows. Credentials stay in the desktop
            process. Each redirect looks up its destination hostname; a default
            entry can apply to any host. Disable authentication to stop lookup.
          </p>
        {:else if ["basic", "digest", "ntlm"].includes(request.authentication?.type)}<Field
            >Username<Input
              autocomplete="off"
              value={request.authentication.username || ""}
              oninput={(event) => auth({ username: event.currentTarget.value })}
            /></Field
          ><Field
            >Password<Input
              type="password"
              autocomplete="off"
              value={request.authentication.password || ""}
              oninput={(event) => auth({ password: event.currentTarget.value })}
            /></Field
          >
          {#if request.authentication.type === "ntlm"}
            <Field
              >Domain (optional)<Input
                value={request.authentication.domain || ""}
                oninput={(event) => auth({ domain: event.currentTarget.value })}
                autocomplete="off"
              /></Field
            >
            <Field
              >Workstation (Type 1 negotiation only)<Input
                value={request.authentication.workstation || ""}
                oninput={(event) =>
                  auth({ workstation: event.currentTarget.value })}
                autocomplete="off"
              /></Field
            >
            <p class="hint">
              Uses explicit NTLMv2 credentials over HTTP/1.1. Username can
              include a domain. TLS channel binding is automatic. Workstation is
              sent only in the negotiate message; Type 3 workstation parity is
              pending. Credentials apply only to the original origin; a
              connection closed during the challenge stops authentication.
            </p>
          {/if}
          {#if request.authentication.type === "basic"}
            <Field layout="inline" class="checkbox-label"
              ><Checkbox
                checked={request.authentication.useISO88591 === true ||
                  request.authentication.useISO88591 === "true"}
                onchange={(event) =>
                  auth({ useISO88591: event.currentTarget.checked })}
              />Use ISO 8859-1 (Latin-1)</Field
            >
            <p class="hint">
              Default is UTF-8. Latin-1 matches the original conversion;
              characters outside its range are truncated to their low byte.
            </p>
          {/if}
        {:else if request.authentication?.type === "bearer"}<Field
            >Token<Input
              type="password"
              autocomplete="off"
              value={request.authentication.token || ""}
              oninput={(event) => auth({ token: event.currentTarget.value })}
              placeholder={"{{ _.access_token }}"}
            /></Field
          >
          <Field
            >Header prefix<Input
              value={request.authentication.prefix || ""}
              placeholder="Bearer"
              oninput={(event) => auth({ prefix: event.currentTarget.value })}
            /></Field
          >
        {:else if request.authentication?.type === "apikey"}<Field
            >Key<Input
              value={request.authentication.key || ""}
              oninput={(event) => auth({ key: event.currentTarget.value })}
            /></Field
          ><Field
            >Value<Input
              type="password"
              value={request.authentication.value || ""}
              oninput={(event) => auth({ value: event.currentTarget.value })}
            /></Field
          ><Field
            >Add to<Select
              value={request.authentication.addTo || "header"}
              onchange={(event) => auth({ addTo: event.currentTarget.value })}
              ><option value="header">Header</option><option value="queryParams"
                >Query</option
              ><option value="cookie">Cookie</option>
              {#if request.authentication.addTo && !["header", "queryParams", "cookie"].includes(request.authentication.addTo)}<option
                  value={request.authentication.addTo}
                  >{request.authentication.addTo} (unsupported)</option
                >{/if}
            </Select></Field
          >
          {#if request.authentication.addTo === "cookie"}<p class="hint">
              Adds a Cookie header alongside manual cookie pairs. It takes
              precedence over collection cookies, is not saved to the cookie
              jar, and requires the desktop app.
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
            Digest uses the server challenge in the desktop app. Credentials
            apply only to the original origin.
          </p>{/if}
      </FormPanel>
    {:else if tab === "Settings"}
      <FormPanel class="form-panel">
        {#if request._openapiIssues?.length}<Feedback
            as="div"
            class="inline-error"
          >
            <p>This generated request needs manual corrections:</p>
            <ul>
              {#each request._openapiIssues as issue}<li>{issue}</li>{/each}
            </ul>
            <Button
              variant="secondary"
              class="secondary-button"
              onclick={() =>
                onchange({
                  _openapiIssues: [],
                  _openapiReviewedAt: Date.now(),
                })}>I have corrected these request fields</Button
            >
          </Feedback>{/if}
        <Field layout="inline" class="checkbox-label"
          ><Checkbox
            checked={request.settingEncodeUrl ?? !request._curlSource}
            onchange={(event) =>
              onchange({ settingEncodeUrl: event.currentTarget.checked })}
          /> Automatically encode URL</Field
        >
        <Field
          >Redirects<Select
            value={request.settingFollowRedirects || "global"}
            onchange={(event) =>
              onchange({ settingFollowRedirects: event.currentTarget.value })}
          >
            <option value="global">Use global preference</option><option
              value="on">Follow redirects</option
            ><option value="off">Do not follow redirects</option>
          </Select></Field
        >
        <Field layout="inline" class="checkbox-label"
          ><Checkbox
            checked={request.settingSendCookies !== false}
            onchange={(event) =>
              onchange({ settingSendCookies: event.currentTarget.checked })}
          /> Send collection cookies</Field
        >
        <Field layout="inline" class="checkbox-label"
          ><Checkbox
            checked={request.settingStoreCookies !== false}
            onchange={(event) =>
              onchange({ settingStoreCookies: event.currentTarget.checked })}
          /> Store response cookies</Field
        >
        <p class="hint">
          The global cookie preference must also be enabled. Browser preview
          uses the browser’s cookie policy.
        </p>
      </FormPanel>
    {:else}<Textarea
        class="code-editor body-text"
        aria-label="Request documentation"
        value={request.description || ""}
        oninput={(event) =>
          onchange({ description: event.currentTarget.value })}
        placeholder="Document this request in Markdown…"
      ></Textarea>{/if}
  </section></TabPanel
>
