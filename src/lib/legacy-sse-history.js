import {
  legacyResponseAssetRequests,
  convertLegacyResponseHistory,
} from "./legacy-response-history.js";

const aggregateLimit = 32 * 1024 * 1024;
const viewerLimit = 8 * 1024 * 1024;
const encoder = new TextEncoder();
/** @param {unknown} value */
const nonnegative = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
/** @param {string} id @param {string} code @param {string} message */
const diagnostic = (id, code, message) => ({ id, code, message });

/** Use shared ownership/path/compression validation for legacy SSE sources.
 * No mutation, file access or decompression occurs here.
 * @param {Record<string,any>[]} resources */
export function legacySseAssetRequests(resources) {
  const requested = legacyResponseAssetRequests(resources, "sse");
  const diagnostics = [...requested.diagnostics];
  const entries = requested.entries
    .filter((entry) => {
      if (!entry.bodyPath) {
        diagnostics.push(
          diagnostic(
            entry.id,
            "invalid-sse-body-path",
            "Legacy SSE requires an explicit nonempty source body path for native reads; independently validated portable bytes may still activate.",
          ),
        );
        if (!entry.timelinePath) return false;
      }
      return true;
    })
    .map((entry) => ({
      ...entry,
      bodyPath: entry.bodyPath || null,
      bodyFormat: "sse-ndjson",
    }));
  return { entries, diagnostics };
}

/** Parse only the archived chunk-log envelope. SSE framing inside data remains
 * untouched, and is never presented as a fabricated parsed SSE event.
 * @param {Uint8Array} bytes */
function rowsFromBytes(bytes) {
  const rows = /** @type {Record<string,any>[]} */ ([]);
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (rows.length >= 10000) throw Error("Legacy SSE log exceeds 10000 rows.");
    const row = JSON.parse(line);
    if (!row || typeof row !== "object" || Array.isArray(row))
      throw Error("Legacy SSE rows must be objects.");
    rows.push(row);
  }
  return rows;
}

/** Shared response validation preserves exact raw bytes/SHA/timeline/metadata;
 * this adapter derives a bounded raw-chunk viewer and original-owner identity.
 * See archived main/network/curl.ts; UTF-8 fatal decoding follows
 * https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/decode .
 * @param {Record<string,any>[]} resources
 * @param {{entries?:(import('./legacy-response-history.js').LegacyResponseAsset & Record<string,any>)[],diagnostics?:unknown[]}} [assetResults]
 * @param {number} [remainingBudget] */
export function convertLegacySseHistory(
  resources,
  assetResults = {},
  remainingBudget = aggregateLimit,
) {
  const requested = legacySseAssetRequests(resources);
  const index = new Map(resources.map((resource) => [resource._id, resource]));
  // Validate each response independently. Rejected NDJSON must not consume a
  // shared converter budget and starve a later valid stream candidate.
  const converted = {
    history: /** @type {Record<string,any>[]} */ ([]),
    warnings:
      /** @type {import('./legacy-response-history.js').LegacyResponseDiagnostic[]} */ ([]),
  };
  for (const response of resources.filter(
    (resource) => resource._type === "response",
  )) {
    const request = index.get(response.parentId);
    const result = convertLegacyResponseHistory(
      request ? [request, response] : [response],
      {
        entries: assetResults.entries?.filter(
          (asset) => asset.id === response._id,
        ),
        diagnostics: assetResults.diagnostics?.filter(
          (item) =>
            item &&
            typeof item === "object" &&
            "id" in item &&
            item.id === response._id,
        ),
      },
      "sse",
    );
    converted.history.push(...result.history);
    converted.warnings.push(...result.warnings);
  }
  converted.history.sort(
    (a, b) =>
      (b.legacyResponse.modified ?? b.created) -
        (a.legacyResponse.modified ?? a.created) || b.created - a.created,
  );
  const warnings = [
    ...converted.warnings,
    ...requested.diagnostics.filter(
      (item) => item.code === "invalid-sse-body-path",
    ),
  ];
  const supplied = new Map(
    (assetResults.entries || []).map((asset) => [asset.id, asset]),
  );
  const history = /** @type {Record<string,any>[]} */ ([]);
  let activatedBytes = 0;
  for (const entry of converted.history) {
    try {
      const response = index.get(entry._id);
      const request = index.get(entry.requestId);
      if (!response || !request)
        throw Error("Legacy SSE response owner is missing.");
      if (history.length >= 100)
        throw Error(
          "Only the newest 100 SSE histories can be activated per preview.",
        );
      const portable = response._legacyResponseAssets;
      const fresh = supplied.get(entry._id);
      const asset = typeof fresh?.bodyBase64 === "string" ? fresh : portable;
      if (portable != null && portable.bodyFormat !== "sse-ndjson")
        throw Error(
          "Portable SSE assets require the explicit sse-ndjson format.",
        );
      if (asset?.bodyFormat != null && asset.bodyFormat !== "sse-ndjson")
        throw Error("Legacy SSE asset format is incompatible.");
      const sourceRequestId =
        request._legacySource?.record?._id ||
        asset?.sourceRequestId ||
        request._id;
      if (
        typeof sourceRequestId !== "string" ||
        !sourceRequestId ||
        (asset?.sourceRequestId != null &&
          asset.sourceRequestId !== sourceRequestId) ||
        (portable?.sourceRequestId != null &&
          portable.sourceRequestId !== sourceRequestId)
      )
        throw Error(
          "Legacy SSE source request provenance is invalid or conflicting.",
        );
      // The shared converter already checked canonical base64, 20 MiB and SHA.
      const binary = atob(entry.bodyBase64);
      const bytes = Uint8Array.from(binary, (character) =>
        character.charCodeAt(0),
      );
      const rows = rowsFromBytes(bytes);
      // NDJSON line order is the transport order. Legacy clock regressions must
      // not reorder raw framing; timestamps remain event metadata only.
      const ids = new Set();
      const events = /** @type {Record<string,any>[]} */ ([]);
      let retainedBytes = 0,
        dropped = 0,
        size = 0;
      for (const row of rows) {
        if (
          typeof row._id !== "string" ||
          !row._id ||
          ids.has(row._id) ||
          row.requestId !== sourceRequestId ||
          !nonnegative(row.timestamp)
        )
          throw Error(
            "Legacy SSE event identity, original owner or timestamp is invalid.",
          );
        ids.add(row._id);
        /** @type {Record<string,any>} */
        const event = {
          ...row,
          _id: entry._id + ":" + row._id,
          requestId: request._id,
          created: row.timestamp,
        };
        if (row.type === "message") {
          if (row.direction !== "INCOMING" || typeof row.data !== "string")
            throw Error("Legacy SSE chunks require INCOMING string data.");
          event.kind = "legacy-sse-chunk";
          event.direction = "received";
          event.format = "text";
          event.size = encoder.encode(row.data).byteLength;
          size += event.size;
        } else if (row.type === "open") event.kind = "open";
        else if (row.type === "close") {
          if (
            !Number.isInteger(row.code) ||
            !nonnegative(row.statusCode) ||
            typeof row.reason !== "string" ||
            typeof row.wasClean !== "boolean"
          )
            throw Error("Legacy SSE close event is invalid.");
          event.kind = "closed";
        } else if (row.type === "error") {
          if (typeof row.message !== "string")
            throw Error("Legacy SSE error event is invalid.");
          event.kind = "error";
        } else
          throw Error(
            "Unsupported legacy SSE event type; raw bytes are retained.",
          );
        event.byteLength = encoder.encode(JSON.stringify(event)).byteLength;
        retainedBytes += event.byteLength;
        events.push(event);
        while (
          events.length > 1 &&
          (events.length > 1000 || retainedBytes > viewerLimit)
        ) {
          retainedBytes -= events.shift()?.byteLength || 0;
          dropped++;
        }
      }
      const timelineBytes = entry.legacyTimelineByteSize ?? 0;
      const cost = bytes.byteLength + timelineBytes;
      if (
        !Number.isFinite(remainingBudget) ||
        remainingBudget < 0 ||
        activatedBytes + cost > Math.min(aggregateLimit, remainingBudget)
      )
        throw Error(
          "Legacy SSE activation exceeds the shared 32 MiB body/log/timeline budget.",
        );
      // Exact NDJSON bytes live once in resource._legacyResponseAssets. History
      // stores derived viewer chunks rather than duplicating the full log body.
      const { body: _rawText, bodyBase64: _rawBase64, ...metadata } = entry;
      history.push({
        ...metadata,
        protocol: "sse",
        connectionState:
          entry.error || rows.at(-1)?.type === "error" ? "error" : "closed",
        events,
        size,
        retainedBytes,
        dropped,
        legacyRawByteSize: bytes.byteLength,
        legacyBodyFormat: "sse-ndjson",
      });
      activatedBytes += cost;
    } catch (error) {
      warnings.push(
        diagnostic(entry._id, "invalid-sse-history", String(error)),
      );
    }
  }
  return { history, warnings };
}
