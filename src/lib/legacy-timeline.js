import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

const limit = 2 * 1024 * 1024;
const encoder = new TextEncoder();
/** JSON object key order is not semantic; native serde maps may reorder keys.
 * @param {any} value @returns {any} */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
/** @param {unknown} rows @returns {Record<string,any>[]} */
function validateRows(rows) {
  if (
    !Array.isArray(rows) ||
    rows.length > 10000 ||
    rows.some(
      (row) =>
        !row ||
        typeof row !== "object" ||
        Array.isArray(row) ||
        typeof row.name !== "string" ||
        typeof row.value !== "string" ||
        typeof row.timestamp !== "number" ||
        !Number.isFinite(row.timestamp) ||
        row.timestamp < 0,
    )
  )
    throw Error(
      "Legacy timeline requires at most 10000 valid name/timestamp/value records.",
    );
  return rows;
}
/** Validate complete raw timeline independently from semantic parsing. Raw bytes
 * remain on the resource cache even when malformed; this function never mutates.
 * @param {Record<string,any>} asset @param {'json'|'ndjson'} format
 * @returns {{timeline:Record<string,any>[],byteSize:number,sha256?:string,error?:string}} */
export function validateLegacyTimeline(asset, format) {
  let byteSize = 0;
  let digest;
  try {
    const raw =
      asset.timelineBase64 !== undefined ||
      asset.timelineSize !== undefined ||
      asset.timelineSha256 !== undefined;
    let rows;
    if (raw) {
      if (
        typeof asset.timelineBase64 !== "string" ||
        asset.timelineBase64.length > 4 * Math.ceil(limit / 3) ||
        !Number.isInteger(asset.timelineSize) ||
        asset.timelineSize < 0 ||
        asset.timelineSize > limit ||
        typeof asset.timelineSha256 !== "string" ||
        !/^[a-f0-9]{64}$/i.test(asset.timelineSha256)
      )
        throw Error("Invalid raw timeline byte metadata or 2 MiB limit.");
      const binary = atob(asset.timelineBase64);
      if (btoa(binary) !== asset.timelineBase64)
        throw Error("Noncanonical raw timeline base64.");
      const bytes = Uint8Array.from(binary, (character) =>
        character.charCodeAt(0),
      );
      digest = bytesToHex(sha256(bytes));
      if (
        bytes.byteLength !== asset.timelineSize ||
        digest !== asset.timelineSha256.toLowerCase()
      )
        throw Error("Raw timeline size or SHA256 mismatch.");
      byteSize = bytes.byteLength;
      const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      rows =
        format === "json"
          ? JSON.parse(source)
          : source
              .split(/\r?\n/)
              .filter((line) => line.trim())
              .map((line, index) => {
                if (index >= 10000)
                  throw Error("Legacy timeline exceeds 10000 rows.");
                return JSON.parse(line);
              });
      validateRows(rows);
      if (
        asset.timeline !== undefined &&
        JSON.stringify(canonical(validateRows(asset.timeline))) !==
          JSON.stringify(canonical(rows))
      )
        throw Error("Semantic timeline disagrees with preserved raw bytes.");
    } else if (asset.timeline !== undefined) {
      rows = validateRows(asset.timeline);
      byteSize = encoder.encode(JSON.stringify(rows)).byteLength;
      if (byteSize > limit) throw Error("Legacy timeline exceeds 2 MiB.");
    } else rows = [];
    return {
      timeline: structuredClone(rows),
      byteSize,
      ...(digest ? { sha256: digest } : {}),
    };
  } catch (error) {
    return {
      timeline: [],
      byteSize,
      ...(digest ? { sha256: digest } : {}),
      error: String(error),
    };
  }
}
