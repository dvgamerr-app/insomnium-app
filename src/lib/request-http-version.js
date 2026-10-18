/** @param {unknown} value */
export function requestHttpVersion(value) {
  if (value == null || value === "" || value === "default") return null;
  if (!["1.0", "1.1", "2-prior-knowledge"].includes(String(value)) || typeof value !== "string")
    throw new Error("Choose a supported HTTP version in Settings.");
  return value;
}

/** Explicit automatic differs from inheriting the app preference.
 * @param {Record<string,any>} settings @param {Record<string,any>} request @param {string} protocol */
export function selectedHttpVersion(settings, request, protocol) {
  const override = request.settingHttpVersion;
  if (override != null && override !== "" && override !== "global") return requestHttpVersion(override);
  if (protocol === "ws:" || protocol === "wss:") return null;
  if (override !== "global" && request._curlSource) return null;
  return requestHttpVersion(settings.httpVersion);
}
