import { OpenApiNumber } from "./openapi-value.js";
import { parseMediaType, isUtf8PlainTextMediaType } from "./media-type.js";
import { readOpenApiValue } from "./openapi-value.js";

/** JSON content parameters/form fields use UTF-8, including RFC6839 +json types.
 * Wildcard ranges and legacy text/json are not concrete JSON content contracts.
 * @param {unknown} value */
export function isOpenApiJsonMediaType(value) {
  const media = parseMediaType(value);
  if (!media || media.name.includes("*") ||
      (media.name !== "application/json" && !/\/.+\+json$/.test(media.name))) return false;
  const charsets = media.parameters.filter(parameter => parameter.name === "charset");
  return charsets.length === 0 ||
    (charsets.length === 1 && charsets[0].value.toLowerCase() === "utf-8");
}

/** Media serialization precedes location encoding; JSON null is a represented value.
 * @param {string} name @param {string} text
 * @param {{mediaType?:string,kind:string,nullable?:boolean,review?:boolean}} options
 * @param {string} location */
export function serializeOpenApiContent(name, text, options, location) {
  if (!options.review && isUtf8PlainTextMediaType(options.mediaType)) {
    const value = readOpenApiValue(name, text, options, location);
    if (value === null) return null;
    if (typeof value === "object" && !(value instanceof OpenApiNumber))
      throw new Error(
        `${location} parameter ${name} requires scalar text content.`,
      );
    const result =
      value instanceof OpenApiNumber || typeof value === "number" || typeof value === "boolean"
        ? text
        : String(value);
    if (
      location === "Header" &&
      /[\u0000-\u0008\u000a-\u001f\u007f]/.test(result)
    )
      throw new Error(
        `Header parameter ${name} contains invalid control characters.`,
      );
    return result;
  }
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
