import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { protocolFor } from "./model.js";
import { isBinaryBody } from "./binary-body.js";
import { lookupLegacyFileMime } from "./legacy-file-mime.js";

const FILE_LIMIT = 20 * 1024 * 1024;
const AGGREGATE_LIMIT = 32 * 1024 * 1024;
const ENTRY_LIMIT = 100;
const record = (/** @type {any} */ value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Canonical, bounded portable bytes; an explicit empty payload is valid.
 * @param {any} value */
function decoded(value) {
  if (typeof value !== "string" || value.length > 4 * Math.ceil(FILE_LIMIT / 3))
    throw new Error("file exceeds 20 MiB or lacks portable base64");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value))
    throw new Error("file base64 is malformed");
  const text = atob(value);
  if (text.length > FILE_LIMIT || btoa(text) !== value)
    throw new Error("file base64 is noncanonical or exceeds 20 MiB");
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}

/** @param {any} path */
function sourcePath(path) {
  return (
    typeof path === "string" &&
    path.length > 0 &&
    path.length <= 4096 &&
    !/[\x00-\x1f\x7f]/.test(path) &&
    !/\{\{|\{%|\{#/.test(path)
  );
}

/** Exclude transformed cURL bodies and literal non-HTTP endpoints.
 * @param {any} request */
function requestScope(request) {
  const body = request.body;
  if (
    request._curlSource ||
    body?.curlSegments ||
    body?.curlFileMode ||
    body?.curlQuery ||
    (Array.isArray(body?.params) &&
      body.params.some((/** @type {any} */ row) => row?.curlFileMode))
  )
    return "cURL file transforms require the existing selected-file workflow";
  const protocol = protocolFor(request);
  const scheme =
    typeof request.url === "string"
      ? request.url
          .trim()
          .match(/^([a-z][a-z0-9+.-]*):/i)?.[1]
          .toLowerCase()
      : undefined;
  if (!["http", "sse"].includes(protocol) || (scheme && !["http", "https"].includes(scheme)))
    return "non-HTTP request file activation is outside this preview";
  return null;
}

/** Discover without changing imported resources or evaluating templates.
 * @param {any[]} resources */
function discover(resources) {
  /** @type {any[]} */ const candidates = [];
  /** @type {string[]} */ const warnings = [];
  for (const request of resources) {
    if (!record(request) || request._type !== "request") continue;
    const body = request.body;
    if (!record(body)) continue;
    const hasFileInputs =
      isBinaryBody(body) ||
      !!body.fileName ||
      (Array.isArray(body.params) &&
        body.params.some(
          (/** @type {any} */ row) => record(row) && row.type === "file",
        ));
    const excluded = requestScope(request);
    if (excluded) {
      if (hasFileInputs)
        warnings.push(
          `${request.name || request._id}: ${excluded}; original file inputs were preserved.`,
        );
      continue;
    }
    const multipart = body.mimeType === "multipart/form-data";
    const legacyMultipart = multipart && (body._legacyMultipart === true ||
      request._legacySource?.record?.body?.mimeType === "multipart/form-data");
    const raw =
      !multipart &&
      (isBinaryBody(body) ||
        (typeof body.fileName === "string" && body.fileName.length > 0));
    /** @param {any} row @param {number|null} index */
    const add = (row, index) => {
      if (row.disabled) return;
      const id = `${request._id}:${index === null ? "body" : `params:${index}`}`;
      const label = `${request.name || request._id} ${index === null ? "body" : `multipart row ${index + 1}`}`;
      if (
        typeof request._id !== "string" ||
        !request._id ||
        new TextEncoder().encode(id).length > 200 ||
        /[\x00-\x1f\x7f]/.test(id)
      ) {
        warnings.push(`${label}: asset ID is invalid or exceeds 200 bytes.`);
        return;
      }
      const path =
        row._legacyFilePath ?? row._legacyFileAsset?.path ?? row.fileName;
      /** @type {{id:string,requestId:string,index:number|null,path:any,row:any,label:string,portableSize?:number,portableSHA256?:string,refused?:boolean}} */
      const candidate = { id, requestId: request._id, index, path, row, label };
      candidates.push(candidate);
      if (row.base64 !== undefined) {
        try {
          const bytes = decoded(row.base64);
          if (row._legacyFileAsset !== undefined) {
            const metadata = row._legacyFileAsset;
            if (
              !record(metadata) ||
              metadata.version !== 1 ||
              metadata.size !== bytes.length ||
              typeof metadata.sha256 !== "string" ||
              bytesToHex(sha256(bytes)) !== metadata.sha256 ||
              !sourcePath(metadata.path) ||
              metadata.path !== path
            )
              throw new Error(
                "portable file metadata does not match decoded size/SHA256/path",
              );
          }
          candidate.portableSize = bytes.length;
          candidate.portableSHA256 = bytesToHex(sha256(bytes));
        } catch (error) {
          candidate.refused = true;
          warnings.push(
            `${label}: ${String(error)}; portable payload was not replaced.`,
          );
        }
      } else if (!sourcePath(path)) {
        candidate.refused = true;
        warnings.push(
          `${label}: missing, invalid or templated source path; select the file explicitly.`,
        );
      }
    };
    if (raw) add(body, null);
    if (multipart) {
      if (!Array.isArray(body.params)) {
        warnings.push(
          `${request.name || request._id}: malformed multipart params were preserved without activation.`,
        );
        continue;
      }
      body.params.forEach(
        (/** @type {any} */ row, /** @type {number} */ index) => {
          // Legacy file rows without a filename are text, not missing file assets.
          if (
            record(row) &&
            row.type === "file" &&
            !(
              legacyMultipart &&
              !row.fileName &&
              !row._legacyFilePath &&
              row.base64 === undefined
            )
          )
            add(row, index);
        },
      );
    }
  }
  const ids = new Set();
  for (const candidate of candidates) {
    if (ids.has(candidate.id)) {
      for (const other of candidates.filter((row) => row.id === candidate.id))
        other.refused = true;
      warnings.push(
        `${candidate.label}: duplicate asset identity; no file read was requested.`,
      );
    }
    ids.add(candidate.id);
  }
  return { candidates, warnings };
}

/** @param {any[]} resources */
export function legacyRequestAssetRequests(resources) {
  const { candidates, warnings } = discover(resources);
  const pending = candidates.filter((row) => row.portableSize === undefined);
  const readable = pending.filter((row) => !row.refused);
  if (readable.length > ENTRY_LIMIT)
    warnings.push(
      `${readable.length - ENTRY_LIMIT} additional file inputs remain pending; only 100 are read per preview.`,
    );
  return {
    entries: readable
      .slice(0, ENTRY_LIMIT)
      .map(({ id, path, requestId, index }) => ({
        id,
        path,
        requestId,
        index,
      })),
    warnings,
    count: pending.length,
  };
}

/** Activate only verified raw bytes, never modify the original source record.
 * @param {any[]} resources @param {{entries?:any[]}} assets */
export function convertLegacyRequestFiles(resources, assets = { entries: [] }) {
  const attemptedRead = arguments.length > 1;
  const { candidates, warnings } = discover(resources);
  const output = structuredClone(resources);
  const responses = new Map();
  for (const asset of Array.isArray(assets.entries) ? assets.entries : []) {
    if (!record(asset) || typeof asset.id !== "string") continue;
    if (responses.has(asset.id)) responses.set(asset.id, null);
    else responses.set(asset.id, asset);
  }
  /** @type {Map<string,number>} */ const totals = new Map();
  /** @type {Map<string,any>} */ const verified = new Map();
  let considered = 0,
    verifiedBytes = 0;
  for (const item of candidates) {
    if (item.portableSize !== undefined) {
      totals.set(
        item.requestId,
        (totals.get(item.requestId) ?? 0) + item.portableSize,
      );
      continue;
    }
    if (item.refused || considered++ >= ENTRY_LIMIT) continue;
    const asset = responses.get(item.id);
    if (!asset && !attemptedRead) continue;
    try {
      if (!asset) throw new Error("missing or duplicate reader result");
      if (Array.isArray(asset.diagnostics) && asset.diagnostics.length)
        throw new Error(
          asset.diagnostics
            .map((/** @type {any} */ row) => `${row.asset}:${row.code}`)
            .join(", "),
        );
      if (
        !Number.isSafeInteger(asset.size) ||
        asset.size < 0 ||
        asset.size > FILE_LIMIT ||
        verifiedBytes + asset.size > AGGREGATE_LIMIT
      )
        throw new Error("reader result exceeds file or aggregate allowance");
      const bytes = decoded(asset.bodyBase64);
      if (
        !Number.isSafeInteger(asset.size) ||
        asset.size !== bytes.length ||
        typeof asset.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(asset.sha256) ||
        bytesToHex(sha256(bytes)) !== asset.sha256
      )
        throw new Error("reader size/SHA256 does not match exact bytes");
      verifiedBytes += bytes.length;
      verified.set(item.id, asset);
      totals.set(
        item.requestId,
        (totals.get(item.requestId) ?? 0) + bytes.length,
      );
    } catch (error) {
      warnings.push(
        `${item.label}: ${String(error)}; original file input remains pending.`,
      );
    }
  }
  let loaded = 0,
    portableLoaded = 0,
    aggregate = 0;
  const rejectedRequests = new Set();
  for (const item of candidates) {
    const request = output.find(
      (row) => row?._id === item.requestId && row?._type === "request",
    );
    const row =
      item.index === null ? request.body : request.body.params[item.index];
    // A legacy file path wins over text even before activation. Never send the
    // old text/GraphQL/form value while its referenced bytes are unavailable.
    if (item.index === null) row.binary = true;
    if (item.refused && item.row.base64 !== undefined) {
      row._legacyFileAssetError =
        "Invalid portable legacy file bytes or identity; select the file explicitly.";
      continue;
    }
    if (item.portableSize !== undefined) {
      if ((totals.get(item.requestId) ?? 0) > FILE_LIMIT) {
        row._legacyFileAssetError =
          "Total file inputs exceed the 20 MiB request allowance.";
        warnings.push(
          `${item.label}: portable request files exceed 20 MiB; sending is refused.`,
        );
        continue;
      }
      if (item.index === null) row.binary = true;
      if (
        record(request._legacySource) &&
        row._legacyFileAsset === undefined &&
        sourcePath(item.path)
      ) {
        row._legacyFilePath = item.path;
        row.fileName = item.path.split(/[\\/]/).at(-1);
        row._legacyFileAsset = {
          version: 1,
          path: item.path,
          size: item.portableSize,
          sha256: item.portableSHA256,
        };
        if (item.index !== null && !row.contentType && !row.contentTypeOverride)
          row.contentType =
            lookupLegacyFileMime(item.path) || "application/octet-stream";
      }
      portableLoaded++;
      delete row._legacyFileAssetError;
      continue;
    }
    const asset = verified.get(item.id);
    if (!asset) continue;
    if ((totals.get(item.requestId) ?? 0) > FILE_LIMIT) {
      if (!rejectedRequests.has(item.requestId))
        warnings.push(
          `${item.requestId}: total file inputs exceed the 20 MiB request allowance; no new files were activated.`,
        );
      rejectedRequests.add(item.requestId);
      continue;
    }
    if (aggregate + asset.size > AGGREGATE_LIMIT) {
      warnings.push(
        `${item.label}: preview exceeds the 32 MiB aggregate allowance; original file input remains pending.`,
      );
      continue;
    }
    row._legacyFilePath = item.path;
    row.base64 = asset.bodyBase64;
    row.fileName = item.path.split(/[\\/]/).at(-1);
    row._legacyFileAsset = {
      version: 1,
      path: item.path,
      size: asset.size,
      sha256: asset.sha256,
    };
    delete row._legacyFileAssetError;
    if (item.index === null) row.binary = true;
    else if (!row.contentType && !row.contentTypeOverride)
      row.contentType =
        lookupLegacyFileMime(item.path) || "application/octet-stream";
    aggregate += asset.size;
    loaded++;
  }
  for (const request of output) {
    if (
      request?._type === "request" &&
      record(request.body) &&
      request.body.mimeType === "multipart/form-data" &&
      (request.body._legacyMultipart === true || request._legacySource?.record?.body?.mimeType === "multipart/form-data") &&
      !requestScope(request)
    )
      request.body._legacyMultipart = true;
  }
  const pending =
    candidates.filter((row) => row.portableSize === undefined).length - loaded;
  return { resources: output, warnings, loaded, portableLoaded, pending };
}
