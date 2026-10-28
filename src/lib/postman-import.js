import { encodeBase64 } from "./transport.js";

/** @param {unknown} value */
const disabled = (value) => {
  if (value === undefined) return false;
  if (typeof value !== 'boolean') throw new Error('Postman disabled flags must be booleans.');
  return value;
};
/** @param {unknown} schema */
const version20 = (schema) => typeof schema === 'string' && /(?:^|\/)v2\.0\.0(?:\/|$)/.test(schema);
/** v2.0 archived exports used enabled; current schemas use disabled.
 * @param {any} field @param {unknown} schema */
function formDisabled(field,schema){
  if(version20(schema)&&!Object.hasOwn(field,'disabled')&&Object.hasOwn(field,'enabled')){
    if(typeof field.enabled!=='boolean')throw new Error('Postman enabled flags must be booleans.');
    return !field.enabled;
  }
  return disabled(field.disabled);
}
/** v2.0 auth attributes are objects; v2.1 uses key/value records.
 * @param {any} attributes @param {unknown} schema
 * @returns {Record<string,any>} */
export function postmanAuthAttributes(attributes,schema){
  if(attributes == null)return {};
  if(Array.isArray(attributes)){
    if(attributes.some(row=>!row||typeof row!=='object'||Array.isArray(row)||typeof row.key!=='string'))
      throw new Error('Postman authentication attributes must be key/value records.');
    return Object.fromEntries(attributes.map(row=>[row.key,row.value]));
  }
  if(version20(schema)&&typeof attributes==='object')return structuredClone(attributes);
  throw new Error('Postman authentication attributes must be a v2.0 object or v2.1 key/value array.');
}
/** Keep API token placement distinct from token-endpoint client authentication.
 * @param {Record<string,any>} attributes */
export function postmanOAuth2(attributes){
  const auth={...attributes};
  const grant=auth.grantType??auth.grant_type;
  auth.grantType=grant==='authorization_code_with_pkce'?'authorization_code'
    :grant==='password_credentials'?'password':grant;
  auth.authorizationUrl??=auth.authUrl;
  auth.redirectUrl??=auth.redirect_uri;
  auth.pkceMethod??=auth.challengeAlgorithm;
  auth.tokenPrefix??=auth.headerPrefix;
  if(auth.usePkce==null&&['authorization_code','authorization_code_with_pkce'].includes(grant))
    auth.usePkce=grant==='authorization_code_with_pkce';
  if(auth.credentialsInBody==null&&auth.client_authentication!=null){
    if(!['body','header'].includes(auth.client_authentication))
      throw new Error('Unsupported Postman OAuth client authentication placement. Use body or header.');
    auth.credentialsInBody=auth.client_authentication==='body';
  }
  return auth;
}
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
  source ??= {};
  if (typeof source !== "object" || Array.isArray(source) ||
      ["raw", "protocol", "hash"].some((key) => source[key] != null && typeof source[key] !== "string") ||
      (source.port != null && typeof source.port !== "string" && typeof source.port !== "number") ||
      (source.auth != null && (typeof source.auth !== "object" || Array.isArray(source.auth) || ["user", "password"].some((key) => source.auth[key] != null && typeof source.auth[key] !== "string"))) ||
      (source.host != null && typeof source.host !== "string" && (!Array.isArray(source.host) || source.host.some((/** @type {any} */ part) => typeof part !== "string"))))
    throw new Error("Postman URL components must be text.");
  if (source.path != null && typeof source.path !== "string" && (!Array.isArray(source.path) || source.path.some(
    (/** @type {any} */ part) => typeof part !== "string" && (!part || typeof part !== "object" || Array.isArray(part) || (part.value !== undefined && typeof part.value !== "string")),
  ))) throw new Error("Postman URL path must contain text segments.");
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
  const structured = ["protocol", "host", "port", "path", "auth"].some((key) => source[key] != null);
  const auth = source.auth && (typeof source.auth.user === "string" || typeof source.auth.password === "string")
    ? `${source.auth.user ?? ""}${typeof source.auth.password === "string" ? `:${source.auth.password}` : ""}@` : "";
  let url = !structured && source.raw ? source.raw :
    `${source.protocol ? source.protocol.endsWith("://") ? source.protocol : `${source.protocol}://` : ""}${auth}${host}${source.port != null && source.port !== "" ? `:${source.port}` : ""}${path ? `/${path.replace(/^\//, "")}` : ""}${source.hash ? `#${source.hash}` : ""}`;
  if (source.query != null && (!Array.isArray(source.query) || source.query.some(
    (/** @type {any} */ p) => !p || typeof p !== "object" || Array.isArray(p) ||
      (p.key != null && typeof p.key !== "string") || (p.value != null && typeof p.value !== "string"),
  ))) throw new Error("Postman query parameters must be objects with text or null keys and values.");
  if (source.variable != null && (!Array.isArray(source.variable) || source.variable.some(
    (/** @type {any} */ v) => !v || typeof v !== "object" || Array.isArray(v) || !(v.key || v.id) || !["string", "number"].includes(typeof (v.key || v.id)),
  ))) throw new Error("Postman URL variables must be named variable records.");
  const parameters = (source.query || []).map((/** @type {any} */ p) => ({
    name: decode(p.key),
    value: decode(p.value),
    disabled: disabled(p.disabled),
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
      disabled: disabled(v.disabled),
    })),
  };
}

/** @param {any} source @param {unknown} [schema] */
export function postmanBody(source,schema) {
  if (source != null && typeof source !== "string" &&
      (typeof source !== "object" || Array.isArray(source)))
    throw new Error("Postman body must be text, an object, or null.");
  const body = typeof source === "string" ? {mode:"raw",raw:source} : source || {};
  const mode = disabled(body.disabled) ? "" : body.mode;
  if (mode != null && typeof mode !== "string")
    throw new Error("Postman body mode must be text.");
  if (mode && !["raw","urlencoded","formdata","graphql","file"].includes(mode))
    throw new Error("Unsupported Postman body mode: " + mode);
  if (mode === "raw" && body.raw != null && typeof body.raw !== "string")
    throw new Error("Postman raw body must be text.");
  if (mode === "graphql" && body.graphql != null &&
      (typeof body.graphql !== "object" || Array.isArray(body.graphql)))
    throw new Error("Postman GraphQL body must be an object.");
  if (mode === "file" && body.file != null && typeof body.file !== "string" &&
      (typeof body.file !== "object" || Array.isArray(body.file) ||
       (body.file.src != null && typeof body.file.src !== "string") ||
       (body.file.content != null && typeof body.file.content !== "string")))
    throw new Error("Postman file source must be text or null.");
  const fileContent = mode === "file" && typeof body.file?.content === "string"
    ? new TextEncoder().encode(body.file.content) : null;
  if (fileContent && fileContent.length > 20 * 1024 * 1024)
    throw new Error("Postman file content exceeds 20 MiB.");
  const legacyForm = mode === "urlencoded" && typeof body.urlencoded === "string";
  const parameters = legacyForm ? (body.urlencoded ? body.urlencoded.split("&").map((/** @type {string} */ pair, /** @type {number} */ index, /** @type {string[]} */ all) => {
    const equals = pair.indexOf("=");
    return {key:pair === "" && index !== all.length-1 ? "null" : equals < 0 ? pair : pair.slice(0,equals),value:equals < 0 ? "" : pair.slice(equals+1)};
  }) : []) : mode === "urlencoded" ? body.urlencoded ?? []
    : mode === "formdata" ? body.formdata ?? [] : [];
  if (!Array.isArray(parameters) || parameters.some((/** @type {any} */ parameter) => !parameter || typeof parameter !== "object" || Array.isArray(parameter)))
    throw new Error("Postman form fields must be an array of objects.");
  if (parameters.some((/** @type {any} */ parameter) => typeof parameter.key !== "string"))
    throw new Error("Postman form fields must have a name.");
  if (mode === "urlencoded" && parameters.some((/** @type {any} */ parameter) => parameter.type === "file"))
    throw new Error("Postman file fields require form-data.");
  if (mode === "formdata" && parameters.some((/** @type {any} */ parameter) =>
    parameter.type === "file" && parameter.src != null && typeof parameter.src !== "string" &&
    (!Array.isArray(parameter.src) || parameter.src.some((/** @type {any} */ file) => typeof file !== "string"))))
    throw new Error("Postman multipart file sources must be text, null, or a list of text paths.");
  if (mode === "urlencoded" && parameters.some((/** @type {any} */ parameter) => parameter.value != null && typeof parameter.value === "object"))
    throw new Error("Postman URL-encoded values must be scalar.");
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
      mode === "graphql" ? JSON.stringify(body.graphql || {}) : mode === "raw" ? body.raw || "" : "",
    fileName: typeof body.file === "string" ? body.file : typeof body.file?.src === "string" ? body.file.src : "",
    ...(legacyForm ? {_postmanUrlencodedString:true} : {}),
    ...(mode === "graphql" ? {_postmanGraphqlBody:true} : {}),
    ...(fileContent ? {base64:encodeBase64(fileContent)} : {}),
    params: parameters.flatMap(
      (/** @type {any} */ p) => {
        const files =
          p.type === "file" && Array.isArray(p.src) && p.src.length
            ? p.src
            : [p.src];
        return files.map((/** @type {any} */ fileName) => ({
          name: p.key,
          ...(p.key === "" ? {sendEmptyName:true} : {}),
          value: p.type !== "file" && typeof p.value !== "string" && p.value !== undefined && (mode === "formdata" || p.value !== null) ? JSON.stringify(p.value) : p.value ?? "",
          disabled: formDisabled(p,schema),
          type: p.type,
          fileName: typeof fileName === "string" ? fileName : "",
          contentType: p.contentType || "",
        }));
      },
    ),
  };
}

/** @param {any} variables */
export const postmanVariables = (variables = []) => {
  if (!Array.isArray(variables) || variables.some(v => !v || typeof v !== "object" || Array.isArray(v) || !(v.key || v.id) || !["string", "number"].includes(typeof (v.key || v.id))))
    throw new Error("Postman collection variables must be named variable records.");
  return Object.fromEntries(
    variables.filter((v) => !disabled(v.disabled)).map((v) => [v.key || v.id, v.value ?? ""]),
  );
};

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
  if (!Array.isArray(headers) || headers.some((/** @type {any} */ h) =>
    !h || typeof h !== 'object' || Array.isArray(h) || typeof h.key !== 'string' || typeof h.value !== 'string'))
    throw new Error('Postman headers must be objects with text keys and values.');
  return headers.map((/** @type {any} */ h) => ({
    name: h.key,
    value: h.value,
    disabled: disabled(h.disabled),
    ...(Object.hasOwn(h,'description')?{description:structuredClone(h.description)}:{}),
  }));
}
/** Postman v2.1 descriptions may be text, a content object, or null.
 * @param {any} description @returns {string} */
export function postmanDescription(description) {
  if (typeof description === "string") return description;
  return typeof description?.content === "string" ? description.content : "";
}
/** Disabled events are archival metadata, not scripts that need execution.
 * Unknown enabled events remain guarded rather than silently ignored.
 * @param {any} events */
export function postmanScriptsActive(events) {
  if(events == null)return false;
  if(!Array.isArray(events))throw new Error("Postman events must be an array.");
  return events.some(event=>!disabled(event?.disabled));
}
