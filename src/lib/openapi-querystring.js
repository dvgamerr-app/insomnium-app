import {
  encodeOpenApiContent,
  serializeOpenApiContent,
  isOpenApiJsonMediaType,
} from "./openapi-content.js";
import {
  describeOpenApiFormContent,
  describeOpenApiFormStyleItems,
  serializeOpenApiForm,
} from "./openapi-form.js";
import { describeOpenApiValue } from "./openapi-value.js";
import { parseMediaType, isUtf8PlainTextMediaType } from "./media-type.js";

/** Keep only serialization-relevant schema fields; do not persist a dereferenced graph.
 * @param {Record<string,any>} schema */
function fieldSchema(schema = {}) {
  const select = (/** @type {Record<string,any>} */ value) =>
    Object.fromEntries(
      ["type", "nullable", "format", "contentEncoding"]
        .filter((key) => Object.hasOwn(value, key))
        .map((key) => [key, value[key]]),
    );
  return {
    ...select(schema),
    ...(schema.items ? { items: select(schema.items) } : {}),
  };
}

/** @param {Record<string,any>} media @param {string} version */
export function querystringOptions(media, version) {
  return {
    querystring: true,
    style: "content",
    explode: false,
    version,
    formProperties: Object.fromEntries(
      Object.entries(media.schema?.properties || {}).map(([key, value]) => [
        key,
        fieldSchema(value),
      ]),
    ),
    formAdditional:
      typeof media.schema?.additionalProperties === "object"
        ? fieldSchema(media.schema.additionalProperties)
        : {},
    formEncoding: Object.fromEntries(
      Object.entries(media.encoding || {}).map(([key, value]) => [
        key,
        {
          ...Object.fromEntries(
            ["contentType", "style", "explode", "allowReserved"]
              .filter((field) => Object.hasOwn(value, field))
              .map((field) => [field, value[field]]),
          ),
          ...(value.encoding || value.itemEncoding || value.prefixEncoding
            ? { encoding: true }
            : {}),
        },
      ]),
    ),
    ...(media.prefixEncoding || media.itemEncoding ? { review: true } : {}),
  };
}

/** Split already validated compact JSON object members without rounding numeric lexemes.
 * @param {string} text @returns {[string,string][]} */
function members(text) {
  if (text === "{}") return [];
  const result = /** @type {[string,string][]} */ ([]);
  let start = 1,
    colon = -1,
    depth = 0,
    quoted = false,
    escaped = false;
  for (let index = 1; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === "{" || char === "[") depth++;
    else if (char === "]" || (char === "}" && depth)) depth--;
    else if (char === ":" && !depth && colon < 0) colon = index;
    else if (!depth && (char === "," || index === text.length - 1)) {
      result.push([
        JSON.parse(text.slice(start, colon)),
        text.slice(colon + 1, index),
      ]);
      start = index + 1;
      colon = -1;
    }
  }
  if (new Set(result.map(([name]) => name)).size !== result.length)
    throw new Error("Whole query form objects require unique member names.");
  return result;
}

/** @param {string} name @param {string} text @param {Record<string,any> & {kind:string}} options
 * @returns {string|null} null omits a nullable text/form value; empty text represents an empty query. */
export function serializeOpenApiQuerystring(name, text, options) {
  if (options.review)
    throw new Error(
      `Review whole query serialization for ${name}. Disable this row and supply an explicitly serialized query.`,
    );
  if (isOpenApiJsonMediaType(options.mediaType)) {
    const value = serializeOpenApiContent(name, text, options, "Whole query");
    return value === null ? null : encodeOpenApiContent(value);
  }
  if (isUtf8PlainTextMediaType(options.mediaType)) {
    const value = serializeOpenApiContent(name, text, options, "Whole query");
    if (value === null) return null;
    // Preserve query syntax and valid escapes; encode query-invalid URI data.
    return (value.match(/%[\da-f]{2}|[\s\S]/giu) || [])
      .map((char) =>
        /^%[\da-f]{2}$/i.test(char) || /^[\w.~:/?@!$&()*+,;=-]$/.test(char)
          ? char
          : encodeOpenApiContent(char),
      )
      .join("");
  }
  const media = parseMediaType(options.mediaType);
  const charsets = media?.parameters.filter((p) => p.name === "charset") || [];
  if (
    media?.name !== "application/x-www-form-urlencoded" ||
    charsets.length > 1 ||
    (charsets.length === 1 && charsets[0].value.toLowerCase() !== "utf-8")
  )
    throw new Error(
      `Review whole query media encoding for ${name}. Disable this row and supply an explicitly serialized query.`,
    );
  const compact = serializeOpenApiContent(
    name,
    text,
    { ...options, mediaType: "application/json", kind: "object" },
    "Whole query form",
  );
  if (compact === null || compact === "null") return null;
  return members(compact)
    .map(([key, lexeme]) => {
      const schema = Object.hasOwn(options.formProperties || {}, key)
        ? options.formProperties[key]
        : options.formAdditional || {};
      const encoding = Object.hasOwn(options.formEncoding || {}, key)
        ? options.formEncoding[key]
        : {};
      const value = JSON.parse(lexeme);
      if (
        ["style", "explode", "allowReserved"].some((field) =>
          Object.hasOwn(encoding, field),
        )
      ) {
        const descriptor = describeOpenApiValue(value, schema, true);
        const style = encoding.style || "form";
        return serializeOpenApiForm(
          key,
          descriptor.kind === "scalar" &&
            !["number", "boolean"].includes(typeof value)
            ? descriptor.text
            : lexeme,
          {
            style,
            kind: descriptor.kind,
            nullable: descriptor.nullable,
            explode: encoding.explode ?? style === "form",
            allowReserved: encoding.allowReserved,
            ...(Array.isArray(value)
              ? describeOpenApiFormStyleItems(schema)
              : {}),
            ...(style === "deepObject"
              ? { ignoreDeepObjectExplode: true }
              : {}),
            ...(encoding.encoding ||
            encoding.itemEncoding ||
            encoding.prefixEncoding
              ? { review: true }
              : {}),
          },
        );
      }
      const row = describeOpenApiFormContent(
        value,
        schema,
        encoding,
        options.version,
      );
      const serial = row._openapiSerialization;
      if (
        serial.kind === "scalar" &&
        ["number", "boolean"].includes(typeof value)
      )
        serial.kind = "scalar-json";
      return serializeOpenApiForm(
        key,
        serial.kind === "scalar" ? row.value : lexeme,
        serial,
      );
    })
    .filter(Boolean)
    .join("&");
}
