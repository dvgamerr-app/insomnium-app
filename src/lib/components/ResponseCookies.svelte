<script>
  import Button from './ui/Button.svelte';
  /** @type {{response:Record<string,any>|undefined,onmanage?:()=>void}} */
  let {response,onmanage}=$props();
  const cookies=$derived((response?.headers||[])
    .filter((/** @type {string[]} */header)=>header[0].toLowerCase()==='set-cookie')
    .map((/** @type {string[]} */header)=>{
      const raw=header[1],pair=raw.split(';',1)[0],at=pair.indexOf('=');
      // Display the first name/value pair without interpreting attributes or
      // claiming that the native jar accepted it. Preserve the complete header.
      return {raw,name:at>0?pair.slice(0,at).trim():'',value:at>0?pair.slice(at+1).trim():''};
    }));
  const disabledPolicy=$derived([
    ...(response?.settingSendCookies===false?['sending']:[]),
    ...(response?.settingStoreCookies===false&&cookies.length?['storing']:[]),
  ].join(' and '));
</script>

<div class="response-cookies">
  {#if disabledPolicy}<p class="hint" role="status">Automatic {disabledPolicy} of cookies was disabled for this request.</p>{/if}
  {#if cookies.length}<table class="response-cookie-table" aria-label="Response cookies">
    <thead><tr><th>Name</th><th>Value</th></tr></thead>
    <tbody>{#each cookies as cookie}<tr>
      <td>{cookie.name||'(invalid cookie)'}</td>
      <td><code>{cookie.value}</code><details><summary>Set-Cookie header</summary><code>{cookie.raw}</code></details></td>
    </tr>{/each}</tbody>
  </table>{:else}<p class="hint">No cookies in this response.</p>{/if}
  {#if onmanage}<Button variant="secondary" onclick={onmanage}>Manage cookies</Button>{/if}
</div>
