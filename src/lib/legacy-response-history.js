import { protocolFor } from "./model.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { validateLegacyTimeline } from "./legacy-timeline.js";

const bodyLimit = 20 * 1024 * 1024;
const base64Limit = 4 * Math.ceil(bodyLimit / 3);
const aggregateLimit = 32 * 1024 * 1024;

/** @typedef {{id:string,code:string,message:string,asset?:string}} LegacyResponseDiagnostic */
/** @typedef {{id:string,bodyBase64?:string|null,size?:number,sha256?:string|null,timeline?:unknown[],timelineBase64?:string,timelineSize?:number,timelineSha256?:string,diagnostics?:unknown[]}} LegacyResponseAsset */

/** @param {Record<string,any>} response @param {string} code @param {string} message */
function diagnostic(response, code, message) {
  return { id: String(response._id || ""), code, message };
}

/** Legacy init fills absent compression with __NEEDS_MIGRATION__, migrated to
 * zip (gzip bytes). Explicit null is the sole uncompressed legacy marker.
 * @param {Record<string,any>} response @returns {"raw"|"gzip"|null} */
function compression(response) {
  if (response.bodyCompression === null) return "raw";
  if (
    response.bodyCompression === undefined ||
    response.bodyCompression === "__NEEDS_MIGRATION__" ||
    response.bodyCompression === "zip"
  )
    return "gzip";
  return null;
}

/** @param {Record<string,any>} response @param {Map<string,Record<string,any>>} index @param {"http"|"sse"} expectedProtocol */
function ownerDiagnostic(response, index, expectedProtocol) {
  const request = index.get(response.parentId);
  if (!request)
    return diagnostic(
      response,
      "dangling-request",
      "Legacy response references a missing request; original response metadata is retained.",
    );
  if (request._type !== "request" || protocolFor(request) !== expectedProtocol)
    return diagnostic(
      response,
      "unsupported-protocol",
      "Legacy response history belongs to a different protocol; its protocol adapter is required and original metadata is retained.",
    );
  return null;
}

/** Build read-only native asset requests using EXACT supplied legacy paths.
 * Input IDs/references must already have been remapped together by the importer.
 * No path resolution, I/O, decompression or mutation takes place here.
 * @param {Record<string,any>[]} resources @param {"http"|"sse"} [expectedProtocol] */
export function legacyResponseAssetRequests(
  resources,
  expectedProtocol = "http",
) {
  const index = new Map(resources.map((resource) => [resource._id, resource]));
  /** @type {{id:string,bodyPath:string|null,bodyCompression:"gzip"|"raw",timelinePath:string}[]} */ const entries =
    [];
  /** @type {LegacyResponseDiagnostic[]} */ const diagnostics = [];
  for (const response of resources.filter(
    (resource) => resource._type === "response",
  )) {
    const refusedOwner = ownerDiagnostic(response, index, expectedProtocol);
    if (refusedOwner) {
      diagnostics.push(refusedOwner);
      continue;
    }
    const mode = compression(response);
    if (mode === null) {
      diagnostics.push(
        diagnostic(
          response,
          "unknown-compression",
          "Legacy response body compression is unsupported; original metadata and asset paths are retained.",
        ),
      );
      continue;
    }
    if (typeof response.bodyPath !== "string") {
      diagnostics.push(
        diagnostic(
          response,
          "invalid-body-path",
          "Legacy response body path has an invalid type; no body or history entry was invented.",
        ),
      );
    }
    if (
      response.timelinePath != null &&
      typeof response.timelinePath !== "string"
    ) {
      diagnostics.push(
        diagnostic(
          response,
          "invalid-timeline-path",
          "Legacy response timeline path is invalid; original metadata is retained.",
        ),
      );
    }
    entries.push({
      id: response._id,
      bodyPath: typeof response.bodyPath === "string" ? response.bodyPath : null,
      bodyCompression: mode,
      timelinePath: typeof response.timelinePath === "string" ? response.timelinePath : "",
    });
  }
  return { entries, diagnostics };
}

/** @param {unknown} value */
function nonnegative(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** @param {unknown} value @returns {string} */
function text(value) {
  return typeof value === "string" ? value : "";
}

/** Convert actual decoded native asset bytes into ordinary saved HTTP history.
 * Missing/unreadable bodies are refused, including errors; an explicitly read
 * zero-byte body is valid (including legacy's explicit bodyPath:''). Original response resources are NEVER modified or
 * removed. Raw metadata/timeline survive alongside the current viewer fields.
 * The browser-compatible SHA256 digest is recomputed over bounded decoded bytes
 * and must match the reader/portable digest. Binary bytes remain exact in base64.
 * @param {Record<string,any>[]} resources
 * @param {{entries?:LegacyResponseAsset[],diagnostics?:unknown[]}} assetResults @param {"http"|"sse"} [expectedProtocol] */
export function convertLegacyResponseHistory(
  resources,
  assetResults = {},
  expectedProtocol = "http",
) {
  const requested = legacyResponseAssetRequests(resources, expectedProtocol);
  /** @type {LegacyResponseDiagnostic[]} */ const warnings = [
    ...requested.diagnostics,
  ];
  /** @type {Record<string,any>[]} */ const history = [];
  const responses = new Map(
    resources
      .filter((resource) => resource._type === "response")
      .map((response) => [response._id, response]),
  );
  /** @type {Map<string,LegacyResponseAsset>} */ const assets = new Map();
  const duplicated = new Set();
  for (const asset of assetResults.entries || []) {
    if (assets.has(asset.id)) duplicated.add(asset.id);
    assets.set(asset.id, asset);
  }
  for (const response of responses.values()) {
    const portable = response._legacyResponseAssets;
    if (portable == null) continue;
    if (!portable || typeof portable !== "object" || portable.version !== 1) {
      warnings.push(
        diagnostic(
          response,
          "unsupported-portable-assets",
          "Legacy portable response assets require version 1; original metadata is retained.",
        ),
      );
      continue;
    }
    const supplied = assets.get(response._id);
    if (!supplied || typeof supplied.bodyBase64 !== "string")
      assets.set(response._id, {
        ...portable,
        id: response._id,
        diagnostics: [
          ...(supplied?.diagnostics || []),
          ...(Array.isArray(portable.diagnostics) ? portable.diagnostics : []),
        ],
      });
  }
  // Portable/explicitly supplied bytes are independent of the old absolute file
  // path. Ownership and compression still apply; no filesystem access occurs.
  const requestedIds = new Set(requested.entries.map((entry) => entry.id));
  const ownerIndex = new Map(
    resources.map((resource) => [resource._id, resource]),
  );
  for (const response of responses.values()) {
    if (
      !assets.has(response._id) ||
      requestedIds.has(response._id) ||
      ownerDiagnostic(response, ownerIndex, expectedProtocol) ||
      compression(response) === null
    )
      continue;
    requested.entries.push({
      id: response._id,
      bodyPath: response.bodyPath ?? "",
      bodyCompression: /** @type {"raw"|"gzip"} */ (compression(response)),
      timelinePath: response.timelinePath,
    });
    for (let index = warnings.length - 1; index >= 0; index--)
      if (
        warnings[index].id === response._id &&
        ["invalid-body-path", "invalid-timeline-path"].includes(
          warnings[index].code,
        )
      )
        warnings.splice(index, 1);
  }
  for (const item of assetResults.diagnostics || []) {
    const record =
      item && typeof item === "object"
        ? /** @type {Record<string,any>} */ (item)
        : {};
    warnings.push({
      id: text(record.id),
      code: text(record.code) || "asset-read",
      message: text(record.message) || String(item),
      ...(typeof record.asset === "string" ? { asset: record.asset } : {}),
    });
  }
  requested.entries.sort((left, right) => {
    const a = responses.get(left.id),
      b = responses.get(right.id);
    const aTime = nonnegative(a?.modified)
      ? a?.modified
      : nonnegative(a?.created)
        ? a?.created
        : 0;
    const bTime = nonnegative(b?.modified)
      ? b?.modified
      : nonnegative(b?.created)
        ? b?.created
        : 0;
    return bTime - aTime || (b?.created || 0) - (a?.created || 0);
  });
  let activatedBytes = 0;
  for (const request of requested.entries) {
    const response = responses.get(request.id);
    if (!response) continue;
    const asset = assets.get(request.id);
    if (history.length >= 100) {
      warnings.push(
        diagnostic(
          response,
          "history-candidate-limit",
          "Only the newest 100 response candidates can be activated; remaining raw records and portable assets are retained.",
        ),
      );
      continue;
    }
    for (const item of asset?.diagnostics || []) {
      const record =
        item && typeof item === "object"
          ? /** @type {Record<string,any>} */ (item)
          : {};
      warnings.push({
        ...diagnostic(
          response,
          text(record.code) || "asset-read",
          text(record.message) || String(item),
        ),
        ...(typeof record.asset === "string" ? { asset: record.asset } : {}),
      });
    }
    if (
      !asset ||
      duplicated.has(request.id) ||
      typeof asset.bodyBase64 !== "string"
    ) {
      warnings.push(
        diagnostic(
          response,
          duplicated.has(request.id)
            ? "duplicate-asset-result"
            : "missing-body",
          "Legacy response body was not uniquely and successfully read; metadata remains in resources and no body was invented.",
        ),
      );
      continue;
    }
    let bytes;
    try {
      if (
        asset.bodyBase64.length > base64Limit ||
        !Number.isInteger(asset.size) ||
        /** @type {number} */ (asset.size) < 0 ||
        /** @type {number} */ (asset.size) > bodyLimit
      )
        throw Error(
          "Legacy response body exceeds the 20 MiB decoded-byte limit or has invalid size",
        );
      if (
        activatedBytes + /** @type {number} */ (asset.size) >
        aggregateLimit
      ) {
        warnings.push(
          diagnostic(
            response,
            "aggregate-asset-limit",
            "Legacy response activation exceeds the 32 MiB aggregate decoded body/timeline budget; raw records and portable assets are retained.",
          ),
        );
        continue;
      }
      const binary = atob(asset.bodyBase64);
      if (btoa(binary) !== asset.bodyBase64) throw Error("Noncanonical base64");
      bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      if (
        asset.size !== bytes.byteLength ||
        typeof asset.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/i.test(asset.sha256)
      )
        throw Error("Decoded byte length or reader SHA256 is invalid");
      if (bytesToHex(sha256(bytes)) !== asset.sha256.toLowerCase())
        throw Error("Decoded response body SHA256 mismatch");
    } catch (error) {
      warnings.push(
        diagnostic(
          response,
          "invalid-body-result",
          "Legacy response asset result is invalid: " + String(error),
        ),
      );
      continue;
    }
    if (!nonnegative(response.created)) {
      warnings.push(
        diagnostic(
          response,
          "invalid-created",
          "Legacy response creation time is invalid; no replacement timestamp was invented.",
        ),
      );
      continue;
    }
    const headers = [];
    let invalidHeaders = false;
    if (response.headers !== undefined && !Array.isArray(response.headers))
      invalidHeaders = true;
    for (const header of Array.isArray(response.headers)
      ? response.headers
      : []) {
      if (
        !header ||
        typeof header.name !== "string" ||
        typeof header.value !== "string"
      ) {
        invalidHeaders = true;
        continue;
      }
      headers.push([header.name, header.value]);
    }
    if (invalidHeaders) {
      warnings.push(
        diagnostic(
          response,
          "invalid-headers",
          "Legacy response headers are malformed; ordered duplicate headers could not be converted without loss.",
        ),
      );
      continue;
    }
    if (
      response.environmentId !== undefined &&
      response.environmentId !== null &&
      typeof response.environmentId !== "string"
    ) {
      warnings.push(
        diagnostic(
          response,
          "invalid-environment",
          "Legacy response environment identity is invalid; no Base selection was invented.",
        ),
      );
      continue;
    }
    const validatedTimeline = validateLegacyTimeline(
      asset,
      expectedProtocol === "sse" ? "ndjson" : "json",
    );
    const timeline = validatedTimeline.timeline;
    const timelineBytes = validatedTimeline.byteSize;
    if (validatedTimeline.error) {
      warnings.push({
        ...diagnostic(response, "invalid-timeline", validatedTimeline.error),
        asset: "timeline",
      });
    }
    if (activatedBytes + bytes.byteLength + timelineBytes > aggregateLimit) {
      warnings.push(
        diagnostic(
          response,
          "aggregate-asset-limit",
          "Legacy response activation exceeds the 32 MiB aggregate decoded body/timeline budget; raw records and portable assets are retained.",
        ),
      );
      continue;
    }
    const networkLog = timeline.map((entry) => {
      if (entry && typeof entry === "object") {
        const item = /** @type {Record<string,any>} */ (entry);
        return (
          "[legacy " +
          (nonnegative(item.timestamp) ? item.timestamp : "unknown time") +
          " " +
          text(item.name) +
          "] " +
          text(item.value)
        );
      }
      return "[legacy timeline] " + String(entry);
    });
    const { _legacyResponseAssets: portableCache, ...metadata } = response;
    history.push({
      _id: response._id,
      requestId: response.parentId,
      created: response.created,
      environmentId:
        response.environmentId === null
          ? ""
          : response.environmentId === undefined
            ? "__LEGACY__"
            : response.environmentId,
      status: nonnegative(response.statusCode) ? response.statusCode : 0,
      statusText: text(response.statusMessage),
      httpVersion: text(response.httpVersion),
      contentType: text(response.contentType),
      url: text(response.url),
      headers,
      size: bytes.byteLength,
      bytesRead: nonnegative(response.bytesRead) ? response.bytesRead : 0,
      elapsedMs: nonnegative(response.elapsedTime) ? response.elapsedTime : 0,
      headersMs: 0,
      body: new TextDecoder("utf-8", { fatal: false }).decode(bytes),
      bodyBase64: asset.bodyBase64,
      bodySha256: asset.sha256,
      error: text(response.error),
      networkLog,
      legacyTimeline: timeline,
      legacyTimelineByteSize: timelineBytes,
      ...(validatedTimeline.sha256
        ? { legacyTimelineSha256: validatedTimeline.sha256 }
        : {}),
      legacyResponse: structuredClone(metadata),
      _legacySource: structuredClone(response._legacySource ?? null),
      legacyAsset: {
        bodyPath: request.bodyPath,
        bodyCompression: request.bodyCompression,
        timelinePath: request.timelinePath,
        decodedSha256: asset.sha256,
        headersTimingAvailable: false,
      },
    });
    activatedBytes += bytes.byteLength + timelineBytes;
  }
  history.sort((left, right) => {
    const leftTime = nonnegative(left.legacyResponse.modified)
      ? left.legacyResponse.modified
      : left.created;
    const rightTime = nonnegative(right.legacyResponse.modified)
      ? right.legacyResponse.modified
      : right.created;
    return rightTime - leftTime || right.created - left.created;
  });
  return { history, warnings };
}
