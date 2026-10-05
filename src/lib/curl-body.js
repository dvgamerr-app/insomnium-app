export const maxCurlBodyBytes = 20 * 1024 * 1024;
/** Join already converted file bytes and editable literal segments in argument order.
 * @param {Record<string,any>} body @param {(value:unknown)=>string} resolve */
export function composeCurlBody(body, resolve) {
  if (
    !Array.isArray(body.curlSegments) ||
    !body.curlSegments.length ||
    body.curlSegments.length > 20000
  )
    throw new Error("Invalid imported cURL body segments.");
  /** @type {{bytes:Uint8Array,separator:boolean}[]} */ const chunks = [];
  let size = 0;
  for (const segment of body.curlSegments) {
    if (!segment || !["literal", "file"].includes(segment.type))
      throw new Error("Invalid imported cURL body segment.");
    let bytes;
    if (segment.type === "file") {
      if (typeof segment.base64 !== "string")
        throw new Error(
          "Select the file for cURL body segment “" + segment.fileName + "”.",
        );
      if (segment.base64.length > Math.ceil(maxCurlBodyBytes / 3) * 4)
        throw new Error("Combined cURL body exceeds 20 MiB.");
      const binary = atob(segment.base64);
      bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    } else {
      const value = resolve(segment.value);
      if (value.length > maxCurlBodyBytes)
        throw new Error("Combined cURL body exceeds 20 MiB.");
      bytes = new TextEncoder().encode(value);
    }
    const separator = size > 0 && body.curlJoin !== "json";
    size += bytes.length + (separator ? 1 : 0);
    if (size > maxCurlBodyBytes)
      throw new Error("Combined cURL body exceeds 20 MiB.");
    chunks.push({ bytes, separator });
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const { bytes, separator } of chunks) {
    if (separator) result[offset++] = 38;
    result.set(bytes, offset);
    offset += bytes.length;
  }
  return result;
}

/** Apply curl's C-string query behavior after selected file conversion.
 * @param {URL} url @param {Uint8Array} bytes */
export function appendCurlFileQuery(url, bytes) {
  const nul = bytes.indexOf(0);
  if (nul >= 0) bytes = bytes.subarray(0, nul);
  if (bytes.some((value) => value <= 32 || value === 127))
    throw new Error(
      "cURL GET file data contains characters invalid in a URL. Use --data-urlencode.",
    );
  let query;
  try {
    query = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(
      "Raw non-UTF-8 cURL GET queries require native raw-URL support. Use --data-urlencode.",
    );
  }
  query = query.replace(/%[\da-fA-F]{2}/g, (value) => value.toUpperCase());
  const current = url.toString(),
    hash = current.indexOf("#");
  const head = hash < 0 ? current : current.slice(0, hash);
  return new URL(
    head +
      (head.includes("?") ? (/[?&]$/.test(head) ? "" : "&") : "?") +
      query +
      (hash < 0 ? "" : current.slice(hash)),
  );
}
