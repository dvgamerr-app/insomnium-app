import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

const FILE_LIMIT = 1024 * 1024;
const TOTAL_LIMIT = 32 * FILE_LIMIT;
const record = (/** @type {any} */ value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const fields = (/** @type {any} */ resource) =>
  resource?._type === "ca_certificate"
    ? ["path"]
    : resource?._type === "client_certificate"
      ? ["cert", "key", "pfx"]
      : [];
const pathValid = (/** @type {any} */ path) =>
  typeof path === "string" &&
  path.length > 0 &&
  path.length <= 4096 &&
  !/[\x00-\x1f\x7f]/.test(path) &&
  !/\{\{|\{%|\{#/.test(path);

/** Validate one encrypted/raw source file; never decrypt keys in the renderer.
 * @param {any} asset @param {any} path */
function verify(asset, path) {
  if (
    !record(asset) ||
    !pathValid(path) ||
    asset.path !== path ||
    !Number.isSafeInteger(asset.size) ||
    asset.size < 0 ||
    asset.size > FILE_LIMIT ||
    typeof asset.base64 !== "string" ||
    asset.base64.length > 4 * Math.ceil(FILE_LIMIT / 3) ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(asset.base64) ||
    !/^[a-f0-9]{64}$/.test(asset.sha256)
  )
    throw new Error("invalid portable certificate metadata");
  const text = atob(asset.base64);
  if (
    text.length !== asset.size ||
    btoa(text) !== asset.base64 ||
    bytesToHex(sha256(Uint8Array.from(text, (c) => c.charCodeAt(0)))) !==
      asset.sha256
  )
    throw new Error("certificate bytes do not match size/SHA256");
  return { path, base64: asset.base64, size: asset.size, sha256: asset.sha256 };
}

/** Native consumes errors only when its existing certificate selection uses a slot.
 * Never silently fall back to an imported path after a failed portable check.
 * @param {any} resource @param {string} field
 * @returns {{path?:string,base64?:string,size?:number,sha256?:string,error?:string}|null} */
export function portableCertificateAsset(resource, field) {
  if (!resource[field]) return null;
  if (resource._legacyCertificateRefusals?.[field])
    return {
      error:
        "Imported certificate material was not admitted by this review. Load fewer files or select this file.",
    };
  const cache = resource._legacyCertificateAssets;
  if (
    cache !== undefined &&
    (!record(cache) || cache.version !== 1 || !record(cache.fields))
  )
    return {
      error:
        "Imported certificate metadata is invalid. Load the certificate files again or select this file.",
    };
  if (cache?.fields?.[field] !== undefined) {
    try {
      return verify(cache.fields[field], resource[field]);
    } catch {
      return {
        error:
          "Imported certificate bytes are invalid. Load the certificate files again or select this file.",
      };
    }
  }
  if (
    resource._legacyCertificateFiles?.paths &&
    Object.hasOwn(resource._legacyCertificateFiles.paths, field)
  )
    return {
      error:
        "Imported certificate file is not loaded. Load the certificate files or select this file.",
    };
  return null;
}

/** Explicit path edits/reselection retire only the affected portable slot.
 * @param {any} resource @param {string} field @param {any} value */
export function certificatePathPatch(resource, field, value) {
  /** @type {Record<string,any>} */ const patch = { [field]: value };
  const refusals = record(resource._legacyCertificateRefusals)
    ? { ...resource._legacyCertificateRefusals }
    : {};
  for (const [key, child] of [
    ["_legacyCertificateAssets", "fields"],
    ["_legacyCertificateFiles", "paths"],
  ]) {
    if (resource[key] === undefined) continue;
    const malformed =
      !record(resource[key]) ||
      resource[key].version !== 1 ||
      !record(resource[key][child]);
    // Resource metadata can be a Svelte proxy. Copy the maps we edit without
    // structuredClone(proxy), and retain sibling payloads without touching them.
    const next = record(resource[key]) ? { ...resource[key] } : { version: 1 };
    next.version = 1;
    next[child] = record(next[child]) ? { ...next[child] } : {};
    delete next[child][field];
    if (malformed && key === "_legacyCertificateAssets")
      for (const sibling of fields(resource))
        if (sibling !== field && resource[sibling])
          refusals[sibling] = "metadata";
    patch[key] = next;
  }
  delete refusals[field];
  if (
    resource._legacyCertificateRefusals !== undefined ||
    Object.keys(refusals).length
  )
    patch._legacyCertificateRefusals = refusals;
  return patch;
}

/** @param {any[]} resources */
function candidates(resources) {
  /** @type {any[]} */ const result = [];
  for (const resource of resources)
    for (const field of fields(resource)) {
      if (
        resource[field] === null ||
        resource[field] === undefined ||
        resource[field] === ""
      )
        continue;
      result.push({
        resource,
        field,
        path: resource[field],
        id: `${resource._id}:${field}`,
        label: `${resource.name || (resource._type === "ca_certificate" ? "CA certificate" : "Client certificate")} ${field}`,
      });
    }
  return result;
}

/** @param {any[]} resources */
export function legacyCertificateAssetRequests(resources) {
  /** @type {{id:string,path:string}[]} */ const entries = [];
  /** @type {string[]} */ const warnings = [];
  for (const item of candidates(resources)) {
    if (item.resource.disabled) continue;
    if (item.resource._legacyCertificateRefusals?.[item.field] === "metadata") {
      warnings.push(`${item.label}: invalid portable metadata was retained; select the file again.`);
      continue;
    }
    const existing = portableCertificateAsset(item.resource, item.field);
    if (existing && !existing.error) continue;
    // An explicit damaged cache is never overwritten by a preview read.
    if (
      item.resource._legacyCertificateAssets !== undefined &&
      (!record(item.resource._legacyCertificateAssets) ||
        item.resource._legacyCertificateAssets.version !== 1 ||
        !record(item.resource._legacyCertificateAssets.fields) ||
        item.resource._legacyCertificateAssets.fields[item.field] !== undefined)
    ) {
      warnings.push(
        `${item.label}: invalid portable data was retained; select the file again.`,
      );
      continue;
    }
    if (
      !pathValid(item.path) ||
      new TextEncoder().encode(item.id).length > 200 ||
      /[\x00-\x1f\x7f]/.test(item.id)
    ) {
      warnings.push(
        `${item.label}: invalid or templated path/asset ID; select the file explicitly.`,
      );
      continue;
    }
    if (entries.length >= 100) {
      warnings.push(
        `${item.label}: only 100 file inputs can be loaded per preview.`,
      );
      continue;
    }
    entries.push({ id: item.id, path: item.path });
  }
  return { entries, warnings };
}

/** Add portable raw bytes to the reviewed copy; source fields/records remain exact.
 * @param {any[]} resources @param {{entries?:any[]}} [assets] */
export function convertLegacyCertificateFiles(resources, assets) {
  const output = structuredClone(resources);
  /** @type {string[]} */ const warnings = [];
  const results = new Map();
  const duplicate = new Set();
  for (const entry of assets?.entries ?? []) {
    if (!record(entry) || typeof entry.id !== "string") continue;
    if (results.has(entry.id)) duplicate.add(entry.id);
    results.set(entry.id, entry);
  }
  let loaded = 0,
    pending = 0,
    aggregate = 0;
  for (const item of candidates(output)) {
    const resource = item.resource;
    // A marker is added even to disabled slots, so enabling cannot authorize a path.
    if (
      !record(resource._legacyCertificateFiles) ||
      !record(resource._legacyCertificateFiles.paths)
    )
      resource._legacyCertificateFiles = { version: 1, paths: {} };
    resource._legacyCertificateFiles.paths[item.field] = item.path;
    if (resource._legacyCertificateRefusals?.[item.field] === "allowance")
      delete resource._legacyCertificateRefusals[item.field];
    const existing = portableCertificateAsset(resource, item.field);
    if (existing && !existing.error) {
      if (aggregate + (existing.size ?? 0) <= TOTAL_LIMIT) {
        aggregate += existing.size ?? 0;
        loaded++;
        continue;
      }
      warnings.push(
        `${item.label}: portable files exceed the 32 MiB preview allowance.`,
      );
      resource._legacyCertificateRefusals = {
        ...resource._legacyCertificateRefusals,
        [item.field]: "allowance",
      };
      if (!resource.disabled) pending++;
      continue;
    }
    if (resource.disabled) continue;
    if (resource._legacyCertificateRefusals?.[item.field]) {
      warnings.push(
        `${item.label}: invalid portable metadata was retained; select the file again.`,
      );
      pending++;
      continue;
    }
    if (
      resource._legacyCertificateAssets !== undefined &&
      (!record(resource._legacyCertificateAssets) ||
        resource._legacyCertificateAssets.version !== 1 ||
        !record(resource._legacyCertificateAssets.fields) ||
        resource._legacyCertificateAssets.fields[item.field] !== undefined)
    ) {
      warnings.push(
        `${item.label}: invalid portable certificate data; select the file again.`,
      );
      pending++;
      continue;
    }
    const entry = results.get(item.id);
    if (!entry || duplicate.has(item.id)) {
      if (assets)
        warnings.push(
          `${item.label}: no unique file result; original path remains pending.`,
        );
      pending++;
      continue;
    }
    try {
      if ((entry.diagnostics?.length ?? 0) > 0)
        throw new Error(
          entry.diagnostics
            .map(
              (/** @type {any} */ row) =>
                row.message || row.code || "file read refused",
            )
            .join("; "),
        );
      const value = verify(
        {
          path: item.path,
          base64: entry.bodyBase64,
          size: entry.size,
          sha256: entry.sha256,
        },
        item.path,
      );
      if (aggregate + value.size > TOTAL_LIMIT)
        throw new Error("files exceed the 32 MiB preview allowance");
      if (!record(resource._legacyCertificateAssets))
        resource._legacyCertificateAssets = { version: 1, fields: {} };
      resource._legacyCertificateAssets.fields[item.field] = value;
      aggregate += value.size;
      loaded++;
    } catch (error) {
      warnings.push(
        `${item.label}: ${String(error)}; original path remains pending.`,
      );
      pending++;
    }
  }
  return { resources: output, warnings, loaded, pending };
}
