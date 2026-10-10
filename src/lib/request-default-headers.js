/** Apply the legacy built-in default-headers hook after environment rendering.
 * The request is the caller's detached Send snapshot, never a saved resource.
 * @param {Record<string,any>} request
 * @param {Record<string,any>} context
 */
export function applyDefaultRequestHeaders(request, context) {
  const defaults = context.DEFAULT_HEADERS;
  if (!defaults) return;
  const present = new Set(
    request.headers
      .filter(
        (/** @type {Record<string,any>} */ header) =>
          typeof header.name === "string",
      )
      .map((/** @type {Record<string,any>} */ header) =>
        header.name.toLowerCase(),
      ),
  );
  for (const name of Object.keys(defaults)) {
    if (present.has(name.toLowerCase())) continue;
    // Legacy checks existing headers first; the string sentinel never removes
    // a request's explicit header. Keep values literal for transport composition.
    if (defaults[name] !== "null") {
      request.headers.push({ name, value: defaults[name] });
      present.add(name.toLowerCase());
    }
  }
}
