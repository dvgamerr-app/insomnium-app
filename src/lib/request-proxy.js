/** Resolve only the active request proxy input.
 * @param {Record<string,any>} settings @param {Record<string,any>} request
 * @param {(value:unknown)=>string} [resolve] */
export function requestProxy(
  settings,
  request,
  resolve = (value) => String(value ?? ""),
) {
  const mode = request.settingProxy ?? "global";
  if (!["global", "custom", "off"].includes(mode))
    throw new Error("Choose a valid request proxy setting.");
  if (mode === "custom") {
    if (
      request.settingProxyBasicAuth != null &&
      typeof request.settingProxyBasicAuth !== "boolean"
    )
      throw new Error("Choose a valid proxy authentication setting.");
    const proxy = resolve(request.settingProxyUrl).trim();
    if (!proxy || proxy.length > 8192 || /[\x00-\x20\x7f]/.test(proxy))
      throw new Error("Enter a valid request proxy URL.");
    const auth =
      request.settingProxyAuth ??
      (request.settingProxyBasicAuth ? "basic" : "auto");
    if (!["auto", "basic", "digest", "ntlm"].includes(auth))
      throw new Error("Choose a valid proxy authentication setting.");
    if (["digest", "ntlm"].includes(auth)) {
      let url;
      try {
        url = new URL(proxy.includes("://") ? proxy : "http://" + proxy);
      } catch {
        throw new Error("Enter a valid HTTP(S) proxy URL.");
      }
      if (!["http:", "https:"].includes(url.protocol))
        throw new Error(
          "Digest and NTLM proxy authentication require an HTTP(S) proxy.",
        );
    }
    return {
      proxy,
      proxyDisabled: false,
      proxyOverride: true,
      proxyBasicAuth: auth === "basic",
      proxyAuthMode: auth,
    };
  }
  return {
    proxy: mode === "off" ? null : settings.proxy || null,
    proxyDisabled: mode === "off",
    proxyOverride: mode === "off",
    proxyBasicAuth: false,
  };
}

/** curl uses HTTP without a scheme and port 1080 when no port was supplied.
 * @param {string} value @param {string|undefined} [credentials] */
export function curlProxyUrl(value, credentials) {
  if (credentials !== undefined && !value)
    throw new Error(
      "cURL proxy credentials require an explicit nonempty --proxy.",
    );
  if (!value) return "";
  if (value.length > 8192 || /[\x00-\x20\x7f]/.test(value))
    throw new Error("Invalid cURL proxy URL.");
  const text = value.includes("://") ? value : "http://" + value;
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error("Invalid cURL proxy URL.");
  }
  if (
    !["http:", "https:", "socks4:", "socks4a:", "socks5:", "socks5h:"].includes(
      url.protocol,
    ) ||
    !url.hostname ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Unsupported cURL proxy URL. Use an HTTP(S) or SOCKS host and port.",
    );
  const authority =
    text
      .slice(text.indexOf("://") + 3)
      .split(/[/?#]/)[0]
      .split("@")
      .at(-1) || "";
  if (authority.endsWith(":")) throw new Error("Invalid cURL proxy port.");
  if (!/:\d+$/.test(authority)) url.port = "1080";
  if (credentials !== undefined) {
    const colon = credentials.indexOf(":");
    if (colon < 1 || /[\x00-\x1f\x7f]/.test(credentials))
      throw new Error(
        "Include an explicit proxy username:password; interactive and OS credentials are not supported.",
      );
    url.username = encodeURIComponent(credentials.slice(0, colon));
    url.password = encodeURIComponent(credentials.slice(colon + 1));
  }
  const result = url.toString();
  if (result.length > 8192)
    throw new Error("cURL proxy URL exceeds 8192 characters.");
  return result;
}
