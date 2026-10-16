<script>
  import Field from "./ui/Field.svelte";
  import Checkbox from "./ui/Checkbox.svelte";
  import Textarea from "./ui/Textarea.svelte";
  import Select from "./ui/Select.svelte";
  import Input from "./ui/Input.svelte";
  /** @type {{ authentication: Record<string, any>, onchange: (patch: Record<string, any>) => void, templateEditor?:()=>ReturnType<import('../template-editor-session.svelte.js').createTemplateEditorSession> }} */
  let { authentication: auth, onchange, templateEditor } = $props();
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

<Field
  >Signature method<Select
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
  </Select></Field
>
{#each fields as [key, label, secret]}
  <Field
    >{label}<Input
      {templateEditor}
      type={secret ? "password" : "text"}
      value={auth[String(key)] || ""}
      oninput={(event) =>
        onchange({ [String(key)]: event.currentTarget.value })}
      autocomplete="off"
      spellcheck="false"
    /></Field
  >
{/each}
{#if auth.signatureMethod === "RSA-SHA1"}<Field
    >RSA private key (PEM)<Textarea
      {templateEditor}
      value={auth.privateKey || ""}
      oninput={(event) => onchange({ privateKey: event.currentTarget.value })}
      rows={7}
      autocomplete="off"
      spellcheck="false"
    ></Textarea></Field
  >{/if}
<Field
  >Body signing<Select
    value={auth.bodyMode || "legacy"}
    onchange={(event) => onchange({ bodyMode: event.currentTarget.value })}
  >
    <option value="standard">RFC 5849</option><option value="legacy"
      >Legacy Insomnium</option
    >
    {#if auth.bodyMode && !["standard", "legacy"].includes(auth.bodyMode)}<option
        value={auth.bodyMode}>{auth.bodyMode} (unsupported)</option
      >{/if}
  </Select></Field
>
<Field layout="inline" class="checkbox-label"
  ><Checkbox
    checked={auth.includeBodyHash === true || auth.includeBodyHash === "true"}
    onchange={(event) =>
      onchange({ includeBodyHash: event.currentTarget.checked })}
  />Hash body</Field
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
    support it. A blank Version is omitted unless empty parameters are included
    in the signature. PLAINTEXT sends encoded secrets
    as its signature.
  </p>
{/if}
<Field
  >Parameter destination<Select
    value={[false, "false"].includes(auth.addParamsToHeader) ? "parameters" : "header"}
    onchange={(event) => onchange({ addParamsToHeader: event.currentTarget.value === "header" })}
    ><option value="header">Authorization header</option>
    <option value="parameters">Request body / URL</option></Select
  ></Field
>
{#if [false, "false"].includes(auth.addParamsToHeader)}<p class="hint">
    OAuth parameters are added to URL-encoded POST/PUT bodies, or to the URL
    query for other requests.
  </p>{/if}
<p class="hint">
  OAuth1 signs each native HTTP, GraphQL or stream handshake. Supply existing
  credentials; callback and verifier fields can be used in your own
  token-endpoint requests. No automatic OAuth1 browser/token exchange is
  performed. Credentials stay in local workspace/export data.
</p>
<Field layout="inline" class="checkbox-label"
  ><Checkbox
    checked={[true, "true"].includes(auth.addEmptyParamsToSign)}
    onchange={(event) => onchange({ addEmptyParamsToSign: event.currentTarget.checked })}
  />Include empty OAuth parameters in signature</Field
>
<Field layout="inline" class="checkbox-label"
  ><Checkbox
    checked={![true, "true"].includes(auth.disableHeaderEncoding)}
    onchange={(event) => onchange({ disableHeaderEncoding: !event.currentTarget.checked })}
  />Encode parameters in Authorization header</Field
>
