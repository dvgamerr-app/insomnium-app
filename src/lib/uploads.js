import { encodeBase64 } from "./transport.js";

export const maxUploadBytes = 20 * 1024 * 1024;
/** @param {File} file */
export async function readUpload(file) {
  if (file.size > maxUploadBytes)
    throw new Error(
      "Files larger than 20 MiB are not supported yet. Select a smaller file.",
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > maxUploadBytes)
    throw new Error("File exceeds the 20 MiB upload limit.");
  return {
    fileName: file.name,
    contentType: file.type,
    base64: encodeBase64(bytes),
  };
}

/** Apply the imported cURL file mode to selected bytes, never read the imported path.
 * @param {File} file @param {Record<string, any>} body */
export async function readBodyUpload(file, body) {
  const mode = body.curlFileMode;
  if (mode == null) return readUpload(file);
  if (
    !["data", "data-ascii", "data-binary", "json", "data-urlencode"].includes(
      mode,
    )
  )
    throw new Error(
      "Unsupported imported file mode. Import the command again.",
    );
  const upload = await readUpload(file);
  if (mode === "data-binary" || mode === "json") return upload;
  const binary = atob(upload.base64);
  if (mode === "data" || mode === "data-ascii")
    return { ...upload, base64: btoa(binary.replace(/[\0\r\n]/g, "")) };
  const prefix = body.curlFilePrefix ?? "";
  if (typeof prefix !== "string" || /[^\x21-\x7e]/.test(prefix))
    throw new Error("The cURL form name must already be URL-encoded ASCII.");
  // Encode bytes rather than decoding as UTF-8, preserving arbitrary file contents.
  let length = prefix.length;
  for (let i = 0; i < binary.length; i++) {
    const code = binary.charCodeAt(i);
    length += code === 32 || /[A-Za-z0-9_.~-]/.test(binary[i]) ? 1 : 3;
    if (length > maxUploadBytes)
      throw new Error("Encoded file exceeds the 20 MiB upload limit.");
  }
  if (length > maxUploadBytes)
    throw new Error("Encoded file exceeds the 20 MiB upload limit.");
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (let i = 0; i < prefix.length; i++)
    bytes[offset++] = prefix.charCodeAt(i);
  const hex = "0123456789ABCDEF";
  for (let i = 0; i < binary.length; i++) {
    const code = binary.charCodeAt(i);
    if (code === 32) bytes[offset++] = 43;
    else if (/[A-Za-z0-9_.~-]/.test(binary[i])) bytes[offset++] = code;
    else {
      bytes[offset++] = 37;
      bytes[offset++] = hex.charCodeAt(code >> 4);
      bytes[offset++] = hex.charCodeAt(code & 15);
    }
  }
  return { ...upload, base64: encodeBase64(bytes) };
}

/** A late file read must not update a different request/body or replace a newer selection.
 * @param {string} requestId @param {Record<string,any>} originalBody
 * @param {()=>Record<string,any>} currentRequest @param {()=>boolean} currentSelection
 * @param {File} file */
export async function readCurrentBodyUpload(
  requestId,
  originalBody,
  currentRequest,
  currentSelection,
  file,
) {
  const upload = await readBodyUpload(file, originalBody);
  const current = currentRequest();
  if (
    !currentSelection() ||
    current._id !== requestId ||
    current.body !== originalBody ||
    current.body?.mimeType !== "application/octet-stream"
  )
    throw new Error(
      "The request or file selection changed while reading. Select the file again.",
    );
  return upload;
}
