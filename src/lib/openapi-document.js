import { parseDocument, LineCounter } from "yaml";

export const specLimit = 2 * 1024 * 1024;
export const methods = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
];
/** OpenAPI 3.2 description URIs use the declared document identity. API server
 * URLs have a separate retrieval-base rule and must not use this helper.
 * @param {Record<string,any>} document @param {string} retrievalUri */
export function apiDocumentBaseUri(document, retrievalUri) {
  const uri = new URL(
    String(document.openapi || "").startsWith("3.2.") &&
      typeof document.$self === "string"
      ? document.$self
      : retrievalUri,
    retrievalUri,
  );
  // The filesystem identifies complete resources; reference fragments select
  // targets within them and are resolved separately.
  uri.hash = "";
  return uri.href;
}
/** @param {string} text */
export function parseSpec(text) {
  if (new TextEncoder().encode(text).byteLength > specLimit)
    throw new Error("Each specification file is limited to 2 MiB.");
  const lines = new LineCounter();
  const document = parseDocument(text, {
    lineCounter: lines,
    uniqueKeys: true,
  });
  if (document.errors.length)
    throw new Error(document.errors.map((error) => error.message).join("\n"));
  const value = document.toJS({ maxAliasCount: 100 });
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected a JSON/YAML object.");
  // YAML graph aliases may be cyclic; persisted specifications and OpenAPI documents must be JSON-compatible.
  JSON.stringify(value);
  return { value, document, lines };
}

/** @param {unknown} value */
export function previewJson(value) {
  const seen = new WeakSet();
  let nodes = 0;
  return JSON.stringify(
    value,
    (_, item) => {
      if (++nodes > 10000) return "[Preview truncated]";
      if (item && typeof item === "object") {
        if (seen.has(item)) return "[Shared reference]";
        seen.add(item);
      }
      return item;
    },
    2,
  );
}
