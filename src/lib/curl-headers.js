/** Parse one literal curl header, including supported default suppression.
 * @param {string} value */
export function curlHeader(value) {
  const colon = value.indexOf(":"),
    empty = colon < 0 && value.endsWith(";");
  if (colon < 1 && !empty)
    throw new Error("Invalid cURL header; use Name: value.");
  const name = value.slice(0, empty ? -1 : colon).trim();
  const content = empty ? "" : value.slice(colon + 1).trim();
  if (
    !/^[!#$%&'*+\-.^_\x60|~\da-zA-Z]+$/.test(name) ||
    /[\r\n\0]/.test(content)
  )
    throw new Error("Invalid cURL header name or value.");
  const suppressed = !empty && !content;
  if (
    suppressed &&
    !["user-agent", "accept", "content-type"].includes(name.toLowerCase())
  )
    throw new Error(
      "cURL header suppression is not supported for " +
        name +
        ". Use Name; for an empty header.",
    );
  return {
    name,
    value: content,
    disabled: suppressed,
    ...(suppressed && name.toLowerCase() !== "user-agent"
      ? { _curlSuppressDefault: true }
      : {}),
  };
}

/** @param {Record<string,any>} row */
function headerFingerprint(row) {
  // Encoded metadata must not execute a second copy of header templates.
  return encodeURIComponent(
    JSON.stringify([row.name, row.value, row.disabled ?? false]),
  );
}

/** Track an unchanged option-derived fallback, preserving later manual edits.
 * @param {Record<string,any>} row */
export function curlOptionHeader(row) {
  return {
    ...row,
    _curlOptionDefault: headerFingerprint(row),
  };
}

/** @param {Record<string,any>[]} headers */
export function assertCurlHeaderFiles(headers = []) {
  const pending = (headers ?? []).find(
    (row) => row._curlHeaderFile && !row.disabled,
  );
  if (pending)
    throw new Error(
      "Select the cURL header file “" +
        pending._curlHeaderFile +
        "” before sending.",
    );
}

/** Read only an explicitly selected file. No imported paths or nested files open.
 * @param {File} file */
export async function readCurlHeaderFile(file) {
  if (file.size > 65536)
    throw new Error("cURL header files must be at most 64 KiB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > 65536)
    throw new Error("cURL header files must be at most 64 KiB.");
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    throw new Error("Select a UTF-8 cURL header file.");
  }
  if (/\r(?!\n)/.test(text))
    throw new Error("Use LF or CRLF header-file lines.");
  const lines = text.split(/\r?\n/).filter((line) => line.length);
  if (lines.length > 256)
    throw new Error("cURL header files may contain at most 256 headers.");
  return lines.map((line) => {
    if (/^[ \t]/.test(line))
      throw new Error(
        "Folded header-file lines are not supported. Use one Name: value per line.",
      );
    return { ...curlHeader(line), _curlFromFile: true };
  });
}

/** Replace a reference in argument order and remove overridden option defaults.
 * @param {Record<string,any>[]} rows @param {number} index
 * @param {Record<string,any>[]} headers */
export function resolveCurlHeaderFile(rows, index, headers) {
  if (!rows[index]?._curlHeaderFile)
    throw new Error("The cURL header file reference changed.");
  if (rows.length - 1 + headers.length > 1024)
    throw new Error("Imported headers exceed 1024 rows.");
  const result = [
    ...rows.slice(0, index),
    ...headers,
    ...rows.slice(index + 1),
  ];
  const explicit = new Set(
    result
      .filter(
        (row) =>
          !row._curlHeaderFile &&
          row._curlOptionDefault !== headerFingerprint(row),
      )
      .map((row) => String(row.name).toLowerCase()),
  );
  return result.filter(
    (row) =>
      row._curlOptionDefault !== headerFingerprint(row) ||
      !explicit.has(String(row.name).toLowerCase()),
  );
}

/** Keep an explicit file Referer authoritative over curl's auto-referer option.
 * @param {Record<string,any>} request @param {Record<string,any>[]} headers */
export function curlHeadersPatch(request, headers) {
  return {
    headers,
    ...(request._curlSource &&
    headers.some(
      (row) =>
        row._curlFromFile &&
        !row.disabled &&
        row.name.toLowerCase() === "referer",
    )
      ? { settingAutoReferer: false }
      : {}),
  };
}
