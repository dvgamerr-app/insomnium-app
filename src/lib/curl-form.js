import { multipartHeaders, multipartEncodings } from "./multipart-headers.js";
/** Parse curl's form argument grammar after shell quoting has already been removed.
 * No files are read. Unsupported multipart constructs fail explicitly. */

/** @param {string} source @param {number} start @param {boolean} file */
function word(source, start, file) {
  let index = start;
  while (/[ \t]/.test(source[index] || "")) index++;
  let value = "";
  if (source[index] === '"') {
    index++;
    let closed = false;
    for (; index < source.length; index++) {
      const c = source[index];
      if (c === '"') {
        index++;
        closed = true;
        break;
      }
      if (c === "\\" && ['"', "\\"].includes(source[index + 1])) {
        value += source[++index];
      } else value += c;
    }
    if (!closed) throw new Error("Unclosed quoted cURL multipart value.");
    while (/[ \t]/.test(source[index] || "")) index++;
    if (
      index < source.length &&
      source[index] !== ";" &&
      !(file && source[index] === ",")
    )
      throw new Error("Unexpected text after quoted cURL multipart value.");
  } else {
    const begin = index;
    while (
      index < source.length &&
      source[index] !== ";" &&
      !(file && source[index] === ",")
    )
      index++;
    value = source.slice(begin, index).replace(/[ \t]+$/, "");
  }
  return { value, index };
}

// Curl keeps successive unrecognized semicolon sections inside type= until
// filename=, headers= or encoder= starts another form attribute. Preserve the
// original MIME spelling/spacing; do not interpret a type= parameter as a new
// attribute while a content type is being collected.
/** @param {string} source @param {number} start @param {boolean} file */
function mimeWord(source, start, file) {
  const first = word(source, start, file);
  let index = first.index;
  while (source[index] === ";") {
    let next = index + 1;
    while (/[ \t]/.test(source[next] || "")) next++;
    if (/^(filename|headers|encoder)=/i.test(source.slice(next))) break;
    index = next;
    while (
      index < source.length &&
      source[index] !== ";" &&
      !(file && source[index] === ",")
    )
      index++;
  }
  const value = (first.value + source.slice(first.index, index)).replace(
    /[ \t]+$/,
    "",
  );
  return { value, index };
}

/** Validate the effective type, after curl's later attribute replacements.
 * @param {string} value */
function validateMime(value) {
  if (
    !/^[!#$%&'*+\-.^_\x60|~\da-zA-Z]+\/[!#$%&'*+\-.^_\x60|~\da-zA-Z]+(?:[ \t]*;[ \t]*[!#$%&'*+\-.^_\x60|~\da-zA-Z]+=(?:[!#$%&'*+\-.^_\x60|~\da-zA-Z]+|"(?:[\x20\x21\x23-\x5b\x5d-\x7e]|\\[\x20-\x7e])*"))*$/.test(
      value,
    )
  )
    throw new Error(
      "cURL multipart type requires a valid MIME type and parameters.",
    );
}

/** @param {string} source @param {boolean} literal @returns {Record<string, any>} */
export function parseCurlForm(source, literal = false) {
  const equal = source.indexOf("=");
  if (equal < 1) throw new Error("cURL form fields require name=value.");
  const name = source.slice(0, equal);
  const input = source.slice(equal + 1);
  if (literal) return { name, value: input, type: "text" };
  if (input.startsWith("(") || input === ")")
    throw new Error("cURL nested multipart is not supported yet.");
  const fileContent = input.startsWith("<");
  const file = input.startsWith("@") || fileContent;
  // Only @ uses curl's comma-separated file-list grammar. For <, commas
  // belong to the single content source and its attributes, just as for text.
  const fileList = file && !fileContent;
  const primary = word(input, file ? 1 : 0, fileList);
  /** @type {Record<string, any>} */
  const result = file
    ? { name, type: "file", fileName: primary.value }
    : { name, type: "text", value: primary.value };
  if (file && (!primary.value || primary.value === "-"))
    throw new Error("Select a named multipart file; stdin is not supported.");
  if (fileContent) result.fileContent = true;
  let index = primary.index;
  while (index < input.length) {
    if (input[index] === ",")
      throw new Error(
        "Multiple files in one cURL form field require nested multipart support.",
      );
    index++;
    while (/[ \t]/.test(input[index] || "")) index++;
    const match = /^(type|filename|headers|encoder)=/i.exec(input.slice(index));
    if (!match)
      throw new Error(
        "Unsupported cURL multipart attribute. Supported: type=, filename=, inline headers= and encoder=.",
      );
    const attribute = match[1].toLowerCase();
    const item = (attribute === "type" ? mimeWord : word)(
      input,
      index + match[0].length,
      fileList,
    );
    if (/[\x00-\x1f\x7f]/.test(item.value))
      throw new Error("Invalid control character in multipart metadata.");
    if (attribute === "encoder") {
      result.transferEncoding = item.value.toLowerCase();
    } else if (attribute === "headers") {
      if (item.value.startsWith("@"))
        throw new Error("cURL multipart header files must be replaced with inline headers.");
      result.partHeaders = [result.partHeaders, item.value].filter(Boolean).join("\n");
      multipartHeaders(result.partHeaders);
    } else if (attribute === "type") {
      result.contentTypeOverride = item.value;
    } else if (!fileContent) result.fileNameOverride = item.value;
    index = item.index;
  }
  // curl's get_param_part replaces filename/encoder and any new type after
  // filename/headers/encoder ends the previous MIME value. Headers accumulate.
  // A contiguous ;type= remains a MIME parameter, as collected by mimeWord.
  if (typeof result.contentTypeOverride === "string")
    validateMime(result.contentTypeOverride);
  if (typeof result.transferEncoding === "string" &&
      !multipartEncodings.includes(result.transferEncoding))
    throw new Error("Unsupported cURL multipart encoder.");
  return result;
}
