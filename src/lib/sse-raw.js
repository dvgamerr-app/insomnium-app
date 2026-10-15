import { id } from "./model.js";
const frameLimit = 64 * 1024,
  storedLimit = 8 * 1024 * 1024,
  countLimit = 1000;
const encoder = new TextEncoder();
/** @param {Record<string,any>} frame */
function frameBytes(frame) {
  if (
    typeof frame.data !== "string" ||
    frame.data.length > 4 * Math.ceil(frameLimit / 3) ||
    !Number.isSafeInteger(frame.size) ||
    frame.size < 1 ||
    frame.size > frameLimit ||
    !Number.isSafeInteger(frame.chunk) ||
    frame.chunk < 1 ||
    !Number.isSafeInteger(frame.offset) ||
    frame.offset < 0
  )
    throw Error("Invalid raw SSE frame metadata.");
  const binary = atob(frame.data);
  if (btoa(binary) !== frame.data || binary.length !== frame.size)
    throw Error("Raw SSE frame Base64 or byte count is invalid.");
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
/** @param {Record<string,any>|undefined} previous @param {Record<string,any>} next */
function follows(previous, next) {
  if (
    previous &&
    !(
      next.chunk === previous.chunk &&
      next.offset === previous.offset + previous.size
    ) &&
    !(next.chunk === previous.chunk + 1 && next.offset === 0)
  )
    throw Error("Raw SSE frame sequence has a gap or overlap.");
}
/** Retain raw bytes separately from parsed events. Native frames are acknowledged
 * by connectStream after this synchronous bounded mutation.
 * @param {Record<string,any>} response @param {Record<string,any>} event */
export function appendSseRaw(response, event) {
  frameBytes(event);
  const rows = (response.rawEvents ??= []);
  if (!Array.isArray(rows) || rows.length > countLimit)
    throw Error("Invalid saved raw SSE capture.");
  const last = rows.at(-1);
  follows(last, event);
  if (
    !last &&
    !(response.rawDropped > 0) &&
    (event.chunk !== 1 || event.offset !== 0)
  )
    throw Error("Raw SSE capture must begin at its first byte.");
  const entry = {
    _id: id("raw"),
    created: Date.now(),
    data: event.data,
    size: event.size,
    chunk: event.chunk,
    offset: event.offset,
    byteLength: 0,
  };
  let size = 0;
  do {
    entry.byteLength = size;
    size = encoder.encode(JSON.stringify(entry)).length;
  } while (entry.byteLength !== size);
  let stored = rows.length
    ? response.rawStoredBytes || encoder.encode(JSON.stringify(rows)).length
    : 2;
  stored += entry.byteLength + (rows.length ? 1 : 0);
  rows.push(entry);
  response.rawReceivedBytes = (response.rawReceivedBytes || 0) + event.size;
  response.rawRetainedBytes = (response.rawRetainedBytes || 0) + event.size;
  while (rows.length > countLimit || stored > storedLimit) {
    const old = rows.shift();
    stored -= old.byteLength + (rows.length ? 1 : 0);
    response.rawRetainedBytes -= old.size;
    response.rawDropped = (response.rawDropped || 0) + 1;
  }
  response.rawStoredBytes = stored;
  return entry;
}
/** Validate a bounded persisted capture before allocating/exporting its bytes.
 * Transport fragments are joined BEFORE UTF-8 decoding; split characters survive.
 * @param {Record<string,any>|undefined} response @returns {Uint8Array<ArrayBuffer>} */
export function sseRawBytes(response) {
  const rows = response?.rawEvents ?? [];
  if (!Array.isArray(rows) || rows.length > countLimit)
    throw Error("Raw SSE capture exceeds its saved frame limit.");
  if (encoder.encode(JSON.stringify(rows)).length > storedLimit)
    throw Error("Raw SSE capture exceeds its saved byte limit.");
  const parts = [];
  let size = 0,
    previous;
  for (const row of rows) {
    const bytes = frameBytes(row);
    follows(previous, row);
    if (
      !previous &&
      !(response?.rawDropped > 0) &&
      (row.chunk !== 1 || row.offset !== 0)
    )
      throw Error("Raw SSE capture is missing its beginning.");
    parts.push(bytes);
    size += bytes.length;
    previous = row;
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const bytes of parts) {
    result.set(bytes, offset);
    offset += bytes.length;
  }
  return result;
}
