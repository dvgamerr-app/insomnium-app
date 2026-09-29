<script>
  /** @type {{ authentication: Record<string, any>, onchange: (patch: Record<string, any>) => void }} */
  let { authentication: auth, onchange } = $props();
  const fields = [
    ["accessKeyId", "Access key ID", false],
    ["secretAccessKey", "Secret access key", true],
    ["region", "Region (blank infers from Host; defaults to us-east-1)", false],
    ["service", "Service (blank infers from AWS Host)", false],
    ["sessionToken", "Session token (optional)", true],
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
{#if auth.addAuthDataToQuery != null && ![false, "false"].includes(auth.addAuthDataToQuery)}
  <p class="hint">
    This import uses AWS query signing, which is not available yet.
  </p>
  <button onclick={() => onchange({ addAuthDataToQuery: false })}
    >Use signed headers</button
  >
{/if}
<p class="hint">
  AWS Signature V4 signs the body sent by the desktop app. Set service and
  region explicitly for custom, dualstack or FIPS endpoints. A manual Host is
  used for signing and endpoint inference. Credentials are sent only to the
  original origin.
</p>
<p class="hint">
  When enabled, AWS replaces Authorization, X-Amz-Date, X-Amz-Security-Token and
  X-Amz-Content-Sha256. Disable it to send your own signature or a presigned
  URL.
</p>
