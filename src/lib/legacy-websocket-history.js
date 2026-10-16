import { validateLegacyTimeline } from "./legacy-timeline.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

const eventLimit = 8 * 1024 * 1024;
const aggregateLimit = 32 * 1024 * 1024;
const encoder = new TextEncoder();
/** @param {unknown} value */
const nonnegative = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
/** @param {Record<string,any>} response @param {string} code @param {string} message */
const diagnostic = (response, code, message) => ({
  id: String(response._id || ""),
  code,
  message,
});
/** @param {Record<string,any>} response */
const invalidTimeline = (response) => diagnostic(response, "invalid-websocket-timeline-path",
  "Legacy WebSocket timeline path is invalid; event log remains eligible and original metadata is retained.");

/** @param {Record<string,any>} response @param {Map<string,Record<string,any>>} index */
function owner(response, index) {
  const request = index.get(response.parentId);
  if (request?._type !== "websocket_request")
    throw Error(
      "Legacy WebSocket history requires an existing WebSocket request owner.",
    );
  return request;
}

/** Exact paths only; the native reader owns scope checks and file access.
 * @param {Record<string,any>[]} resources */
export function legacyWebSocketAssetRequests(resources) {
  const index = new Map(resources.map((resource) => [resource._id, resource]));
  /** @type {{id:string,bodyPath:string,bodyCompression:string,bodyFormat:string,eventLogPath:string|null,timelinePath:string}[]} */ const entries =
    [];
  /** @type {{id:string,code:string,message:string}[]} */ const diagnostics =
    [];
  for (const response of resources.filter(
    (resource) => resource._type === "websocket_response",
  )) {
    try {
      owner(response, index);
      if (typeof response.eventLogPath !== "string") {
        diagnostics.push(diagnostic(response, "invalid-websocket-owner-or-path",
          "Legacy WebSocket event log path is absent or invalid; original metadata is retained."));
        if (typeof response.timelinePath !== "string" || !response.timelinePath) continue;
      }
      if (response.timelinePath != null && typeof response.timelinePath !== "string")
        diagnostics.push(invalidTimeline(response));
      entries.push({
        id: response._id,
        bodyPath: "",
        bodyCompression: "raw",
        bodyFormat: "websocket-ndjson",
        eventLogPath: typeof response.eventLogPath === "string" ? response.eventLogPath : null,
        timelinePath: typeof response.timelinePath === "string" ? response.timelinePath : "",
      });
    } catch (error) {
      diagnostics.push(
        diagnostic(response, "invalid-websocket-owner-or-path", String(error)),
      );
    }
  }
  return { entries, diagnostics };
}

/** @param {Record<string,any>} asset */
function logBytes(asset) {
  if (
    typeof asset.eventLogBase64 !== "string" ||
    asset.eventLogBase64.length > 4 * Math.ceil(eventLimit / 3) ||
    !Number.isInteger(asset.eventLogSize) ||
    asset.eventLogSize < 0 ||
    asset.eventLogSize > eventLimit
  )
    throw Error(
      "WebSocket event log exceeds 8 MiB or has invalid byte metadata.",
    );
  const binary = atob(asset.eventLogBase64);
  if (btoa(binary) !== asset.eventLogBase64)
    throw Error("Noncanonical event log base64.");
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (
    bytes.length !== asset.eventLogSize ||
    typeof asset.eventLogSha256 !== "string" ||
    bytesToHex(sha256(bytes)) !== asset.eventLogSha256.toLowerCase()
  )
    throw Error("WebSocket event log size or SHA256 mismatch.");
  return bytes;
}

/** @param {string} text */
function ndjson(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (rows.length === 10000)
      throw Error("WebSocket event log exceeds 10000 rows.");
    const row = JSON.parse(line);
    if (!row || typeof row !== "object" || Array.isArray(row))
      throw Error("WebSocket event rows must be objects.");
    rows.push(row);
  }
  return rows;
}

/** Keep raw log bytes/provenance on resources; derive only validated viewer data.
 * No connection is opened and no imported script is evaluated.
 * @param {Record<string,any>[]} resources
 * @param {{entries?:Record<string,any>[],diagnostics?:unknown[]}} [assetResults]
 * @param {number} [remainingBytes] */
export function convertLegacyWebSocketHistory(
  resources,
  assetResults = {},
  remainingBytes = aggregateLimit,
) {
  const index = new Map(resources.map((resource) => [resource._id, resource]));
  /** @type {Record<string,any>[]} */ const history = [];
  /** @type {{id:string,code:string,message:string,asset?:string}[]} */ const warnings =
    [];
  const assets = new Map();
  const duplicate = new Set();
  for (const asset of assetResults.entries || []) {
    if (assets.has(asset.id)) duplicate.add(asset.id);
    assets.set(asset.id, asset);
  }
  let activatedBytes = 0;
  const responses = resources
    .filter((resource) => resource._type === "websocket_response")
    .sort(
      (a, b) => (b.modified || b.created || 0) - (a.modified || a.created || 0),
    );
  for (const response of responses) {
    try {
      const request = owner(response, index);
      if (response.timelinePath != null && typeof response.timelinePath !== "string")
        warnings.push(invalidTimeline(response));
      const portable = response._legacyWebSocketAssets;
      if (
        portable != null &&
        (!portable || typeof portable !== "object" || portable.version !== 1)
      )
        throw Error("Portable WebSocket assets require version 1.");
      const supplied = assets.get(response._id);
      const asset =
        typeof supplied?.eventLogBase64 === "string" ? supplied : portable;
      for (const item of [
        ...(supplied?.diagnostics || []),
        ...(portable?.diagnostics || []),
      ])
        warnings.push({
          ...diagnostic(
            response,
            String(item.code || "asset-read"),
            String(item.message || "Legacy WebSocket asset was not read."),
          ),
          ...(item.asset ? { asset: String(item.asset) } : {}),
        });
      if (!asset || duplicate.has(response._id))
        throw Error(
          "WebSocket event log was not uniquely and successfully read; no events were invented.",
        );
      if (history.length >= 100)
        throw Error(
          "Only the newest 100 WebSocket histories can be activated per preview.",
        );
      const bytes = logBytes(asset);
      if (
        !nonnegative(response.created) ||
        (response.environmentId != null &&
          typeof response.environmentId !== "string")
      )
        throw Error(
          "Invalid WebSocket response creation time or environment identity.",
        );
      const sourceRequestId =
        request._legacySource?.record?._id ||
        asset.sourceRequestId ||
        request._id;
      const rows = ndjson(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
      const ids = new Set();
      /** @type {Record<string,any>[]} */ const events = [];
      let retainedBytes = 0,
        size = 0,
        dropped = 0;
      for (const row of rows) {
        if (
          typeof row._id !== "string" ||
          !row._id ||
          ids.has(row._id) ||
          row.requestId !== sourceRequestId ||
          !nonnegative(row.timestamp)
        )
          throw Error(
            "WebSocket event identity, owner or timestamp is invalid.",
          );
        ids.add(row._id);
        const event = {
          ...row,
          _id: response._id + ":" + row._id,
          requestId: request._id,
          created: row.timestamp,
        };
        if (row.type === "open") event.kind = "open";
        else if (row.type === "close") {
          if (
            !Number.isInteger(row.code) ||
            typeof row.reason !== "string" ||
            typeof row.wasClean !== "boolean"
          )
            throw Error("Invalid legacy WebSocket close event.");
          event.kind = "closed";
        } else if (row.type === "error") {
          if (typeof row.message !== "string")
            throw Error("Invalid legacy WebSocket error event.");
          event.kind = "error";
        } else if (row.type === "message") {
          if (!["INCOMING", "OUTGOING"].includes(row.direction))
            throw Error("Invalid legacy message direction.");
          event.kind = "message";
          event.direction = row.direction === "INCOMING" ? "received" : "sent";
          if (typeof row.data === "string") {
            event.format = "text";
            event.size = encoder.encode(row.data).length;
          } else if (
            row.data?.type === "Buffer" &&
            Array.isArray(row.data.data) &&
            row.data.data.every(
              (/** @type {unknown} */ byte) =>
                Number.isInteger(byte) &&
                /** @type {number} */ (byte) >= 0 &&
                /** @type {number} */ (byte) <= 255,
            )
          ) {
            event.format = "binary";
            event.size = row.data.data.length;
            const binary = /** @type {number[]} */ (row.data.data);
            let text = "";
            for (let offset = 0; offset < binary.length; offset += 8192)
              text += String.fromCharCode(
                ...binary.slice(offset, offset + 8192),
              );
            event.data = btoa(text);
          } else throw Error("Invalid legacy WebSocket message bytes.");
          size += event.size;
        } else
          throw Error(
            "Unsupported legacy WebSocket event type; complete original bytes are preserved.",
          );
        event.byteLength = encoder.encode(JSON.stringify(event)).length;
        retainedBytes += event.byteLength;
        events.push(event);
        while (
          events.length > 1 &&
          (events.length > 1000 || retainedBytes > eventLimit)
        ) {
          retainedBytes -= events.shift()?.byteLength || 0;
          dropped++;
        }
      }
      const validatedTimeline = validateLegacyTimeline(asset, "ndjson");
      const timeline = validatedTimeline.timeline;
      const timelineBytes = validatedTimeline.byteSize;
      if (validatedTimeline.error)
        warnings.push({
          ...diagnostic(
            response,
            "invalid-websocket-timeline",
            validatedTimeline.error,
          ),
          asset: "timeline",
        });
      if (
        activatedBytes + bytes.length + timelineBytes >
        Math.min(aggregateLimit, remainingBytes)
      )
        throw Error(
          "WebSocket activation exceeds the 32 MiB aggregate response/log/timeline budget.",
        );
      if (
        !Array.isArray(response.headers) ||
        response.headers.some(
          (/** @type {Record<string,any>} */ header) =>
            !header ||
            typeof header.name !== "string" ||
            typeof header.value !== "string",
        )
      )
        throw Error("Invalid WebSocket handshake headers.");
      const { _legacyWebSocketAssets: _cache, ...metadata } = response;
      history.push({
        _id: response._id,
        requestId: request._id,
        created: response.created,
        environmentId:
          response.environmentId === null
            ? ""
            : (response.environmentId ?? "__LEGACY__"),
        protocol: "websocket",
        connectionState:
          response.error || rows.at(-1)?.type === "error" ? "error" : "closed",
        status: nonnegative(response.statusCode) ? response.statusCode : 0,
        statusText:
          typeof response.statusMessage === "string"
            ? response.statusMessage
            : "",
        elapsedMs: nonnegative(response.elapsedTime) ? response.elapsedTime : 0,
        url: typeof response.url === "string" ? response.url : "",
        headers: response.headers.map(
          (/** @type {Record<string,any>} */ header) => [
            header.name,
            header.value,
          ],
        ),
        error: typeof response.error === "string" ? response.error : "",
        events,
        retainedBytes,
        dropped,
        size,
        legacyTimeline: timeline,
        legacyTimelineByteSize: timelineBytes,
        ...(validatedTimeline.sha256
          ? { legacyTimelineSha256: validatedTimeline.sha256 }
          : {}),
        networkLog: timeline.map(
          (row) =>
            "[legacy " + row.timestamp + " " + row.name + "] " + row.value,
        ),
        legacyResponse: structuredClone(metadata),
        _legacySource: structuredClone(response._legacySource ?? null),
      });
      activatedBytes += bytes.length + timelineBytes;
    } catch (error) {
      warnings.push(
        diagnostic(response, "invalid-websocket-history", String(error)),
      );
    }
  }
  return { history, warnings };
}
