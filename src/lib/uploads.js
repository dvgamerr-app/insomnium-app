import { encodeBase64 } from "./transport.js";

export const maxUploadBytes = 20 * 1024 * 1024;
/** @param {File} file */
export async function readUpload(file) {
  if (file.size > maxUploadBytes)
    throw new Error(
      "Files larger than 20 MiB are not supported yet. Select a smaller file.",
    );
  return {
    fileName: file.name,
    contentType: file.type,
    base64: encodeBase64(new Uint8Array(await file.arrayBuffer())),
  };
}
