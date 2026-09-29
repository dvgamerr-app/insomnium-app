<script>
  /** @type {{ authentication: Record<string, any>, onchange: (patch: Record<string, any>) => void }} */
  let { authentication: auth, onchange } = $props();
  const methods = ["HMAC-SHA1", "HMAC-SHA256", "RSA-SHA1", "PLAINTEXT"];
  const fields = [
    ["consumerKey", "Consumer key", false],
    ["consumerSecret", "Consumer secret", true],
    ["tokenKey", "Token key", false],
    ["tokenSecret", "Token secret", true],
    ["callback", "Callback URL", false],
    ["version", "Version", false],
    ["timestamp", "Timestamp (seconds; blank generates)", false],
    ["realm", "Realm", false],
    ["nonce", "Nonce (blank generates)", false],
    ["verifier", "Verifier", false],
  ];
</script>

<label
  >Signature method<select
    value={auth.signatureMethod || ""}
    onchange={(event) =>
      onchange({ signatureMethod: event.currentTarget.value })}
  >
    <option value="" disabled>Choose a method</option
    >{#each methods as method}<option value={method}>{method}</option>{/each}
    {#if auth.signatureMethod && !methods.includes(auth.signatureMethod)}<option
        value={auth.signatureMethod}
        >{auth.signatureMethod} (unsupported)</option
      >{/if}
  </select></label
>
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
{#if auth.signatureMethod === "RSA-SHA1"}<label
    >RSA private key (PEM)<textarea
      value={auth.privateKey || ""}
      oninput={(event) => onchange({ privateKey: event.currentTarget.value })}
      rows="7"
      autocomplete="off"
      spellcheck="false"></textarea></label
  >{/if}
<label
  >Body signing<select
    value={auth.bodyMode || "legacy"}
    onchange={(event) => onchange({ bodyMode: event.currentTarget.value })}
  >
    <option value="standard">RFC 5849</option><option value="legacy"
      >Legacy Insomnium</option
    >
    {#if auth.bodyMode && !["standard", "legacy"].includes(auth.bodyMode)}<option
        value={auth.bodyMode}>{auth.bodyMode} (unsupported)</option
      >{/if}
  </select></label
>
<label class="checkbox-label"
  ><input
    type="checkbox"
    checked={auth.includeBodyHash === true || auth.includeBodyHash === "true"}
    onchange={(event) =>
      onchange({ includeBodyHash: event.currentTarget.checked })}
  />Hash body</label
>
{#if (auth.bodyMode || "legacy") === "legacy"}
  <p class="hint">
    Legacy mode leaves form parameters out of the signature. Hash body
    reproduces the original form-JSON hash, including disabled fields, and
    generates header nonce/time even when overrides are set. Legacy PLAINTEXT
    signs the base string. Ambiguous legacy query encodings require explicit RFC
    mode. Choose RFC 5849 explicitly to use standard signing.
  </p>
{:else}
  <p class="hint">
    Form parameters are signed automatically. Hash body is an optional extension
    for non-form bytes (SHA-1, or SHA-256 with HMAC-SHA256); the server must
    support it. Leave Version blank to omit it. PLAINTEXT sends encoded secrets
    as its signature.
  </p>
{/if}
{#if auth.addParamsToHeader != null && ![true, "true"].includes(auth.addParamsToHeader)}<label
    >Parameter destination<select
      value="unsupported"
      onchange={() => onchange({ addParamsToHeader: true })}
      ><option value="unsupported">Imported URL/body (not migrated)</option
      ><option value="header">Authorization header</option></select
    ></label
  >{/if}
<p class="hint">
  OAuth1 signs each native HTTP, GraphQL or stream handshake. Supply existing
  credentials; callback and verifier fields can be used in your own
  token-endpoint requests. No automatic OAuth1 browser/token exchange is
  performed. Credentials stay in local workspace/export data.
</p>
{#each ["addEmptyParamsToSign", "disableHeaderEncoding"] as key}
  {#if auth[key] != null && ![false, "false"].includes(auth[key])}
    <label class="checkbox-label"
      ><input
        type="checkbox"
        checked
        onchange={() => onchange({ [key]: false })}
      />Imported {key} (unsupported; uncheck to use standard signing)</label
    >
  {/if}
{/each}
