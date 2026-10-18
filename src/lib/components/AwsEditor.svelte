<script>
  import Field from "./ui/Field.svelte";
  import Input from "./ui/Input.svelte";
  import Checkbox from "./ui/Checkbox.svelte";
  /** @type {{ authentication: Record<string, any>, onchange: (patch: Record<string, any>) => void, templateEditor?:()=>ReturnType<import('../template-editor-session.svelte.js').createTemplateEditorSession> }} */
  let { authentication: auth, onchange, templateEditor } = $props();
  const fields = [
    ["accessKeyId", "Access key ID", false],
    ["secretAccessKey", "Secret access key", true],
    ["region", "Region (blank infers from Host; defaults to us-east-1)", false],
    ["service", "Service (blank infers from AWS Host)", false],
    ["sessionToken", "Session token (optional)", true],
  ];
</script>

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
<Field layout="inline">
  <Checkbox
    checked={[true, "true"].includes(auth.addAuthDataToQuery)}
    onchange={(event) =>
      onchange({ addAuthDataToQuery: event.currentTarget.checked })}
  />
  Add authentication to query
</Field>
{#if [true, "true"].includes(auth.addAuthDataToQuery)}
  <Field
    >URL expiry (seconds, 1–604800)<Input
      {templateEditor}
      value={String(auth.expiresIn ?? 900)}
      inputmode="numeric"
      oninput={(event) => onchange({ expiresIn: event.currentTarget.value })}
    /></Field
  >
  <p class="hint">
    S3 query signing uses an unsigned payload. Other services sign the body sent
    by the desktop app.
  </p>
{/if}
<p class="hint">
  AWS Signature V4 runs in the desktop app. Set service and region explicitly
  for custom, dualstack or FIPS endpoints. A manual Host is used for signing and
  endpoint inference. Credentials are sent only to the original origin.
</p>
<p class="hint">
  When enabled, AWS replaces Authorization, X-Amz-Date, X-Amz-Security-Token and
  X-Amz-Content-Sha256. Disable it to send your own signature or a presigned
  URL.
</p>
