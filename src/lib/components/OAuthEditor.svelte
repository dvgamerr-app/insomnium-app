<script>
  import { onMount } from "svelte";
  import { requestDataScope } from "../request-scope.js";
  import { renderOAuthRequest } from "../request-render.js";
  import {
    workspace,
    authorizeOAuth,
    stop,
    useSavedOAuth,
    clearOAuth,
    completeOAuth,
    resetOAuthBrowserSession,
  } from "../workspace.svelte.js";
  import {
    currentOAuthToken,
    savedOAuthTokens,
    tokenExpired,
    tokenGrants,
  } from "../oauth-model.js";
  /** @type {{ request: Record<string, any>, onchange: (patch: Record<string, any>) => void }} */
  let { request, onchange } = $props();
  let selected = $state("");
  let show = $state(false);
  let callbackUrl = $state("");
  let now = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => {
      now = Date.now();
    }, 1000);
    return () => clearInterval(timer);
  });
  let auth = $derived(request.authentication || {});
  let running = $derived(!!workspace.running[request._id]);
  let progress = $derived(workspace.oauthProgress[request._id]);
  $effect(() => {
    void request._id;
    void progress?.id;
    callbackUrl = "";
  });
  $effect(() => {
    void request._id;
    show = false;
  });
  let tokens = $derived(savedOAuthTokens(workspace.data, request._id));
  let status = $state(
    /** @type {{token:Record<string,any>|null,error:string,pending:boolean}} */ ({
      token: null,
      error: "",
      pending: false,
    }),
  );
  $effect(() => {
    const dataSnapshot = $state.snapshot(workspace.data);
    const snapshot = $state.snapshot(request);
    const controller = new AbortController();
    status = { token: null, error: "", pending: true };
    const timer = setTimeout(async () => {
      try {
        const data = requestDataScope(dataSnapshot, snapshot._id);
        const rendered = await renderOAuthRequest(
          data,
          snapshot,
          controller.signal,
          { purpose: "preview" },
        );
        const token = currentOAuthToken(data, rendered, { resolved: true });
        if (!controller.signal.aborted)
          status = { token, error: "", pending: false };
      } catch (error) {
        if (!controller.signal.aborted)
          status = { token: null, error: String(error), pending: false };
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  });
  let saved = $derived(tokens.find((token) => token._id === selected));
  let expired = $derived(
    status.token ? tokenExpired(status.token, now) : false,
  );
  let manual = $derived(!!auth.accessToken);
  let supported = $derived(tokenGrants.includes(auth.grantType));
  const fields = [
    ["accessTokenUrl", "Access token URL", false],
    ["clientId", "Client ID", false],
    ["clientSecret", "Client secret", true],
    ["scope", "Scope", false],
  ];
  function change(/** @type {string} */ key, /** @type {any} */ value) {
    onchange({ [key]: value });
  }
  function date(/** @type {any} */ value) {
    return value == null
      ? "No expiry supplied"
      : Number.isFinite(value) && value >= 0 && value <= 8.64e15
        ? new Date(value).toLocaleString()
        : "Invalid expiry";
  }
</script>

<label
  >Grant type<select
    value={auth.grantType || ""}
    onchange={(event) => change("grantType", event.currentTarget.value)}
  >
    <option value="" disabled>Choose a grant</option>
    <option value="authorization_code">Authorization Code / PKCE</option>
    <option value="implicit">Implicit (legacy)</option>
    <option value="client_credentials">Client Credentials</option>
    <option value="password">Password (legacy)</option>
    <option value="refresh_token">Refresh Token</option>
    {#if auth.grantType && !supported}<option value={auth.grantType}
        >{auth.grantType} (migration pending)</option
      >{/if}
  </select></label
>
{#if ["authorization_code", "implicit"].includes(auth.grantType)}
  <label
    >Login browser<select
      value={auth.browserMode || "system"}
      onchange={(event) => change("browserMode", event.currentTarget.value)}
    >
      <option value="system">System browser</option><option value="embedded"
        >Login window (legacy compatibility)</option
      >
      {#if auth.browserMode && !["system", "embedded"].includes(auth.browserMode)}<option
          value={auth.browserMode}>{auth.browserMode} (unsupported)</option
        >{/if}
    </select></label
  >
  <label
    >Authorization URL<input
      value={auth.authorizationUrl || ""}
      oninput={(event) => change("authorizationUrl", event.currentTarget.value)}
      autocomplete="off"
      spellcheck="false"
    /></label
  >
  <label
    >Redirect URL<input
      value={auth.redirectUrl || ""}
      oninput={(event) => change("redirectUrl", event.currentTarget.value)}
      placeholder={auth.browserMode === "embedded"
        ? "Registered callback URL (required)"
        : "Automatic loopback (available port)"}
      autocomplete="off"
      spellcheck="false"
    /></label
  >
  {#if auth.browserMode !== "embedded"}
    <label
      >Receive callback<select
        value={auth.callbackMode || "auto"}
        onchange={(event) => change("callbackMode", event.currentTarget.value)}
        ><option value="auto">Automatic for loopback URLs</option><option
          value="manual">Paste callback URL manually</option
        ></select
      ></label
    >
    <p class="hint">
      Register the redirect with your provider. A blank URL uses a free loopback
      port; enter a fixed loopback URL if required. Remote URLs and custom
      schemes use manual paste. Login opens in your system browser and uses that
      browser’s session.
    </p>
  {:else}
    <p class="hint">
      The login window captures the registered callback automatically, including
      remote URLs and custom schemes. Some providers require the system browser.
      Popup-based login must use the system browser.
    </p>
    <p class="hint">
      Login windows share a separate saved browser session. Their browser
      settings and certificate validation are separate from API request
      settings.
    </p>
    <button
      class="secondary-button"
      disabled={running ||
        Object.values(workspace.oauthProgress).some(
          (value) => value.mode === "embedded",
        )}
      onclick={() => resetOAuthBrowserSession()}
      >Start fresh login session</button
    >
  {/if}
  {#if auth.grantType === "authorization_code"}
    <label class="checkbox-label"
      ><input
        type="checkbox"
        checked={auth.usePkce !== false}
        onchange={(event) => change("usePkce", event.currentTarget.checked)}
      />Use PKCE</label
    >
    {#if auth.usePkce !== false}<label
        >PKCE method<select
          value={auth.pkceMethod || "S256"}
          onchange={(event) => change("pkceMethod", event.currentTarget.value)}
          ><option value="S256">S256</option><option value="plain"
            >Plain (legacy)</option
          >{#if auth.pkceMethod && !["S256", "plain"].includes(auth.pkceMethod)}<option
              value={auth.pkceMethod}>{auth.pkceMethod} (unsupported)</option
            >{/if}</select
        ></label
      >{/if}
  {/if}
  {#if auth.grantType === "implicit"}
    <label
      >Response type<select
        value={auth.responseType || "token"}
        onchange={(event) => change("responseType", event.currentTarget.value)}
      >
        <option value="token">token</option><option value="id_token"
          >id_token</option
        ><option value="id_token token">id_token token</option><option
          value="none">none (no API token)</option
        >
        {#if auth.responseType && !["token", "id_token", "id_token token", "none"].includes(auth.responseType)}<option
            value={auth.responseType}>{auth.responseType}</option
          >{/if}
      </select></label
    >
    <label class="checkbox-label"
      ><input
        type="checkbox"
        checked={auth.useIdentityToken === true}
        onchange={(event) =>
          change("useIdentityToken", event.currentTarget.checked)}
      />Use ID token as API credential</label
    >
    <p class="hint">
      ID tokens are retained separately. Selecting this option sends the ID
      token to the API. State and nonce are checked; JWT signatures and identity
      claims are not verified. This does not sign you into Insomnium.
    </p>
    <p class="hint">
      The token endpoint is optional for Implicit and is needed only to refresh
      a token. Automatic loopback callbacks receive the fragment through a local
      browser page; for token responses, manual paste must include the full URL
      with #fragment.
    </p>
  {/if}
  <details>
    <summary>Authorization response options</summary>
    <label
      >State<input
        value={auth.state || ""}
        placeholder="Generate randomly for each login"
        oninput={(event) => change("state", event.currentTarget.value)}
        autocomplete="off"
      /></label
    >
    <label
      >Expected issuer (optional)<input
        value={auth.issuer || ""}
        oninput={(event) => change("issuer", event.currentTarget.value)}
      /></label
    >
    <p class="hint">
      An expected issuer requires an exact matching iss parameter in the
      callback.
    </p>
    {#if auth.grantType === "authorization_code" && auth.responseType && auth.responseType !== "code"}<label
        >Response type<select
          value={auth.responseType}
          onchange={(event) =>
            change("responseType", event.currentTarget.value)}
          ><option value={auth.responseType}
            >{auth.responseType} (incompatible with Authorization Code)</option
          ><option value="code">code</option></select
        ></label
      >{/if}
  </details>
{/if}
{#each fields as [key, label, secret]}
  <label
    >{label}<input
      type={secret ? "password" : "text"}
      value={auth[String(key)] || ""}
      oninput={(event) => change(String(key), event.currentTarget.value)}
      autocomplete="off"
      spellcheck="false"
    /></label
  >
{/each}
{#if auth.grantType === "password"}
  <label
    >Username<input
      value={auth.username || ""}
      oninput={(event) => change("username", event.currentTarget.value)}
      autocomplete="off"
    /></label
  >
  <label
    >Password<input
      type="password"
      value={auth.password || ""}
      oninput={(event) => change("password", event.currentTarget.value)}
      autocomplete="off"
    /></label
  >
{/if}
<label
  >Client authentication<select
    value={auth.credentialsInBody === true ? "body" : "header"}
    onchange={(event) =>
      change("credentialsInBody", event.currentTarget.value === "body")}
  >
    <option value="header">Basic header</option><option value="body"
      >Credentials in request body</option
    >
  </select></label
>
<details>
  <summary>More OAuth options</summary>
  {#if auth.addTokenTo && auth.addTokenTo !== "header"}
    <label
      >Token destination<select
        value={auth.addTokenTo}
        onchange={(event) => change("addTokenTo", event.currentTarget.value)}
        ><option value={auth.addTokenTo}
          >{auth.addTokenTo} (migration pending)</option
        ><option value="header">Header</option></select
      ></label
    >
  {/if}
  {#if auth.tokenType && String(auth.tokenType).toLowerCase() !== "bearer"}
    <label
      >Token type<select
        value={auth.tokenType}
        onchange={(event) => change("tokenType", event.currentTarget.value)}
        ><option value={auth.tokenType}
          >{auth.tokenType} (migration pending)</option
        ><option value="bearer">Bearer</option></select
      ></label
    >
  {/if}
  <label
    >Audience<input
      value={auth.audience || ""}
      oninput={(event) => change("audience", event.currentTarget.value)}
    /></label
  >
  <label
    >Resource<input
      value={auth.resource || ""}
      oninput={(event) => change("resource", event.currentTarget.value)}
    /></label
  >
  <label
    >Origin header<input
      value={auth.origin || ""}
      oninput={(event) => change("origin", event.currentTarget.value)}
    /></label
  >
  <label
    >Token prefix (NO_PREFIX sends only the token)<input
      value={auth.tokenPrefix ?? auth.headerPrefix ?? ""}
      placeholder="Bearer"
      oninput={(event) => change("tokenPrefix", event.currentTarget.value)}
    /></label
  >
  <label
    >Initial refresh token<input
      type="password"
      value={auth.refreshToken || ""}
      oninput={(event) => change("refreshToken", event.currentTarget.value)}
      autocomplete="off"
    /></label
  >
  <label
    >Manual access token override<input
      type="password"
      value={auth.accessToken || ""}
      oninput={(event) => change("accessToken", event.currentTarget.value)}
      autocomplete="off"
    /></label
  >
  <p class="hint">
    A manual access token overrides automatic fetching and has no tracked
    expiry. Clear it to use saved tokens.
  </p>
</details>
{#if !supported && !manual}<p class="hint">
    This OAuth grant is not migrated yet. Imported settings are retained. You
    can review a saved access token below.
  </p>{/if}
{#if auth.grantType === "password"}<p class="hint">
    Password grant is retained for existing APIs. Prefer Authorization Code with
    PKCE for interactive login.
  </p>{/if}

<div class="oauth-token-panel">
  {#if progress}
    <div role="status">
      {#if progress.warning}<p class="inline-error">{progress.warning}</p>{/if}
      <strong
        >{progress.stage === "waiting"
          ? "Waiting for browser authorization"
          : "Exchanging authorization code"}</strong
      >
      {#if progress.stage === "waiting"}
        <p class="hint">
          Time remaining: {Math.max(
            0,
            Math.ceil((progress.expiresAt - now) / 1000),
          )} seconds.
        </p>
        <label
          >Redirect URI for this login<input
            readonly
            value={progress.redirectUrl}
          /></label
        >
        <label
          >Final callback URL<input
            bind:value={callbackUrl}
            placeholder="Paste the complete URL after authorization"
            autocomplete="off"
            spellcheck="false"
          /></label
        >
        <button
          class="secondary-button"
          disabled={!callbackUrl.trim()}
          onclick={async () => {
            if (await completeOAuth(request._id, callbackUrl)) callbackUrl = "";
          }}>Use callback URL</button
        >
        <p class="hint">
          {progress.mode === "embedded"
            ? "Complete login in the Insomnium login window. The matching callback is captured automatically; manual paste is also available."
            : progress.mode === "manual"
              ? "After login, copy the final redirect URL from the browser and paste it here."
              : "The loopback callback is detected automatically. Manual paste is also available."}
        </p>
      {/if}
    </div>
  {/if}
  <strong
    >{manual
      ? "Using manual access token"
      : status.pending
        ? "Checking token…"
        : status.token
          ? expired
            ? "API token expired"
            : "API token ready"
          : "No token for current settings"}</strong
  >
  {#if status.token && !manual}
    {#if status.token.credentialKind === "id_token"}<span class="hint"
        >Using ID token as API credential (identity not verified).</span
      >{/if}
    <span class="hint">Expires: {date(status.token.expiresAt)}</span>
    {#if status.token.scope}<span class="hint">Scope: {status.token.scope}</span
      >{/if}
    <label
      >{status.token.credentialKind === "id_token"
        ? "ID token"
        : "Access token"}<input
        type={show ? "text" : "password"}
        value={status.token.accessToken}
        readonly
        autocomplete="off"
      /></label
    >
    <label class="checkbox-label"
      ><input type="checkbox" bind:checked={show} />Show token</label
    >
  {/if}
  <div class="oauth-actions">
    {#if running}<button
        class="secondary-button"
        onclick={() => stop(request._id)}>Cancel</button
      >
    {:else}
      <button
        class="primary-button"
        disabled={auth.disabled || manual || !supported}
        onclick={() => authorizeOAuth(request._id)}
        >{["authorization_code", "implicit"].includes(auth.grantType)
          ? "Authorize"
          : "Fetch token"}</button
      >
      <button
        class="secondary-button"
        disabled={auth.disabled ||
          manual ||
          !(
            status.token?.refreshToken ||
            auth.refreshToken ||
            tokens.some(
              (token) =>
                token._oauthVersion === 1 &&
                !token._oauthImported &&
                token.refreshToken,
            )
          )}
        onclick={() => authorizeOAuth(request._id, "refresh")}
        >Refresh token</button
      >
      <button
        class="secondary-button"
        disabled={!tokens.some(
          (token) => token._oauthVersion === 1 && !token._oauthImported,
        )}
        onclick={() => clearOAuth(request._id)}>Clear active token</button
      >
    {/if}
  </div>
  <p class="hint">
    Send fetches or refreshes automatically when needed. Tokens stay in local
    workspace storage and are included in exports. Token responses do not appear
    in request history.
  </p>
</div>
{#if tokens.some((token) => token._id !== status.token?._id)}
  <details>
    <summary>Review saved or imported tokens</summary>
    <label
      >Saved token<select
        value={selected}
        onchange={(event) => {
          selected = event.currentTarget.value;
        }}
      >
        <option value="">Select a token</option>
        {#each tokens.filter((token) => token._id !== status.token?._id) as token}<option
            value={token._id}
            >{token._oauthVersion === 1 && !token._oauthImported
              ? "Previous settings"
              : "Imported"} · {date(token.expiresAt)}</option
          >{/each}
      </select></label
    >
    {#if saved}
      {#if saved.credentialKind === "id_token"}<p class="hint">
          This saved credential is an ID token; explicit ID-token use must be
          enabled before sending.
        </p>{/if}
      <p class="hint">
        Expiry: {date(saved.expiresAt)}. Scope: {saved.scope || "not recorded"}.
        Refresh token: {saved.refreshToken ? "available" : "not available"}.
      </p>
      <p class="hint">
        Check the request URL, provider and client credentials before binding
        this token to the current settings. The source record is retained.
      </p>
      <button
        class="secondary-button"
        disabled={running || auth.disabled || manual}
        onclick={async () => {
          if (await useSavedOAuth(request._id, saved._id)) selected = "";
        }}>Use with current settings</button
      >
    {/if}
  </details>
{/if}
{#if status.error}<p class="inline-error">{status.error}</p>{/if}
{#if workspace.oauthErrors[request._id]}<p class="inline-error" role="alert">
    {workspace.oauthErrors[request._id]}
  </p>{/if}

<style>
  .oauth-token-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-top: 1px solid var(--line);
    padding-top: 16px;
  }
  .oauth-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .hint {
    overflow-wrap: anywhere;
  }
</style>
