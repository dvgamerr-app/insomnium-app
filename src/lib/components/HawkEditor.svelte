<script>
  /** @type {{ authentication: Record<string, any>, onchange: (patch: Record<string, any>) => void }} */
  let { authentication: auth, onchange } = $props();
  const fields = [
    ["id", "Auth ID", false],
    ["key", "Auth key", true],
    ["ext", "Ext", false],
    ["nonce", "Nonce (blank generates)", false],
    ["timestamp", "Timestamp (seconds; blank generates)", false],
    ["app", "Application ID (optional)", false],
    ["dlg", "Delegation (requires application ID)", false],
  ];
</script>

{#each fields as [key, label, secret]}
  <label
    >{label}<input
      type={secret ? "password" : "text"}
      value={auth[String(key)] || ""}
      oninput={(event) =>
        onchange({ [String(key)]: event.currentTarget.value })}
      autocomplete="off"
      spellcheck="false"
    /></label
  >
{/each}
<label
  >Algorithm<select
    value={auth.algorithm || ""}
    onchange={(event) => onchange({ algorithm: event.currentTarget.value })}
  >
    <option value="" disabled>Choose an algorithm</option>
    <option value="sha256">SHA256</option><option value="sha1">SHA1</option>
    {#if auth.algorithm && !["sha1", "sha256"].includes(auth.algorithm)}<option
        value={auth.algorithm}>{auth.algorithm} (unsupported)</option
      >{/if}
  </select></label
>
<label class="checkbox-label"
  ><input
    type="checkbox"
    checked={auth.validatePayload === true || auth.validatePayload === "true"}
    onchange={(event) =>
      onchange({ validatePayload: event.currentTarget.checked })}
  />Validate payload</label
>
<label
  >Signing mode<select
    value={auth.bodyMode || "legacy"}
    onchange={(event) => onchange({ bodyMode: event.currentTarget.value })}
  >
    <option value="standard">Actual request body and Host</option>
    <option value="legacy">Insomnium legacy text and URL host</option>
    <option value="postman">Postman payload and URL host</option>
    {#if auth.bodyMode && !["legacy", "standard", "postman"].includes(auth.bodyMode)}<option
        value={auth.bodyMode}>{auth.bodyMode} (unsupported)</option
      >{/if}
  </select></label
>
<p class="hint">
  Legacy mode hashes saved body text and its MIME type; absent text has no
  payload hash. Actual request mode hashes the bytes sent, including multipart
  and binary, and uses a manual Host if set. Postman mode uses the explicit
  Content-Type header and omits hashes for empty or multipart bodies.
</p>
<p class="hint">
  Manual Authorization takes precedence. Hawk signatures apply only to the
  original origin. Payload validation adds a request hash; it does not validate
  the server response.
</p>
