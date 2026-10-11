/** Project the native cookie snapshot into the legacy util.models jar shape.
 * Native storage remains authoritative; the workspace jar is its model view.
 * @param {{cookies:Record<string,any>[]}} snapshot */
export function pluginJarCookies(snapshot) {
  if (!Array.isArray(snapshot?.cookies)) throw Error("Invalid native cookie snapshot");
  return snapshot.cookies.map(cookie => {
    const hostOnly = typeof cookie.domain?.HostOnly === "string";
    const domain = hostOnly ? cookie.domain.HostOnly : cookie.domain?.Suffix;
    const expires = cookie.expires === "SessionEnd" ? "Infinity" : cookie.expires?.AtUtc;
    if (typeof cookie.key !== "string" || typeof cookie.value !== "string" ||
      typeof domain !== "string" || !Array.isArray(cookie.path) ||
      typeof cookie.path[0] !== "string" || typeof cookie.path[1] !== "boolean" ||
      typeof expires !== "string" || typeof cookie.secure !== "boolean" ||
      typeof cookie.httpOnly !== "boolean") throw Error("Invalid native cookie model");
    return {
      key: cookie.key, value: cookie.value, domain, path: cookie.path[0],
      pathIsDefault: !cookie.path[1], hostOnly, expires,
      secure: cookie.secure, httpOnly: cookie.httpOnly,
    };
  });
}

/** Legacy deterministic jar IDs prevent duplicates across repeated helper calls.
 * @param {string} workspaceId */
export async function pluginCookieJarId(workspaceId) {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(workspaceId));
  return "jar_" + [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
