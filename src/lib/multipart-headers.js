export const multipartEncodings = [
  "binary",
  "8bit",
  "7bit",
  "quoted-printable",
  "base64",
];
/** Parse editable per-part headers; MIME framing remains transport-owned.
 * @param {string} text @param {boolean} [allowFraming] @returns {[string,string][]} */
export function multipartHeaders(text, allowFraming = false) {
  if (typeof text !== "string" || new TextEncoder().encode(text).length > 65536)
    throw new Error("Multipart headers exceed 64 KiB or are not text.");
  /** @type {[string,string][]} */
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const colon = line.indexOf(":");
    const name = line.slice(0, colon);
    const value = line.slice(colon + 1).replace(/^[ \t]+|[ \t]+$/g, "");
    if (
      colon < 1 ||
      !/^[!#$%&'*+\-.^_\x60|~\da-zA-Z]+$/.test(name) ||
      /[\x00-\x08\x0a-\x1f\x7f]/.test(value)
    )
      throw new Error(
        "Invalid multipart header. Use one Name: value per line.",
      );
    if (!allowFraming &&
      [
        "content-disposition",
        "content-type",
        "content-transfer-encoding",
        "content-length",
      ].includes(name.toLowerCase())
    )
      throw new Error(
        "Multipart " +
          name +
          " requires the matching part option; raw overrides are not supported.",
      );
    rows.push([name, value]);
    if (rows.length > 128)
      throw new Error("Multipart headers exceed 128 rows.");
  }
  return rows;
}

/** Read only a user-selected snapshot, never the imported filename. @param {File} file */
export async function readMultipartHeaderFile(file) {
  if (file.size > 65536) throw Error("Multipart header files exceed 64 KiB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > 65536) throw Error("Multipart header files exceed 64 KiB.");
  let text;
  try { text = new TextDecoder("utf-8", {fatal:true, ignoreBOM:true}).decode(bytes); }
  catch { throw Error("Select a UTF-8 multipart header file."); }
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text) || /\r(?!\n)/.test(text))
    throw Error("Invalid multipart header-file control characters.");
  if (text.split("\n").some(line => new TextEncoder().encode(line).length >= 8192))
    throw Error("Multipart header-file lines must be shorter than 8192 bytes.");
  return text;
}

/** Resolve ordered file/inline sources, including folds across file boundaries.
 * @param {Record<string,any>} part @param {number} index @param {string} text */
export function resolveMultipartHeaderFile(part, index, text) {
  const original = part._curlPartHeaderSources;
  if (!Array.isArray(original) || typeof original[index]?.fileName !== "string")
    throw Error("The multipart header file reference changed.");
  const sources = original.map((source,i) => i === index ? {...source,text} : source);
  const bytes = sources.reduce((total,source) => total + new TextEncoder().encode(
    typeof source === "string" ? source : source.text ?? "").length,0);
  if (bytes > 65536) throw Error("Multipart header sources exceed 64 KiB.");
  if (sources.some(source => typeof source !== "string" && typeof source.text !== "string"))
    return {_curlPartHeaderSources:sources};
  /** @type {string[]} */ const lines = [];
  for (const source of sources) {
    if (typeof source === "string") { lines.push(source); continue; }
    for (const raw of source.text.split("\n")) {
      if (raw.startsWith("#")) continue;
      let end = raw.length;
      while (end && /[ \t\r]/.test(raw[end-1])) end--;
      const line = raw.slice(0,end);
      if (!line) continue;
      if (line.startsWith(" ") && lines.length) lines[lines.length-1] += line;
      else lines.push(line);
    }
  }
  const partHeaders = lines.join("\n");
  multipartHeaders(partHeaders,true);
  return {partHeaders,_curlPartHeaderSources:undefined};
}

/** Pending filenames are inert and must refuse before template/helper execution.
 * @param {Record<string,any>|undefined} body */
export function assertMultipartHeaderFiles(body) {
  if (body?.mimeType !== "multipart/form-data") return;
  let count = 0;
  /** @param {any[]} rows @param {number} depth */
  function visit(rows,depth) {
    if (!Array.isArray(rows) || depth > 40) throw Error("Invalid multipart nesting.");
    for (const row of rows) {
      if (++count > 10000) throw Error("Multipart exceeds part limits.");
      if (row.disabled) continue;
      if (row._curlPartHeaderSources != null)
        throw Error("Select all multipart header files before sending.");
      if (row.type === "multipart") visit(row.params,depth+1);
    }
  }
  visit(body.params ?? [],1);
}
