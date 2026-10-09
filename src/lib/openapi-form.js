import { serializeOpenApiStyle } from "./openapi-style.js";
import {
  encodeOpenApiContent,
  serializeOpenApiContent,
  isOpenApiJsonMediaType,
} from "./openapi-content.js";
import { describeOpenApiValue, readOpenApiValue } from "./openapi-value.js";
import { isUtf8PlainTextMediaType } from "./media-type.js";

/** @param {Record<string,any>} property */
function jsonKind(property) {
  const declared = Array.isArray(property.type)
    ? property.type
    : [property.type];
  return declared.includes("object")
    ? "object"
    : declared.includes("array")
      ? "array"
      : declared.some((/** @type {string} */ type) =>
            ["string", "number", "integer", "boolean"].includes(type),
          )
        ? "scalar-json"
        : "json";
}

/** OAS3.2 maps an array property's Encoding Object to each item.
 * @param {Record<string,any>} property */
export function describeOpenApiFormStyleItems(property) {
  const item = property.items || {};
  const types = Array.isArray(item.type) ? item.type : [item.type];
  return {
    formArrayItems: true,
    itemKind: jsonKind(item),
    itemNullable: item.nullable === true || types.includes("null"),
  };
}

/** OAS3.2 applies content encoding per array item; earlier JSON content encodes the whole value.
 * @param {any} value @param {Record<string,any>} schema @param {Record<string,any>} encoding
 * @param {string} [version] */
export function describeOpenApiFormContent(
  value,
  schema,
  encoding,
  version = "3.2.1",
) {
  const legacyFormats = version.startsWith("3.0.");
  const descriptor = describeOpenApiValue(value, schema, true);
  const array = descriptor.kind === "array";
  const itemSchema = array ? schema.items || {} : schema;
  const types = Array.isArray(itemSchema.type)
    ? itemSchema.type
    : [itemSchema.type];
  const type = types.find((/** @type {string} */ type) => type !== "null");
  const binary =
    legacyFormats && ["binary", "byte"].includes(itemSchema.format);
  const mediaType =
    encoding.contentType ||
    (["object", "array"].includes(type)
      ? "application/json"
      : ["string", "number", "integer", "boolean"].includes(type) &&
          !itemSchema.contentEncoding &&
          !binary
        ? "text/plain"
        : "application/octet-stream");
  const json = isOpenApiJsonMediaType(mediaType);
  const text = isUtf8PlainTextMediaType(mediaType);
  const serialization = {
    formBody: true,
    style: "content",
    mediaType,
    kind: array ? "array" : json ? jsonKind(schema) : descriptor.kind,
    ...(descriptor.nullable ? { nullable: true } : {}),
    ...(array && (!json || version.startsWith("3.2."))
      ? {
          formArrayItems: true,
          itemKind: jsonKind(itemSchema),
          itemNullable: itemSchema.nullable === true || types.includes("null"),
        }
      : {}),
    ...(binary ||
    (!json && !text) ||
    (text && ["object", "array"].includes(type)) ||
    itemSchema.contentEncoding ||
    encoding.encoding ||
    encoding.prefixEncoding ||
    encoding.itemEncoding
      ? { review: true }
      : {}),
  };
  return {
    name: "",
    value: json || array ? JSON.stringify(value ?? null) : descriptor.text,
    _openapiSerialization: serialization,
  };
}

/** Split validated compact JSON array text without re-stringifying numeric/escape lexemes.
 * @param {string} text */
function arrayItems(text) {
  if (text === "[]") return [];
  const items = [];
  let start = 1,
    depth = 0,
    quoted = false,
    escaped = false;
  for (let index = 1; index < text.length - 1; index++) {
    const char = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === "[" || char === "{") depth++;
    else if (char === "]" || char === "}") depth--;
    else if (char === "," && depth === 0) {
      items.push(text.slice(start, index));
      start = index + 1;
    }
  }
  items.push(text.slice(start, -1));
  return items;
}

/** @param {string} name @param {string} text @param {Record<string,any>} options */
function serializeFormContent(name, text, options) {
  const json = isOpenApiJsonMediaType(options.mediaType);
  const plainText = isUtf8PlainTextMediaType(options.mediaType);
  const pair = (/** @type {string} */ value) =>
    new URLSearchParams([[name, value]]).toString();
  const serialize = (
    /** @type {string} */ value,
    /** @type {Record<string,any>} */ descriptor,
  ) => {
    if (json)
      return serializeOpenApiContent(
        name,
        value,
        {
          kind: descriptor.kind,
          nullable: descriptor.nullable,
          mediaType: "application/json",
        },
        "Form",
      );
    if (!plainText)
      throw new Error(`Review form content serialization for ${name}.`);
    const parsed = readOpenApiValue(
      name,
      value,
      { kind: descriptor.kind, nullable: descriptor.nullable },
      "Form",
    );
    if (parsed === null) return null;
    if (typeof parsed === "object")
      throw new Error(`Form parameter ${name} requires flat scalar values.`);
    return typeof parsed === "number" || typeof parsed === "boolean"
      ? value
      : String(parsed);
  };
  if (!options.formArrayItems) {
    const value = serialize(text, options);
    return value === null ? "" : pair(value);
  }
  const compact = serializeOpenApiContent(
    name,
    text,
    { ...options, mediaType: "application/json", kind: "array" },
    "Form",
  );
  if (compact === "null") return json ? pair("null") : "";
  return arrayItems(compact)
    .map((item) => {
      const value = serialize(item, {
        kind: plainText ? "scalar-json" : options.itemKind,
        nullable: options.itemNullable,
      });
      return value === null ? "" : pair(value);
    })
    .filter(Boolean)
    .join("&");
}

/** Explicit Encoding Object styles use RFC6570, with form delimiters protected.
 * @param {string} name @param {string} text
 * @param {Record<string,any>} options @returns {string} */
export function serializeOpenApiForm(name, text, options) {
  if (options.review)
    throw new Error(
      `Review form serialization for ${name}. Disable this row and supply a manually serialized value.`,
    );
  if (options.style === "content")
    return serializeFormContent(name, text, options);
  if (options.formArrayItems) {
    const compact = serializeOpenApiContent(
      name,
      text,
      {
        kind: "array",
        nullable: options.nullable,
        mediaType: "application/json",
      },
      "Form",
    );
    if (compact !== "null")
      return arrayItems(compact)
        .map((item) => {
          const value = JSON.parse(item);
          let kind =
            options.itemKind === "json"
              ? Array.isArray(value)
                ? "array"
                : value !== null && typeof value === "object"
                  ? "object"
                  : "scalar-json"
              : options.itemKind;
          if (
            kind === "scalar-json" &&
            ["number", "boolean"].includes(typeof value)
          ) {
            serializeOpenApiContent(
              name,
              item,
              { kind, mediaType: "application/json" },
              "Form",
            );
            kind = "scalar";
          }
          return serializeOpenApiForm(name, item, {
            ...options,
            formArrayItems: false,
            kind,
            nullable:
              options.itemNullable ||
              (options.itemKind === "json" && value === null),
          });
        })
        .filter(Boolean)
        .join("&");
  }
  const atom = (/** @type {string} */ value) => {
    if (!options.allowReserved) return encodeOpenApiContent(value);
    return (value.match(/%[\da-f]{2}|[\s\S]/giu) ?? [])
      .map((char) =>
        /^%[\da-f]{2}$/i.test(char) || /^[\w.~:/?#\[\]@!$'()*,;-]$/.test(char)
          ? char
          : encodeOpenApiContent(char),
      )
      .join("");
  };
  return serializeOpenApiStyle(
    name,
    text,
    {
      style: options.style,
      explode:
        options.explode === true ||
        (options.ignoreDeepObjectExplode && options.style === "deepObject"),
      kind: options.kind,
      nullable: options.nullable,
    },
    atom,
    encodeOpenApiContent,
    "Form",
  );
}
