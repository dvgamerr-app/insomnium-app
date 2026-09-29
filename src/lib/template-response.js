import { renderResponseFilter } from "./template-response-filter-client.js";
/** Preview reads saved HTTP responses only; it never resends dependencies.
 * @param {Record<string, any>[]} resources
 * @param {Record<string, any>[]} history
 * @param {string | null | undefined} environmentId
 * @param {any[]} args
 * @param {AbortSignal} [signal]
 */
export function responseTemplatePreview(
  resources,
  history,
  environmentId,
  args,
  signal,
) {
  validateResponseReference(resources, args);
  return readTemplateResponse(
    latestTemplateResponse(history, args[1], environmentId),
    args,
    signal,
  );
}

/** @param {Record<string,any>[]} resources @param {any[]} args */
export function validateResponseReference(resources, args) {
  const [field, id, filter] = args;
  if (!["body", "header", "raw", "url"].includes(field))
    throw new Error("Invalid response field " + field);
  if (!id) throw new Error("No request specified");
  if (
    !resources.some(
      (resource) => resource._id === id && resource._type === "request",
    )
  )
    throw new Error("Could not find request " + id);
}

/** @param {Record<string,any>[]} history @param {string} id @param {string|null|undefined} environmentId */
export function latestTemplateResponse(history, id, environmentId) {
  return history
    .filter(
      (entry) =>
        entry.requestId === id &&
        (!entry.protocol || entry.protocol === "http") &&
        Object.hasOwn(entry, "environmentId") &&
        (entry.environmentId || null) === (environmentId || null),
    )
    .sort((a, b) => b.created - a.created)[0];
}

/** @param {Record<string,any>|undefined} response @param {any[]} args @param {AbortSignal} [signal] */
export function readTemplateResponse(response, args, signal) {
  signal?.throwIfAborted();
  const [field, , filter] = args;
  if (!response)
    throw new Error(
      "No responses for request in this environment. Send it again if history predates environment tracking.",
    );
  if (response.error)
    throw new Error("Failed to send dependent request " + response.error);
  if (!response.status) throw new Error("No successful responses for request");
  if (field === "url") return response.url;
  if (field === "header") {
    if (!filter || typeof filter !== "string")
      throw new Error("No header filter specified");
    const headers = response.headers || [];
    if (!headers.length) throw new Error("No headers available");
    const header = headers.find(
      (/** @type {string[]} */ row) =>
        row[0].toLowerCase() === filter.trim().toLowerCase(),
    );
    if (!header)
      throw new Error("No header with name " + JSON.stringify(filter.trim()));
    return header[1];
  }
  if (field === "body") {
    if (typeof filter !== "string" || !filter.trim())
      throw new Error("No body filter specified");
    return renderResponseFilter(decodeResponseBody(response), filter, signal);
  }
  return decodeResponseBody(response);
}
/** @param {Record<string, any>} response */
export function decodeResponseBody(response) {
  if (typeof response.bodyBase64 !== "string") {
    if (typeof response.body !== "string")
      throw new Error("Response body is unavailable");
    if (response.body.length > 20 * 1024 * 1024)
      throw new Error("Response body exceeds 20 Mi characters");
    return response.body;
  }
  if (response.bodyBase64.length > 28 * 1024 * 1024)
    throw new Error("Response body exceeds supported size");
  const bytes = Uint8Array.from(atob(response.bodyBase64), (character) =>
    character.charCodeAt(0),
  );
  if (bytes.length > 20 * 1024 * 1024)
    throw new Error("Response body exceeds 20 MiB");
  const contentType =
    response.headers?.find(
      (/** @type {string[]} */ row) => row[0].toLowerCase() === "content-type",
    )?.[1] || "";
  const charset =
    /charset\s*=\s*["']?([\w-]+)/i.exec(contentType)?.[1] || "utf-8";
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}
