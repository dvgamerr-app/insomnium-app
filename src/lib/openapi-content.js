import { mediaTypeName } from "./media-type.js";

/** RFC8259 application/json recognition for content parameters/form fields.
 * @param {unknown} value */
export function isOpenApiJsonMediaType(value) {
  return mediaTypeName(value) === "application/json";
}

/** Media serialization precedes location encoding; JSON null is a represented value.
 * @param {string} name @param {string} text
 * @param {{mediaType?:string,kind:string,nullable?:boolean,review?:boolean}} options
 * @param {string} location */
export function serializeOpenApiContent(name, text, options, location) {
  if (options.review || !isOpenApiJsonMediaType(options.mediaType))
    throw new Error(
      `Review ${location.toLowerCase()} content serialization for ${name}. Disable this row and supply an explicitly serialized value.`,
    );
  const kind = options.kind === "scalar" ? "scalar-json" : options.kind;
  const expected =
    kind === "json" ? "value" : kind === "scalar-json" ? "scalar" : kind;
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(
      `${location} parameter ${name} requires valid JSON ${expected}.`,
    );
  }
  const valid =
    kind === "json" ||
    (value === null && options.nullable) ||
    (kind === "array" && Array.isArray(value)) ||
    (kind === "object" &&
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)) ||
    (kind === "scalar-json" &&
      ["string", "number", "boolean"].includes(typeof value));
  if (!valid)
    throw new Error(
      `${location} parameter ${name} requires a JSON ${expected}.`,
    );
  // Remove only JSON whitespace outside strings. Re-stringifying parsed values
  // would round large integer lexemes and change explicit string escapes.
  let result = "",
    quoted = false,
    escaped = false;
  for (const char of text) {
    if (quoted) {
      result += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') {
      quoted = true;
      result += char;
    } else if (!/[ \t\r\n]/.test(char)) result += char;
  }
  return result;
}

/** Strict URI data encoding, independent of query/path separators.
 * @param {string} value */
export function encodeOpenApiContent(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase(),
  );
}
