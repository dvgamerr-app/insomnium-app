import { id } from "./model.js";
import { xpathNamespaces } from "./xpath-namespaces.js";

/** @param {Record<string, any>[]} resources @param {string} requestId */
export function requestMeta(resources, requestId) {
  return resources.find(
    (r) => r._type === "request_meta" && r.parentId === requestId,
  );
}

/** Preserve imported metadata and legacy history order (up to eleven entries).
 * @param {Record<string, any> | undefined} meta @param {string} requestId @param {string} filter */
export function withResponseFilter(meta, requestId, filter) {
  if (filter.length > 4096)
    throw new Error("Response filter exceeds 4096 characters");
  const history = Array.isArray(meta?.responseFilterHistory)
    ? meta.responseFilterHistory.filter((value) => typeof value === "string")
    : [];
  const recent = history.slice(0, 10);
  const addToHistory = !!filter && !recent.includes(filter);
  if (addToHistory) recent.unshift(filter);
  return {
    ...meta,
    _id: meta?._id || id("reqm"),
    _type: "request_meta",
    parentId: requestId,
    created: meta?.created || Date.now(),
    modified: Date.now(),
    responseFilter: filter,
    responseFilterHistory: addToHistory ? recent : history,
  };
}

/** @param {Record<string,any>|undefined} meta @param {string} requestId @param {unknown} namespaces @returns {Record<string,any>} */
export function withResponseNamespaces(meta, requestId, namespaces) {
  const mappings = xpathNamespaces(namespaces);
  return {
    ...(meta || withResponseFilter(undefined, requestId, "")),
    modified: Date.now(),
    responseXPathNamespaces: mappings,
  };
}
