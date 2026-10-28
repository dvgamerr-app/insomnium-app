import { decodeImportText } from "./import-export.js";

export const referenceCountLimit = 32;
export const referenceBytesLimit = 8 * 1024 * 1024;
const documentBytesLimit = 2 * 1024 * 1024;
export const referenceLimitMessage = "Reference files exceed 32 files or 8 MiB.";

/** @param {{name:string, contents:string}[]} files */
export function referenceBudget(files) {
  return { existingCount: files.length, existingBytes: new TextEncoder().encode(JSON.stringify(files)).byteLength };
}

/** Read immutable browser File snapshots under the same limits as the native reader.
 * @param {File[]} files @param {{name:string,contents:string}[]} existing @param {AbortSignal} signal */
export async function readOpenApiFiles(files, existing, signal) {
  const { existingCount, existingBytes } = referenceBudget(existing);
  if (existingCount + files.length > referenceCountLimit)
    throw new Error(referenceLimitMessage);
  let total = existingBytes;
  for (const file of files) {
    if (file.size > documentBytesLimit) throw new Error(`${file.name} exceeds 2 MiB.`);
    total += file.size;
    if (!Number.isSafeInteger(total) || total > referenceBytesLimit) throw new Error(referenceLimitMessage);
  }
  const loaded = [];
  for (const file of files) {
    signal.throwIfAborted();
    const bytes = new Uint8Array(await file.slice(0, file.size + 1).arrayBuffer());
    signal.throwIfAborted();
    if (bytes.length !== file.size) throw new Error("API document changed size while reading; select it again.");
    loaded.push({name:file.name, contents:decodeImportText(bytes, "API document")});
  }
  return loaded;
}
