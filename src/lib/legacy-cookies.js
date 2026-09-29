/** Convert saved tough-cookie attributes; native cookie_store performs protocol parsing.
 * Original resources remain untouched. Max-Age is anchored to original creation time.
 */

/** @param {any} value */
function dateMillis(value) {
  if (value && typeof value === "object" && Object.hasOwn(value, "$$date"))
    value = value.$$date;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid saved date");
  return date.getTime();
}

/** @param {Record<string, any>} cookie @param {number} now */
export function convertLegacyCookie(cookie, now = Date.now()) {
  if (!cookie || typeof cookie !== "object" || Array.isArray(cookie))
    throw new Error("Invalid cookie record");
  const name = cookie.key ?? "";
  const value = cookie.value ?? "";
  if (
    typeof name !== "string" ||
    typeof value !== "string" ||
    /[\x00-\x20\x7f;=]/.test(name) ||
    /[\x00-\x1f\x7f;]/.test(value)
  )
    throw new Error(
      "Cookie name/value cannot be represented without changing it",
    );
  for (const field of ["hostOnly", "secure", "httpOnly"])
    if (cookie[field] != null && typeof cookie[field] !== "boolean")
      throw new Error(`Invalid ${field} flag`);
  if (cookie.extensions?.length)
    throw new Error(
      "Custom cookie extensions need manual migration; source retained",
    );
  if (cookie.partitioned || cookie.partitionKey)
    throw new Error(
      "Partitioned cookie scope is not supported by the native jar",
    );
  let expires = Infinity;
  if (cookie.maxAge != null) {
    if (cookie.maxAge === "Infinity" || cookie.maxAge === Infinity)
      expires = Date.UTC(9999, 11, 31, 23, 59, 59);
    else if (cookie.maxAge === "-Infinity" || cookie.maxAge === -Infinity)
      return null;
    else {
      if (
        (typeof cookie.maxAge !== "number" &&
          typeof cookie.maxAge !== "string") ||
        String(cookie.maxAge).trim() === "" ||
        !Number.isFinite(Number(cookie.maxAge))
      )
        throw new Error("Invalid saved Max-Age");
      const age = Number(cookie.maxAge);
      if (age <= 0) return null;
      if (cookie.creation == null)
        throw new Error(
          "Max-Age has no original creation date; refusing to restart its lifetime",
        );
      expires = dateMillis(cookie.creation) + age * 1000;
      if (
        !Number.isFinite(expires) ||
        expires > Date.UTC(9999, 11, 31, 23, 59, 59)
      )
        throw new Error("Cookie expiry is outside the supported date range");
    }
  } else if (
    cookie.expires != null &&
    cookie.expires !== "Infinity" &&
    cookie.expires !== Infinity
  )
    expires = dateMillis(cookie.expires);
  if (expires <= now) return null;
  let domain = cookie.domain;
  if (typeof domain !== "string" || !domain || /[\s/\\?#@;%]/.test(domain))
    throw new Error("Missing or invalid saved cookie domain");
  domain = domain.replace(/^\./, "");
  if (domain.includes(":") && !domain.startsWith("[")) domain = `[${domain}]`;
  const origin = new URL(`https://${domain}/`);
  if (origin.port || origin.pathname !== "/" || !origin.hostname)
    throw new Error("Cookie domain must not contain a port or path");
  domain = origin.hostname;
  const path = cookie.path;
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    /[\x00-\x1f\x7f;]/.test(path)
  )
    throw new Error("Missing or invalid saved cookie path");
  const hostOnly = cookie.hostOnly === true;
  const attributes = [`${name}=${value}`, `Path=${path}`];
  if (!hostOnly) attributes.push(`Domain=${domain}`);
  if (cookie.secure) attributes.push("Secure");
  if (cookie.httpOnly) attributes.push("HttpOnly");
  if (cookie.sameSite != null) {
    const site = String(cookie.sameSite).toLowerCase();
    if (!["strict", "lax", "none"].includes(site))
      throw new Error("Invalid SameSite attribute");
    attributes.push(`SameSite=${site}`);
  }
  if (expires !== Infinity)
    attributes.push(`Expires=${new Date(expires).toUTCString()}`);
  return {
    name,
    value,
    domain,
    path,
    hostOnly,
    url: origin.href,
    raw: attributes.join("; "),
  };
}

/** @param {Record<string, any>[]} resources @param {string} workspaceId @param {number} [now] */
export function legacyCookiePlan(resources, workspaceId, now = Date.now()) {
  const jars = resources.filter(
    (resource) =>
      resource._type === "cookie_jar" && resource.parentId === workspaceId,
  );
  /** @type {(NonNullable<ReturnType<typeof convertLegacyCookie>> & { label: string })[]} */
  const entries = [];
  /** @type {Map<string, (NonNullable<ReturnType<typeof convertLegacyCookie>> & { label: string }) | null>} */
  const latest = new Map();
  /** @type {string[]} */
  const issues = [];
  let total = 0,
    expired = 0,
    superseded = 0;
  for (const jar of jars) {
    if (!Array.isArray(jar.cookies)) {
      issues.push(`${jar.name || "Cookie jar"}: cookies is not an array`);
      continue;
    }
    total += jar.cookies.length;
    for (let index = 0; index < jar.cookies.length; index++) {
      const label = `${jar.name || "Cookie jar"} #${index + 1}`;
      try {
        const entry = convertLegacyCookie(jar.cookies[index], now);
        // Serialized tough-cookie stores apply later records to the same key.
        // An expired later record must also suppress an earlier live cookie.
        const identity =
          entry ||
          convertLegacyCookie(
            { ...jar.cookies[index], maxAge: null, expires: "Infinity" },
            now,
          );
        if (!identity)
          throw new Error("Cannot determine the saved cookie identity");
        const key = JSON.stringify([
          identity.domain,
          identity.path,
          identity.name,
        ]);
        if (latest.has(key)) superseded++;
        latest.set(key, entry ? { ...entry, label } : null);
        if (!entry) expired++;
      } catch (error) {
        issues.push(`${label}: ${String(error)}`);
      }
    }
  }
  for (const entry of latest.values()) if (entry) entries.push(entry);
  return { jars: jars.length, total, expired, superseded, entries, issues };
}
