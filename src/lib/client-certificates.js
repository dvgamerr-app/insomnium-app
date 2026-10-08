import { parse } from "url";
import { workspaceFor } from "./model.js";

/** Preserve legacy host/port glob matching (paths and schemes do not scope a certificate).
 * @param {string} pattern @param {string} address */
export function certificateHostMatches(pattern, address) {
  if (!pattern || pattern.length > 8192) return false;
  const raw = pattern.trim();
  let substitution = "999999";
  while (raw.includes(substitution)) substitution += "9";
  try {
    const host = parse(
      (raw.includes("://") ? raw : "https://" + raw).replaceAll(
        "*",
        substitution,
      ),
    );
    const request = parse(address, false, true);
    const restore = (/** @type {string|null} */ value) =>
      (value || "").replaceAll(substitution, "*");
    const glob = (/** @type {string} */ value) =>
      new RegExp(
        "^" +
          value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll("\\*", ".*") +
          "$",
      );
    const port = restore(host.port);
    const portMatches = port.includes("*")
      ? glob(port).test(request.port || "")
      : (parseInt(port) || 443) === (parseInt(request.port || "") || 443);
    return (
      portMatches && glob(restore(host.hostname)).test(request.hostname || "")
    );
  } catch {
    return false;
  }
}

/** File paths/passphrase stay in the existing local resource; material is read by native TLS only.
 * @param {Record<string,any>} data @param {Record<string,any>} request @param {string} address */
export function clientCertificateSelection(data, request, address) {
  const collectionId = workspaceFor(data.resources, request._id);
  const selected = data.resources.filter(
    (/** @type {Record<string,any>} */ resource) =>
      resource._type === "client_certificate" &&
      resource.parentId === collectionId &&
      !resource.disabled &&
      certificateHostMatches(String(resource.host || ""), address),
  );
  if (selected.length > 32)
    throw new Error("More than 32 client certificates match this destination.");
  return selected.map((/** @type {Record<string,any>} */ resource) => ({
    cert: resource.cert || null,
    key: resource.key || null,
    pfx: resource.pfx || null,
    passphrase: resource.passphrase || null,
  }));
}

/** @param {Record<string,any>} data @param {Record<string,any>} request */
export function collectionCertificateContext(data, request) {
  const collectionId = workspaceFor(data.resources, request._id);
  return data.resources.filter(
    (/** @type {Record<string,any>} */ resource) =>
      ["client_certificate", "ca_certificate"].includes(resource._type) &&
      resource.parentId === collectionId,
  );
}

/** Legacy singleton selection stays collection-local, including folder requests.
 * Disabled/empty entries use global preferences; selected-file errors are native.
 * @param {Record<string,any>} data @param {Record<string,any>} request */
export function collectionCaCertificatePath(data, request) {
  const collectionId = workspaceFor(data.resources, request._id);
  const certificate = data.resources.find(
    (/** @type {Record<string,any>} */ resource) =>
      resource._type === "ca_certificate" && resource.parentId === collectionId,
  );
  if (!certificate || certificate.disabled || !certificate.path) return null;
  if (typeof certificate.path !== "string")
    throw new Error("Invalid collection CA certificate file path.");
  return certificate.path;
}
