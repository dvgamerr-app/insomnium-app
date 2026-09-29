import { invoke, isTauri } from "@tauri-apps/api/core";
import { environmentFor, render, workspaceFor, protocolFor } from "./model.js";
import { oauthHeader } from "./oauth-model.js";
import { prepareOAuth1 } from "./oauth1-model.js";
import { prepareHawk } from "./hawk-model.js";
import { prepareAsap } from "./asap-model.js";

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
      render(header.name, environment).toLowerCase() === "authorization",
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
  if (request._openapiIssues?.length)
    throw new Error(
      `Review this generated request in Settings before sending:\n${request._openapiIssues.join("\n")}`,
    );
  if (request._migrationIssues?.length)
    throw new Error(request._migrationIssues.join("\n"));
  const url = new URL(resolve(request.url));
  const protocol = protocolFor(request);
  if (protocol === "websocket") {
    if (url.protocol === "http:") url.protocol = "ws:";
    if (url.protocol === "https:") url.protocol = "wss:";
    if (!["ws:", "wss:"].includes(url.protocol))
      throw new Error("Enter a ws:// or wss:// URL");
  } else if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Enter an HTTP or HTTPS URL");
  if (Array.isArray(request.pathParameters)) {
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
  for (const param of request.parameters ?? [])
    if (!param.disabled && (param.name || param.sendEmptyName)) {
      const encoded = new URLSearchParams([
        [resolve(param.name), resolve(param.value)],
      ]).toString();
      const query = param.noValue
        ? encoded.slice(0, encoded.indexOf("="))
        : encoded;
      url.search += (url.search ? "&" : "?") + query;
    }
  /** @type {string[][]} */
  const headers = (request.headers ?? [])
    .filter((/** @type {any} */ h) => !h.disabled && h.name)
    .map((/** @type {any} */ h) => [resolve(h.name), resolve(h.value)]);
  const setHeader = (
    /** @type {string} */ name,
    /** @type {string} */ value,
  ) => {
    for (let i = headers.length - 1; i >= 0; i--)
      if (headers[i][0].toLowerCase() === name.toLowerCase())
        headers.splice(i, 1);
    headers.push([name, value]);
  };
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
          throw new Error("Choose signed headers explicitly in AWS Auth.");
        if (
          auth.addAuthDataToQuery === true ||
          auth.addAuthDataToQuery === "true"
        )
          throw new Error(
            "AWS query signing has not been migrated. Disable query signing in Auth to use signed headers.",
          );
        aws = Object.fromEntries(
          [
            "accessKeyId",
            "secretAccessKey",
            "sessionToken",
            "region",
            "service",
          ].map((key) => [key, resolve(auth[key])]),
        );
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
        if (auth.addTo === "queryParams")
          url.searchParams.append(resolve(auth.key), resolve(auth.value));
        else if (!manualAuthorization) {
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
  let bodyBase64 = null;
  const mime = protocol === "websocket" ? "" : body.mimeType || "";
  if (mime === "application/graphql") {
    const graphql = JSON.parse(body.text || "{}");
    if (!graphql || typeof graphql !== "object" || Array.isArray(graphql))
      throw new Error("GraphQL body must be a JSON object.");
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
    const form = new URLSearchParams();
    for (const p of body.params ?? [])
      if (!p.disabled && p.name) form.append(resolve(p.name), resolve(p.value));
    text = form.toString();
    setHeader("Content-Type", mime);
  } else if (mime === "multipart/form-data") {
    multipart = (body.params ?? [])
      .filter((/** @type {any} */ p) => !p.disabled && p.name)
      .map((/** @type {any} */ p) => {
        if (p.type === "file" && typeof p.base64 !== "string")
          throw new Error(
            `Select the file again for multipart field “${p.name}”`,
          );
        return {
          name: resolve(p.name),
          value: p.type === "file" ? p.base64 : resolve(p.value),
          fileName: p.type === "file" ? p.fileName || "upload.bin" : null,
          contentType: p.contentType || null,
        };
      });
    // Native client supplies the multipart boundary; remove all manual copies.
    for (let i = headers.length - 1; i >= 0; i--)
      if (headers[i][0].toLowerCase() === "content-type") headers.splice(i, 1);
  } else if (mime === "application/octet-stream") {
    if (typeof body.base64 !== "string")
      throw new Error("Select a binary file before sending");
    bodyBase64 = body.base64;
    setHeader("Content-Type", mime);
  } else if (mime) {
    text = resolve(body.text || "");
    if (!headers.some((h) => h[0].toLowerCase() === "content-type"))
      headers.push(["Content-Type", mime]);
  }
  const settings = data.settings;
  if (
    !Number.isFinite(Number(settings.timeout)) ||
    Number(settings.timeout) < 1 ||
    Number(settings.timeout) > 3600000
  )
    throw new Error("Set a timeout between 1 and 3,600,000 ms in Preferences.");
  return {
    id: runId,
    workspaceId: workspaceFor(data.resources, request._id),
    method: protocol === "websocket" ? "GET" : request.method || "GET",
    url: url.toString(),
    headers,
    suppressUserAgent:
      request.suppressUserAgent === true ||
      (request.headers || []).some(
        (/** @type {Record<string,any>} */ h) =>
          String(h.name).toLowerCase() === "user-agent" && h.disabled === true,
      ),
    body: text,
    multipart,
    bodyBase64,
    digest,
    oauth1,
    aws,
    hawk,
    asap,
    ntlm,
    netrc,
    oauth: auth.type === "oauth2" && !auth.disabled && !manualAuthorization,
    timeoutMs: Number(settings.timeout),
    followRedirects:
      request.settingFollowRedirects === "on"
        ? true
        : request.settingFollowRedirects === "off"
          ? false
          : settings.followRedirects,
    validateCertificates: settings.validateCertificates,
    useCookies: settings.useCookies,
    cookieSnapshot: request.cookieSnapshot || null,
    sendCookies: request.settingSendCookies !== false,
    storeCookies: request.settingStoreCookies !== false,
    proxy: settings.proxy || null,
    caPem: settings.caPem || null,
    identityPem:
      settings.identityHost === url.hostname
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

/** @param {Record<string, any>} request @param {AbortSignal} signal */
export async function send(request, signal) {
  if (isTauri()) return invoke("send_http", { request });
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
  // Browser preview is explicitly separate; desktop always uses native HTTP.
  const started = performance.now();
  /** @type {BodyInit | null} */
  let body = request.body;
  if (request.multipart) {
    const form = new FormData();
    for (const p of request.multipart) {
      if (p.fileName)
        form.append(
          p.name,
          new Blob([Uint8Array.from(atob(p.value), (c) => c.charCodeAt(0))], {
            type: p.contentType || "application/octet-stream",
          }),
          p.fileName,
        );
      else form.append(p.name, p.value);
    }
    body = form;
  } else if (typeof request.bodyBase64 === "string")
    body = Uint8Array.from(atob(request.bodyBase64), (c) => c.charCodeAt(0));
  const fetchSignal = AbortSignal.any([
    signal,
    AbortSignal.timeout(request.timeoutMs),
  ]);
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: ["GET", "HEAD"].includes(request.method) ? null : body,
    signal: fetchSignal,
    redirect: request.followRedirects ? "follow" : "manual",
  });
  const headersMs = Math.round(performance.now() - started);
  const bytes = await readPreviewBody(response, fetchSignal);
  return {
    status: response.status,
    statusText: response.statusText,
    url: response.url,
    headers: [...response.headers.entries()],
    body: new TextDecoder().decode(bytes),
    bodyBase64: encodeBase64(bytes),
    size: bytes.byteLength,
    elapsedMs: Math.round(performance.now() - started),
    headersMs,
  };
}
/** @param {string} id */
export async function cancel(id) {
  if (isTauri()) await invoke("cancel_http", { id });
}
