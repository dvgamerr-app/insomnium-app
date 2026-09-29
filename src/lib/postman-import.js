/** @param {any} value */
const decode = (value) => {
  try {
    return decodeURIComponent(String(value ?? ""));
  } catch {
    return String(value ?? "");
  }
};

/** Postman URL components are authoritative when supplied; raw-only URLs remain intact.
 * @param {any} source */
export function postmanUrl(source) {
  if (typeof source === "string") return { url: source, parameters: [] };
  source ||= {};
  const host = Array.isArray(source.host)
    ? source.host.join(".")
    : source.host || "";
  const path = Array.isArray(source.path)
    ? source.path
        .map((/** @type {any} */ part) =>
          typeof part === "string" ? part : part.value || "",
        )
        .join("/")
    : source.path || "";
  let url =
    source.raw ||
    `${source.protocol ? `${source.protocol}://` : ""}${host}${source.port ? `:${source.port}` : ""}${path ? `/${path.replace(/^\//, "")}` : ""}${source.hash ? `#${source.hash}` : ""}`;
  const parameters = (source.query || []).map((/** @type {any} */ p) => ({
    name: decode(p.key),
    value: decode(p.value),
    disabled: !!p.disabled,
    noValue: p.value == null,
    sendEmptyName: !p.key,
  }));
  if (Array.isArray(source.query)) {
    const hashAt = url.indexOf("#");
    const fragment = hashAt < 0 ? "" : url.slice(hashAt);
    url = (hashAt < 0 ? url : url.slice(0, hashAt)).split("?")[0] + fragment;
  }
  return {
    url,
    parameters,
    pathParameters: (source.variable || []).map((/** @type {any} */ v) => ({
      name: v.key || v.id,
      value: v.value ?? "",
      disabled: !!v.disabled,
    })),
  };
}

/** @param {any} source */
export function postmanBody(source) {
  const body = source || {};
  const mode = body.disabled ? "" : body.mode;
  /** @type {Record<string, string>} */
  const rawTypes = {
    json: "application/json",
    xml: "application/xml",
    html: "text/html",
    javascript: "application/javascript",
    text: "text/plain",
  };
  /** @type {Record<string, string>} */
  const mimeTypes = {
    urlencoded: "application/x-www-form-urlencoded",
    formdata: "multipart/form-data",
    graphql: "application/graphql",
    file: "application/octet-stream",
  };
  return {
    mimeType:
      mode === "raw"
        ? rawTypes[body.options?.raw?.language] || "text/plain"
        : mimeTypes[mode] || "",
    text:
      mode === "graphql" ? JSON.stringify(body.graphql || {}) : body.raw || "",
    fileName: typeof body.file?.src === "string" ? body.file.src : "",
    params: (body.urlencoded || body.formdata || []).flatMap(
      (/** @type {any} */ p) => {
        const files =
          p.type === "file" && Array.isArray(p.src) && p.src.length
            ? p.src
            : [p.src];
        return files.map((/** @type {any} */ fileName) => ({
          name: p.key,
          value: p.value ?? "",
          disabled: !!p.disabled,
          type: p.type,
          fileName: typeof fileName === "string" ? fileName : "",
          contentType: p.contentType || "",
        }));
      },
    ),
  };
}

/** @param {any[]} variables */
export const postmanVariables = (variables = []) =>
  Object.fromEntries(
    variables
      .filter((v) => !v.disabled && (v.key || v.id))
      .map((v) => [v.key || v.id, v.value ?? ""]),
  );

/** @param {any} headers */
export function postmanHeaders(headers = []) {
  if (typeof headers === "string")
    return headers
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const colon = line.indexOf(":");
        if (colon <= 0) throw new Error("Invalid Postman header line.");
        return {
          name: line.slice(0, colon).trim(),
          value: line.slice(colon + 1).trim(),
          disabled: false,
        };
      });
  return headers.map((/** @type {any} */ h) => ({
    name: h.key,
    value: h.value,
    disabled: !!h.disabled,
  }));
}
