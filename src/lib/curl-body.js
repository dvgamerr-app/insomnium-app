export const maxCurlBodyBytes = 20 * 1024 * 1024;
/** curl appends the basename to directory targets only when no query is present.
 * @param {URL} url @param {Record<string,any>|undefined} body
 * @param {(value:unknown)=>string} resolve */
export function appendCurlUploadName(url, body, resolve) {
  if (
    body?.curlFileMode !== "upload-file" ||
    !url.pathname.endsWith("/") ||
    url.search
  )
    return;
  const name = resolve(body.fileName).split(/[\\/]/).at(-1) || "";
  if (
    !name ||
    name === "." ||
    name === ".." ||
    name.length > 8192 ||
    /[\x00-\x1f\x7f]/.test(name)
  )
    throw new Error("Select a file with a valid upload filename.");
  url.pathname += encodeURIComponent(name).replace(
    /[!'()*]/g,
    (character) => "%" + character.charCodeAt(0).toString(16).toUpperCase(),
  );
}
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
    const join = segment.curlJoin ?? body.curlJoin;
    if (join != null && !["json", "form"].includes(join))
      throw new Error("Invalid imported cURL body segment separator.");
    const separator = size > 0 && join !== "json";
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
 * @param {string} url @param {Uint8Array} bytes */
export function appendCurlFileQuery(url, bytes) {
  const nul = bytes.indexOf(0);
  if (nul >= 0) bytes = bytes.subarray(0, nul);
  if (bytes.some((value) => value <= 32 || value === 127))
    throw new Error("cURL GET file data contains characters invalid in a URL. Use --data-urlencode.");
  const query = bytes.slice();
  const hex = (/** @type {number} */ b) => b >= 48 && b <= 57 || b >= 65 && b <= 70 || b >= 97 && b <= 102;
  for (let i = 0; i + 2 < query.length; i++)
    if (query[i] === 37 && hex(query[i + 1]) && hex(query[i + 2])) {
      for (let j = 1; j <= 2; j++) if (query[i + j] >= 97) query[i + j] -= 32;
      i += 2;
    }
  const hash = url.indexOf("#");
  const head = hash < 0 ? url : url.slice(0, hash);
  const encoder = new TextEncoder();
  const prefix = encoder.encode(head + (head.includes("?") ? (/[?&]$/.test(head) ? "" : "&") : "?"));
  const suffix = encoder.encode(hash < 0 ? "" : url.slice(hash));
  const result = new Uint8Array(prefix.length + query.length + suffix.length);
  result.set(prefix); result.set(query, prefix.length); result.set(suffix, prefix.length + query.length);
  return result;
}
