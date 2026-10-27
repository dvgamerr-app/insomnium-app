import { swaggerArrayValues } from "./openapi-swagger-array.js";
import {decodeResponseBytes,responseBodyText} from "./response-text.js";
import { serializeOpenApiCookie } from "./openapi-cookie.js";
import { serializeOpenApiSerialized } from "./openapi-serialized-example.js";
import { isBinaryBody } from "./binary-body.js";
import { readGraphqlBody } from "./graphql-body.js";
import { serializeOpenApiForm } from "./openapi-form.js";
import { buildNetworkLog, failureLog, NetworkError } from "./network-log.js";
import {
  smartEncodeUrl,
  smartEncodeQueryString,
  buildQueryParameter,
  joinUrlAndQueryString,
} from "./template-url.js";
import { composeCurlBody, appendCurlFileQuery, appendCurlUploadName } from "./curl-body.js";
import { multipartHeaders, multipartEncodings, assertMultipartHeaderFiles } from "./multipart-headers.js";
import { curlMultipart, curlFileContentType } from "./curl-multipart.js";
import { serializeOpenApiQuery } from "./openapi-query.js";
import { serializeOpenApiHeader } from "./openapi-header.js";
import { expandOpenApiPath } from "./openapi-path.js";
import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import { createNativeCancellation } from "./native-cancellation.js";
import { environmentFor, render, workspaceFor, protocolFor } from "./model.js";
import { oauthHeader } from "./oauth-model.js";
import {
  clientCertificateSelection,
  collectionCaCertificatePath,
  collectionCaCertificateAsset,
} from "./client-certificates.js";
import { prepareOAuth1 } from "./oauth1-model.js";
import { prepareHawk } from "./hawk-model.js";
import { prepareAsap } from "./asap-model.js";
import { selectedHttpVersion } from "./request-http-version.js";
import { requestProxy } from "./request-proxy.js";
import { requestRedirectLimit } from "./request-redirects.js";
import { requestTimeouts } from "./request-timeouts.js";
import { assertCurlHeaderFiles } from "./curl-headers.js";

/** @param {Uint8Array} bytes */
export function encodeBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
/** Match the original Buffer latin1 conversion, including UTF-16 low-byte truncation.
 * @param {string} username @param {string} password @param {boolean} latin1 */
export function basicAuthorization(username, password, latin1 = false) {
  const text = `${username}:${password}`;
  const bytes = latin1
    ? Uint8Array.from(
        { length: text.length },
        (_, index) => text.charCodeAt(index) & 255,
      )
    : new TextEncoder().encode(text);
  return `Basic ${encodeBase64(bytes)}`;
}
/** Presence, including an empty value, overrides generated Authorization.
 * @param {Record<string, any>} data @param {Record<string, any>} request */
export function hasManualAuthorization(data, request) {
  const environment = environmentFor(
    data.resources,
    request,
    data.activeEnvironmentId,
  );
  return (request.headers || []).some(
    (/** @type {Record<string, any>} */ header) =>
      !header.disabled &&
      render(header.name, environment).toLowerCase() === "authorization" &&
      (!header._openapiSerialization ||
        serializeOpenApiHeader(
          "Authorization",
          render(header.value, environment),
          header._openapiSerialization,
        ) !== null),
  );
}
/** @param {Record<string, any>} data @param {Record<string, any>} request @param {string} runId */
export function prepareRequest(data, request, runId) {
  const environment = environmentFor(
    data.resources,
    request,
    data.activeEnvironmentId,
  );
  return composeRequest(
    data,
    request,
    runId,
    (value) => render(value, environment),
    () => oauthHeader(data, request),
  );
}

/** Compose an already-rendered snapshot without interpreting literal template text again.
 * OAuth lifecycle must supply its resolved Authorization value when required.
 * @param {Record<string,any>} data @param {Record<string,any>} request @param {string} runId
 * @param {{oauthAuthorization?:string}} [options]
 */
export function prepareRenderedRequest(data, request, runId, options = {}) {
  return composeRequest(
    data,
    request,
    runId,
    (value) => String(value ?? ""),
    () => {
      if (
        typeof options.oauthAuthorization !== "string" ||
        !options.oauthAuthorization ||
        /[\r\n]/.test(options.oauthAuthorization)
      )
        throw new Error(
          "Resolve OAuth Authorization before composing the rendered request.",
        );
      return options.oauthAuthorization;
    },
  );
}

/** @param {Record<string,any>} data @param {Record<string,any>} request @param {string} runId
 * @param {(value:unknown)=>string} resolve @param {()=>string} resolvedOAuthHeader */
function composeRequest(data, request, runId, resolve, resolvedOAuthHeader) {
  assertCurlHeaderFiles(request.headers);
  if (request.settingDecodeResponse != null && typeof request.settingDecodeResponse !== "boolean")
    throw new Error("Choose a valid response decompression setting in Settings.");
  if (request.settingValidateCertificates != null &&
      !["global", "on", "off"].includes(request.settingValidateCertificates))
    throw new Error("Choose the request TLS certificate validation preference in Settings.");
  const openapiIssues = [
    ...new Set([
      ...(request._openapiIssues || []),
      ...(request._openapiSchemaIssues || []),
    ]),
  ];
  if (openapiIssues.length)
    throw new Error(
      `Review this generated request in Settings before sending:\n${openapiIssues.join("\n")}`,
    );
  const migrationIssues = (request._migrationIssues || []).filter(
    (/** @type {string} */ issue) => !(
      request._harSource?.request && issue === "Select imported HAR files again before sending." ||
      request._hoppscotchSource && issue === "Select imported Hoppscotch files again before sending."
    ),
  );
  if (migrationIssues.length)
    throw new Error(migrationIssues.join("\n"));
  // Saved cURL commands retain their explicit query spelling; ordinary requests
  // use Insomnium's legacy automatic encoding unless the owner disables it.
  const encodeUrl = request.settingEncodeUrl ?? !request._curlSource;
  const legacyQuery = !request._curlSource || encodeUrl;
  const orderedQuery = (request.parameters ?? []).some(
    (/** @type {any} */ p) =>
      !p.disabled &&
      (p._openapiSerialization || p.sendEmptyName) &&
      (p.name || p.sendEmptyName),
  );
  let sourceUrl = resolve(request.url);
  if (legacyQuery && !orderedQuery) {
    const query = [];
    for (const parameter of request.parameters ?? []) {
      if (parameter.disabled || (!parameter.name && !parameter.sendEmptyName))
        continue;
      if (parameter._openapiSerialization) continue;
      query.push(
        buildQueryParameter(
          {
            name: resolve(parameter.name),
            value: parameter.noValue ? undefined : resolve(parameter.value),
          },
          !parameter.sendEmptyName,
        ),
      );
    }
    const authentication = request.authentication ?? {};
    if (
      !authentication.disabled &&
      authentication.type === "apikey" &&
      authentication.addTo === "queryParams"
    )
      query.push(
        buildQueryParameter({
          name: resolve(authentication.key),
          value: resolve(authentication.value),
        }),
      );
    sourceUrl = joinUrlAndQueryString(
      sourceUrl,
      query.filter(Boolean).join("&"),
    );
  }
  if (Array.isArray(request.segmentParams))
    sourceUrl = sourceUrl.replace(
      /:([\w_-]*?)(?=($|[^\w_-]))/g,
      (match, name) => {
        const segment = request.segmentParams.find(
          (/** @type {any} */ row) => row.name === name,
        );
        return segment?.value ? resolve(segment.value) : match;
      },
    );
  const usesUnixSocket = /^https?:\/\/unix:\//.test(sourceUrl);
  sourceUrl = smartEncodeUrl(sourceUrl, encodeUrl);
  let socketPath = null;
  if (usesUnixSocket) {
    const match = sourceUrl.match(/^(https?:)\/\/unix:?(\/[^:]+):\/(.+)$/);
    if (!match)
      throw new Error(
        "Use http://unix:/socket/path:/hostname/path for a Unix socket.",
      );
    socketPath = match[2];
    sourceUrl = match[1] + "//" + match[3];
  }
  const url = new URL(sourceUrl);
  const protocol = protocolFor(request);
  if (protocol === "websocket") {
    if (url.protocol === "http:") url.protocol = "ws:";
    if (url.protocol === "https:") url.protocol = "wss:";
    if (!["ws:", "wss:"].includes(url.protocol))
      throw new Error("Enter a ws:// or wss:// URL");
  } else if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Enter an HTTP or HTTPS URL");
  if (Array.isArray(request.pathParameters) || request._openapiPath) {
    expandOpenApiPath(
      url,
      request.pathParameters ?? [],
      resolve,
      request._openapiPath === true,
    );
    if (!request._openapiPath)
      url.pathname = url.pathname.replace(
        /(^|\/):([^/]+)(?=\/|$)/g,
        (_, prefix, name) => {
          const parameter = request.pathParameters.find(
            (/** @type {any} */ p) => p.name === name && !p.disabled,
          );
          if (!parameter) throw new Error(`Path variable not found: ${name}`);
          return prefix + encodeURIComponent(resolve(parameter.value));
        },
      );
  }
  if (protocol !== "websocket" && request.body?.curlQuery === true) {
    const queryUrl = appendCurlFileQuery(
      url,
      composeCurlBody(request.body, resolve),
    );
    url.href = queryUrl.href;
  }
  for (const param of (request.parameters ?? []).filter(
    (/** @type {any} */ p) =>
      p._openapiSerialization || !legacyQuery || orderedQuery,
  ))
    if (!param.disabled && (param.name || param.sendEmptyName)) {
      const name = resolve(param.name);
      const value = resolve(param.value);
      const encoded = new URLSearchParams([[name, value]]).toString();
      const query = param._openapiSerialization
        ? serializeOpenApiQuery(name, value, param._openapiSerialization)
        : legacyQuery
          ? smartEncodeQueryString(
              buildQueryParameter(
                { name, value: param.noValue ? undefined : value },
                !param.sendEmptyName,
              ),
              encodeUrl,
              !param.sendEmptyName,
            )
          : param.noValue
            ? encoded.slice(0, encoded.indexOf("="))
            : encoded;
      if (
        query === "" &&
        param._openapiSerialization?.querystring &&
        !url.search
      ) {
        // Chromium's search setter drops a bare ?; parsing href preserves it.
        // An explicitly empty whole query remains distinct from nullable omission.
        if (!url.href.split("#", 1)[0].includes("?"))
          url.href = url.href.replace(/(#|$)/, "?$1");
      } else if (
        query ||
        (param._openapiSerialization?.querystring && query !== null)
      )
        url.search += (url.search ? "&" : "?") + query;
    }
  appendCurlUploadName(url, request.body, resolve);
  /** @type {string[][]} */
  const headers = (request.headers ?? [])
    .filter((/** @type {any} */ h) => !h.disabled && h.name)
    .flatMap((/** @type {any} */ h) => {
      const name = resolve(h.name);
      const value = resolve(h.value);
      const serialized = h._openapiSerialization
        ? serializeOpenApiHeader(name, value, h._openapiSerialization)
        : value;
      return serialized === null ? [] : [[name, serialized]];
    });
  const setHeader = (
    /** @type {string} */ name,
    /** @type {string} */ value,
  ) => {
    for (let i = headers.length - 1; i >= 0; i--)
      if (headers[i][0].toLowerCase() === name.toLowerCase())
        headers.splice(i, 1);
    headers.push([name, value]);
  };
  const explicitHeaders=new Set(headers.map(([name])=>name.toLowerCase()));
  const suppressedDefaults=new Set([...(Array.isArray(request.suppressDefaultHeaders)?request.suppressDefaultHeaders:[]),...(request.headers??[])
    .filter((/** @type {any} */row)=>row._curlSuppressDefault===true&&row.disabled===true&&!row.value)
    .map((/** @type {any} */row)=>String(row.name).toLowerCase())
    .filter((/** @type {string} */name)=>['accept','content-type'].includes(name))].filter(name=>['accept','content-type'].includes(name)));
  const cookiePairs = (request.cookieParameters || [])
    .filter((/** @type {any} */ row) => !row.disabled)
    .map((/** @type {any} */ row) =>
      serializeOpenApiCookie(
        resolve(row.name),
        resolve(row.value),
        row._openapiSerialization || {
          style: "form",
          explode: true,
          kind: "scalar",
        },
      ),
    )
    .filter((/** @type {string|null} */ pair) => pair !== null);
  if (cookiePairs.length) {
    const existing = headers
      .filter(([name]) => name.toLowerCase() === "cookie")
      .map(([, value]) => value);
    setHeader(
      "Cookie",
      [...existing, ...cookiePairs].filter(Boolean).join("; "),
    );
  }
  const auth = request.authentication ?? {};
  const manualAuthorization = headers.some(
    ([name]) => name.toLowerCase() === "authorization",
  );
  let digest = null;
  let oauth1 = null;
  let aws = null;
  let hawk = null;
  let asap = null;
  let ntlm = null;
  let netrc = false;
  if (protocol === "sse") setHeader("Accept", "text/event-stream");
  if (!auth.disabled) {
    switch (auth.type) {
      case undefined:
      case "":
      case "none":
        break;
      case "basic":
        if (!manualAuthorization) {
          if (
            auth.useISO88591 != null &&
            ![true, false, "true", "false"].includes(auth.useISO88591)
          )
            throw new Error(
              "Choose UTF-8 or ISO 8859-1 explicitly in Basic Auth.",
            );
          setHeader(
            "Authorization",
            basicAuthorization(
              resolve(auth.username),
              resolve(auth.password),
              auth.useISO88591 === true || auth.useISO88591 === "true",
            ),
          );
        }
        break;
      case "digest":
        if (!manualAuthorization)
          digest = {
            username: resolve(auth.username),
            password: resolve(auth.password),
          };
        break;
      case "bearer":
        if (!manualAuthorization)
          setHeader(
            "Authorization",
            `${resolve(auth.prefix || "Bearer")} ${resolve(auth.token)}`,
          );
        break;
      case "oauth2":
        if (!manualAuthorization)
          setHeader("Authorization", resolvedOAuthHeader());
        break;
      case "oauth1":
        if (!manualAuthorization)
          oauth1 = prepareOAuth1(
            auth,
            protocol === "websocket" ? {} : request.body || {},
            resolve,
          );
        break;
      case "iam":
        if (
          auth.addAuthDataToQuery != null &&
          ![true, false, "true", "false"].includes(auth.addAuthDataToQuery)
        )
          throw new Error("Choose header or query signing explicitly in AWS Auth.");
        const querySigning = [true, "true"].includes(auth.addAuthDataToQuery);
        const expiry = querySigning
          ? resolve(auth.expiresIn ?? "900").trim()
          : "900";
        if (
          querySigning &&
          (!/^\d+$/.test(expiry) || Number(expiry) < 1 || Number(expiry) > 604800)
        )
          throw new Error("AWS query signing expiry must be 1–604800 seconds.");
        aws = {
          ...Object.fromEntries(
            [
              "accessKeyId",
              "secretAccessKey",
              "sessionToken",
              "region",
              "service",
            ].map((key) => [key, resolve(auth[key])]),
          ),
          addAuthDataToQuery: querySigning,
          expiresIn: querySigning ? Number(expiry) : 900,
        };
        break;
      case "hawk":
        if (!manualAuthorization)
          hawk = prepareHawk(
            auth,
            protocol === "websocket" ? {} : request.body || {},
            headers,
            resolve,
          );
        break;
      case "netrc":
        netrc = true;
        break;
      case "ntlm":
        if (!manualAuthorization)
          ntlm = Object.fromEntries(
            ["username", "password", "domain", "workstation"].map((key) => [
              key,
              resolve(auth[key]),
            ]),
          );
        break;
      case "asap":
        if (!manualAuthorization) asap = prepareAsap(auth, resolve);
        break;
      case "apikey":
        if (
          auth.addTo &&
          !["header", "queryParams", "cookie"].includes(auth.addTo)
        )
          throw new Error(
            `API key destination “${auth.addTo}” has not been migrated yet.`,
          );
        if (auth.addTo === "queryParams") {
          if (!legacyQuery || orderedQuery) {
            const name = resolve(auth.key);
            const value = resolve(auth.value);
            const query = legacyQuery
              ? smartEncodeQueryString(
                  buildQueryParameter({ name, value }),
                  encodeUrl,
                )
              : new URLSearchParams([[name, value]]).toString();
            if (query) url.search += (url.search ? "&" : "?") + query;
          }
        } else if (!manualAuthorization) {
          if (auth.addTo === "cookie") {
            // Cookie is an explicit header, separate from the collection jar.
            // Combine existing header fields with semicolons, preserving pair order.
            const values = headers
              .filter(([name]) => name.toLowerCase() === "cookie")
              .map(([, value]) => value);
            values.push(`${resolve(auth.key)}=${resolve(auth.value)}`);
            setHeader("Cookie", values.filter(Boolean).join("; "));
          } else headers.push([resolve(auth.key), resolve(auth.value)]);
        }
        break;
      default:
        throw new Error(
          `Authentication “${auth.type}” has not been migrated yet. Choose a supported authentication method explicitly.`,
        );
    }
  }
  const body = request.body ?? {};
  let text = null;
  let multipart = null;
  let multipartContentType = null;
  let bodyBase64 = null;
  const mime = protocol === "websocket" ? "" : body.mimeType || "";
  if (mime === "multipart/form-data") assertMultipartHeaderFiles(body);
  if (mime && body._openapiSerialization?.style === "serialized") {
    text = serializeOpenApiSerialized(
      "body",
      resolve(body.text ?? ""),
      body._openapiSerialization,
      "body",
    );
    if (!headers.some(([name]) => name.toLowerCase() === "content-type"))
      headers.push(["Content-Type", mime]);
  } else if (isBinaryBody(body) && body.curlQuery !== true) {
    if (body._legacyFileAssetError) throw new Error(`Imported binary file is invalid: ${body._legacyFileAssetError}. Select the file again.`);
    if (body.curlSegments)
      bodyBase64 = encodeBase64(composeCurlBody(body, resolve));
    else {
      if (typeof body.base64 !== "string")
        throw new Error("Select a binary file before sending");
      bodyBase64 = body.base64;
    }
    if (mime && body.curlFileMode !== "upload-file" && !headers.some(([name]) => name.toLowerCase() === "content-type"))
      headers.push(["Content-Type", mime]);
  } else if (mime === "application/graphql") {
    const graphql = readGraphqlBody(body.text || "{}");
    const variables = JSON.parse(
      resolve(
        typeof graphql.variables === "string"
          ? graphql.variables || "{}"
          : JSON.stringify(graphql.variables ?? {}),
      ),
    );
    if (!variables || typeof variables !== "object" || Array.isArray(variables))
      throw new Error("GraphQL variables must be a JSON object.");
    const payload = {
      query: resolve(graphql.query || ""),
      variables,
      ...(graphql.operationName
        ? { operationName: resolve(graphql.operationName) }
        : {}),
      ...(graphql.extensions
        ? {
            extensions: JSON.parse(resolve(JSON.stringify(graphql.extensions))),
          }
        : {}),
    };
    if ((request.method || "GET").toUpperCase() === "GET") {
      for (const name of ["query", "variables", "operationName", "extensions"])
        url.searchParams.delete(name);
      url.searchParams.set("query", payload.query);
      url.searchParams.set("variables", JSON.stringify(payload.variables));
      if (payload.operationName)
        url.searchParams.set("operationName", payload.operationName);
      if (payload.extensions)
        url.searchParams.set("extensions", JSON.stringify(payload.extensions));
    } else text = JSON.stringify(payload);
    setHeader("Content-Type", "application/json");
    if (!headers.some(([name]) => name.toLowerCase() === "accept"))
      headers.push([
        "Accept",
        "application/graphql-response+json, application/json",
      ]);
  } else if (mime === "application/x-www-form-urlencoded") {
    text = (body.params ?? [])
      .filter((/** @type {any} */ p) => !p.disabled && (p.name || p._harExplicitPart === true))
      .map((/** @type {any} */ p) =>
        p._openapiSerialization?.formBody
          ? serializeOpenApiForm(
              resolve(p.name),
              resolve(p.value),
              p._openapiSerialization,
            )
          : new URLSearchParams([
              [resolve(p.name), resolve(p.value)],
            ]).toString(),
      )
      .filter(Boolean)
      .join("&");
    if (!headers.some(([name]) => name.toLowerCase() === "content-type"))
      headers.push(["Content-Type", mime]);
  } else if (mime === "multipart/form-data" && body._curlMultipart === true) {
    let partCount = 0;
    const ancestors = new Set();
    /** @param {any[]} rows @param {number} depth @returns {import('./curl-multipart.js').CurlPart[]} */
    function prepareParts(rows, depth) {
      if (depth > 40 || ancestors.has(rows)) throw new Error("Multipart nesting exceeds MIME limits.");
      ancestors.add(rows);
      const result = rows.filter(p => !p.disabled).map(p => {
        if (++partCount > 10000) throw new Error("Multipart exceeds part limits.");
        const common = {
          name: p.name == null ? null : resolve(p.name),
          headers: resolve(p.partHeaders ?? ""),
          contentType: p.contentTypeOverride ? resolve(p.contentTypeOverride) : null,
        };
        if (p.type === "multipart") {
          if (!Array.isArray(p.params)) throw new Error("Invalid multipart group.");
          return { ...common, params: prepareParts(p.params, depth + 1) };
        }
        const file = p.type === "file";
        if (file && typeof p.base64 !== "string")
          throw new Error(`Select the file again for multipart field “${p.name ?? ""}”`);
        const fileName = file && p.fileContent === true ? null
          : typeof p.fileNameOverride === "string" ? resolve(p.fileNameOverride)
          : file ? p.fileName || "upload.bin" : null;
        let inferredType = curlFileContentType(fileName) ?? (file ? curlFileContentType(p.fileName) : null);
        if (inferredType === "text/plain" && fileName === null) inferredType = null;
        return {
          ...common,
          value: file ? p.base64 : resolve(p.value ?? ""),
          valueBase64: file,
          fileName,
          contentType: common.contentType ?? (multipartHeaders(common.headers,true).some(([name]) => name.toLowerCase() === "content-type") ? null : inferredType ?? (file && p.fileContent !== true ? "application/octet-stream" : null)),
          transferEncoding: p.transferEncoding ?? null,
        };
      });
      ancestors.delete(rows);
      return result;
    }
    const selectedType = headers.find(([name]) => name.toLowerCase() === "content-type")?.[1] ?? null;
    const encoded = curlMultipart(prepareParts(body.params ?? [], 1), selectedType, body._curlFormEscape === true);
    bodyBase64 = encodeBase64(encoded.bytes);
    for (let i = headers.length - 1; i >= 0; i--)
      if (headers[i][0].toLowerCase() === "content-type") headers.splice(i, 1);
    headers.push(["Content-Type", encoded.contentType]);
  } else if (mime === "multipart/form-data") {
    multipart = (body.params ?? [])
      .filter((/** @type {any} */ p) => !p.disabled && (p._harExplicitPart === true || (body._legacyMultipart === true
        ? p.name || p.value || p.fileName || p._legacyFilePath || (p.type === "file" && typeof p.base64 === "string") : p.name)))
      .flatMap((/** @type {any} */ p) => p._openapiSerialization?.style === "swagger"
        ? swaggerArrayValues(resolve(p.name || ""), resolve(p.value || ""), p._openapiSerialization, "formData")
            .map(value => ({...p, value, _openapiSerialization: undefined}))
        : [p])
      .map((/** @type {any} */ p) => {
        const file = p.type === "file" && !(body._legacyMultipart === true && !p.fileName && !p._legacyFilePath && typeof p.base64 !== "string");
        if (file && p._legacyFileAssetError) throw new Error(`Imported file for multipart field “${p.name || ""}” is invalid. Select the file again.`);
        const legacyTextMime = body._legacyMultipart === true && !file
          ? (p.contentType || (typeof p.multiline === "string" ? p.multiline : null))?.replace(/\r\n[ \t]+/g, " ") : null;
        if (file && typeof p.base64 !== "string")
          throw new Error(
            `Select the file again for multipart field “${p.name}”`,
          );
        const transferEncoding = p.transferEncoding ?? null;
        if (transferEncoding !== null && !multipartEncodings.includes(transferEncoding))
          throw new Error("Choose a supported multipart transfer encoding.");
        return {
          name: resolve(p.name || ""),
          headers: multipartHeaders(resolve(p.partHeaders ?? "")),
          transferEncoding,
          value:
            file
              ? p.base64
              : typeof p.fileNameOverride === "string"
                ? encodeBase64(new TextEncoder().encode(resolve(p.value)))
                : resolve(p.value || ""),
          valueBase64: file && p.fileContent === true,
          fileName:
            file && p.fileContent === true
              ? null
              : typeof p.fileNameOverride === "string"
                ? resolve(p.fileNameOverride)
                : file && p.fileContent !== true
                  ? p.fileName || "upload.bin"
                  : null,
          contentType: p.contentTypeOverride
            ? resolve(p.contentTypeOverride)
            : file && p.fileContent === true
              ? null
              : legacyTextMime || p.contentType || null,
        };
      });
    // Native client appends its actual boundary to the selected MIME value.
    multipartContentType=headers.find(([name])=>name.toLowerCase()==='content-type')?.[1]??null;
    for (let i = headers.length - 1; i >= 0; i--)
      if (headers[i][0].toLowerCase() === "content-type") headers.splice(i, 1);
  } else if (mime && body.curlQuery !== true) {
    text = resolve(body.text || "");
    if (!headers.some((h) => h[0].toLowerCase() === "content-type"))
      headers.push(["Content-Type", mime]);
  }
  const uploadRange = request.settingUploadRange;
  if (uploadRange != null && uploadRange !== "") {
    if (typeof uploadRange !== "string") throw new Error("Upload range must be text.");
    const range = resolve(uploadRange);
    if (!range || /[\0\r\n]/.test(range)) throw new Error("Upload range cannot be empty or contain control lines.");
    const suppressed = (request.headers || []).some((/** @type {Record<string,any>} */ h) => String(h.name).toLowerCase() === "content-range" && h._curlSuppressUploadRange === true && h.disabled === true && !h.value);
    if (!multipart && !suppressed && !headers.some(([name]) => name.toLowerCase() === "content-range")) {
      const bytes = bodyBase64 != null ? atob(bodyBase64).length : new TextEncoder().encode(text ?? "").length;
      headers.push(["Content-Range", `bytes ${range}/${bytes}`]);
    }
  }
  const settings = data.settings;
  if (
    !Number.isSafeInteger(Number(settings.timeout)) ||
    settings.timeout === null || settings.timeout === "" || typeof settings.timeout === "boolean" ||
    Number(settings.timeout) < 0 ||
    Number(settings.timeout) > 3600000
  )
    throw new Error("Set a whole-number timeout between 0 and 3,600,000 ms in Preferences (0 = unlimited).");
  const clientCertificates = clientCertificateSelection(
    data,
    request,
    url.toString(),
  );
  return {
    id: runId,
    workspaceId: workspaceFor(data.resources, request._id),
    method: protocol === "websocket" ? "GET" : request.method || "GET",
    url: url.toString(),
    socketPath,
    headers:headers.filter(([name])=>!suppressedDefaults.has(name.toLowerCase())||explicitHeaders.has(name.toLowerCase())),
    suppressDefaultHeaders:[...suppressedDefaults].filter(name=>!explicitHeaders.has(name)),
    autoReferer:typeof request.settingAutoReferer==='boolean'?request.settingAutoReferer:null,
    suppressUserAgent:
      request.suppressUserAgent === true ||
      (request.headers || []).some(
        (/** @type {Record<string,any>} */ h) =>
          String(h.name).toLowerCase() === "user-agent" && h.disabled === true,
      ),
    body: text,
    multipart,
    multipartContentType,
    bodyBase64,
    digest,
    oauth1,
    aws,
    hawk,
    asap,
    ntlm,
    netrc,
    oauth: auth.type === "oauth2" && !auth.disabled && !manualAuthorization,
    httpVersion: selectedHttpVersion(settings, request, url.protocol),
    timeoutMs: Number(settings.timeout),
    ...requestTimeouts(request),
    decodeResponse: request.settingDecodeResponse ?? null,
    maxRedirects: requestRedirectLimit(settings, request),
    followRedirects:
      request.settingFollowRedirects === "on"
        ? true
        : request.settingFollowRedirects === "off"
          ? false
          : settings.followRedirects,
    validateCertificates:
      request.settingValidateCertificates === "on"
        ? true
        : request.settingValidateCertificates === "off"
          ? false
          : settings.validateCertificates,
    useCookies: settings.useCookies,
    cookieSnapshot: request.cookieSnapshot || null,
    sendCookies: request.settingSendCookies !== false,
    storeCookies: request.settingStoreCookies !== false,
    ...requestProxy(settings, request, resolve),
    caPem: settings.caPem || null,
    caFile: collectionCaCertificatePath(data, request),
    caAsset: collectionCaCertificateAsset(data, request),
    clientCertificates,
    identityPem:
      !clientCertificates.length && settings.identityHost === url.hostname
        ? settings.identityPem || null
        : null,
  };
}
/** Read the completed preview response under the same body limit as send_http.
 * @param {Response} response
 * @param {AbortSignal} signal
 */
async function readPreviewBody(response, signal) {
  const limit = 20 * 1024 * 1024;
  signal.throwIfAborted();
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  let bytes = new Uint8Array();
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) return bytes.subarray(0, size);
      const nextSize = size + value.byteLength;
      if (nextSize > limit) {
        throw new Error(
          "Response exceeds the current 20 MiB limit. No partial response was saved.",
        );
      }
      if (nextSize > bytes.length) {
        const grown = new Uint8Array(
          Math.min(limit, Math.max(nextSize, bytes.length * 2, 65536)),
        );
        grown.set(bytes.subarray(0, size));
        bytes = grown;
      }
      bytes.set(value, size);
      size = nextSize;
    }
  } catch (error) {
    // Do not let network cleanup delay reporting the original failure.
    void reader.cancel(error).catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

/** @param {Record<string, any>} request @param {AbortSignal} signal @returns {Promise<Record<string,any>>} */
export async function send(request, signal) {
  signal.throwIfAborted();
  if (isTauri()) {
    const cancellation = createNativeCancellation(request.id, signal);
    const onStarted = new Channel();
    onStarted.onmessage = cancellation.started;
    /** @type {Record<string,any>} */ let result;
    try {
      const response=/** @type {Record<string,any>} */(await invoke("send_http", { request, onStarted }));
      result = {...response,body:responseBodyText(response)};
    } catch (/** @type {any} */ error) {
      // Native failures arrive as { message, networkLog }; keep the log.
      if (error && typeof error === "object" && "message" in error)
        throw new NetworkError(
          String(error.message),
          Array.isArray(error.networkLog) ? error.networkLog : [],
        );
      throw error;
    } finally {
      await cancellation.close();
    }
    signal.throwIfAborted();
    return result;
  }
  if (request.httpVersion)
    throw new Error("HTTP version selection requires the desktop app.");
  if (request.socketPath)
    throw new Error("Unix socket requests require the desktop app.");
  if (request.proxyOverride)
    throw new Error("Explicit proxy settings require the desktop app.");
  if (request.connectTimeoutMs != null)
    throw new Error("Connection timeout overrides require the desktop app.");
  if (request.decodeResponse != null)
    throw new Error("Explicit response decompression settings require the desktop app.");
  if (request.caFile || request.caAsset || request.caPem || request.identityPem || request.clientCertificates?.length)
    throw new Error("Custom CA and client certificates require the desktop app.");
  if (request.digest)
    throw new Error("Digest authentication requires the desktop app.");
  if (request.oauth1)
    throw new Error("OAuth1 signing requires the desktop app.");
  if (request.aws) throw new Error("AWS IAM signing requires the desktop app.");
  if (request.hawk) throw new Error("Hawk signing requires the desktop app.");
  if (request.netrc)
    throw new Error("Netrc authentication requires the desktop app.");
  if (request.ntlm)
    throw new Error("NTLM authentication requires the desktop app.");
  if (request.asap) throw new Error("ASAP signing requires the desktop app.");
  if (request.oauth)
    throw new Error("OAuth authentication requires the desktop app.");
  if (
    request.headers.some(
      (/** @type {string[]} */ h) => h[0].toLowerCase() === "cookie",
    )
  )
    throw new Error(
      "Explicit Cookie headers and API-key Cookie authentication require the desktop app. Browser preview cannot send them reliably.",
    );
  if (
    request.suppressUserAgent &&
    !request.headers.some(
      (/** @type {string[]} */ h) => h[0].toLowerCase() === "user-agent",
    )
  )
    throw new Error(
      "Suppressing the default User-Agent requires the desktop app. Browser preview controls its own User-Agent.",
    );
  if (request.followRedirects && request.maxRedirects != null)
    throw new Error("A custom redirect limit requires the desktop application.");
  // Browser preview is explicitly separate; desktop always uses native HTTP.
  const started = performance.now();
  /** @type {BodyInit | null} */
  let body = request.body;
  if (request.multipart) {
    const form = new FormData();
    for (const p of request.multipart) {
      if (p.headers?.length || p.transferEncoding)
        throw new Error("Custom multipart headers and transfer encoding require the desktop application.");
      if (p.valueBase64 && p.fileName === null)
        throw new Error(
          "File-content multipart fields require the desktop app to preserve exact bytes.",
        );
      if (p.fileName !== null)
        form.append(
          p.name,
          new Blob([Uint8Array.from(atob(p.value), (c) => c.charCodeAt(0))], {
            type: p.contentType || "application/octet-stream",
          }),
          p.fileName,
        );
      else {
        if (p.contentType)
          throw new Error(
            "Custom Content-Type on text multipart fields requires the desktop app.",
          );
        form.append(p.name, p.value);
      }
    }
    body = form;
  } else if (typeof request.bodyBase64 === "string")
    body = Uint8Array.from(atob(request.bodyBase64), (c) => c.charCodeAt(0));
  const timeoutMs = request.requestTimeoutMs ?? request.timeoutMs;
  const fetchSignal = timeoutMs === 0 ? signal : AbortSignal.any([
    signal, AbortSignal.timeout(timeoutMs),
  ]);
  /** @type {Response} */ let response;
  /** @type {Uint8Array} */ let bytes;
  let headersMs = 0;
  try {
    response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: ["GET", "HEAD"].includes(request.method) ? null : body,
      signal: fetchSignal,
      redirect: request.followRedirects ? "follow" : "manual",
    });
    headersMs = Math.round(performance.now() - started);
    bytes = await readPreviewBody(response, fetchSignal);
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    throw new NetworkError(message, failureLog(request, message));
  }
  const elapsedMs = Math.round(performance.now() - started);
  return {
    status: response.status,
    statusText: response.statusText,
    url: response.url,
    headers: [...response.headers.entries()],
    body: decodeResponseBytes(bytes,response.headers.get("content-type")||""),
    bodyBase64: encodeBase64(bytes),
    size: bytes.byteLength,
    elapsedMs,
    headersMs,
    networkLog: buildNetworkLog({
      method: request.method,
      url: response.url || request.url,
      requestHeaders: request.headers,
      status: response.status,
      statusText: response.statusText,
      headers: [...response.headers.entries()],
      size: bytes.byteLength,
      headersMs,
      elapsedMs,
      note: "Browser preview: DNS, connection and TLS details are not exposed by fetch()",
    }),
  };
}
/** @param {string} id */
export async function cancel(id) {
  if (isTauri()) await invoke("cancel_http", { id });
}
