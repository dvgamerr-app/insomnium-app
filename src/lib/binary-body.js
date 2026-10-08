/** Raw file bodies retain their HTTP media type independently of the editor.
 * Existing octet-stream and cURL file bodies keep their established behavior.
 * @param {Record<string,any>|undefined|null} body */
export function isBinaryBody(body) {
  return body?.binary === true || body?.mimeType === "application/octet-stream";
}
