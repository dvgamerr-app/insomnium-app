<script>
  /** @type {{ authentication: Record<string, any>, onchange: (patch: Record<string, any>) => void }} */
  let { authentication: auth, onchange } = $props();
  const algorithms = [
    "RS256",
    "RS384",
    "RS512",
    "PS256",
    "PS384",
    "PS512",
    "ES256",
    "ES384",
    "ES512",
  ];
  const fields = [
    ["issuer", "Issuer (iss)"],
    ["subject", "Subject (blank uses issuer)"],
    ["keyId", "Key ID (kid; blank uses data URI kid)"],
  ];
</script>

{#each fields as [key, label]}
  <label
    >{label}<input
      value={auth[key] || ""}
      oninput={(event) => onchange({ [key]: event.currentTarget.value })}
      autocomplete="off"
      spellcheck="false"
    /></label
  >
{/each}
<label
  >Audience (aud; string or JSON array)<input
    value={Array.isArray(auth.audience)
      ? JSON.stringify(auth.audience)
      : auth.audience || ""}
    oninput={(event) => onchange({ audience: event.currentTarget.value })}
    autocomplete="off"
    spellcheck="false"
  /></label
>
<label
  >Additional claims (JSON)<textarea
    value={typeof auth.additionalClaims === "string"
      ? auth.additionalClaims
      : JSON.stringify(auth.additionalClaims || {}, null, 2)}
    oninput={(event) =>
      onchange({ additionalClaims: event.currentTarget.value })}
    rows="5"
    spellcheck="false"></textarea></label
>
<label
  >Private key (PEM, base64 DER/PEM or PKCS8 data URI)<textarea
    value={auth.privateKey || ""}
    oninput={(event) => onchange({ privateKey: event.currentTarget.value })}
    rows="7"
    autocomplete="off"
    spellcheck="false"></textarea></label
>
<label
  >Claims mode<select
    value={auth.claimsMode || "legacy"}
    onchange={(event) =>
      onchange({
        claimsMode: event.currentTarget.value,
        ...(event.currentTarget.value === "legacy"
          ? { algorithm: "RS256" }
          : {}),
      })}
  >
    <option value="legacy">Insomnium (RS256, 10-minute default)</option><option
      value="postman">Postman</option
    >
    {#if auth.claimsMode && !["legacy", "postman"].includes(auth.claimsMode)}<option
        value={auth.claimsMode}>{auth.claimsMode} (unsupported)</option
      >{/if}
  </select></label
>
{#if auth.claimsMode === "postman"}
  <label
    >Algorithm<select
      value={auth.algorithm || "RS256"}
      onchange={(event) => onchange({ algorithm: event.currentTarget.value })}
    >
      {#each algorithms as algorithm}<option value={algorithm}
          >{algorithm}</option
        >{/each}
      {#if auth.algorithm && !algorithms.includes(auth.algorithm)}<option
          value={auth.algorithm}>{auth.algorithm} (unsupported)</option
        >{/if}
    </select></label
  >
  <label
    >Expiry (seconds; default 3600)<input
      value={auth.expirySeconds || ""}
      oninput={(event) =>
        onchange({ expirySeconds: event.currentTarget.value })}
    /></label
  >
{/if}
<p class="hint">
  Additional claims override generated claims. Insomnium mode defaults sub to
  issuer and adds iat, nbf, exp and jti. Postman uses its own fallback rules and
  omits nbf unless supplied. An exp claim is a timestamp, not a duration.
</p>
<p class="hint">
  A new token is generated per Send and kept only for that request's original
  origin. Manual Authorization takes precedence. A data URI's kid must match Key
  ID when both are provided. RSA keys must be 2048–8192 bits. EC keys must match
  the selected curve: ES256/ES384 require PKCS8; ES512 accepts PKCS8 or SEC1.
</p>
