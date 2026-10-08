import { serializeOpenApiStyle } from "./openapi-style.js";
import {
  encodeOpenApiContent,
  serializeOpenApiContent,
} from "./openapi-content.js";
import { describeOpenApiValue, readOpenApiValue } from "./openapi-value.js";

/** Content mode applies a property's media type to each array item.
 * @param {any} value @param {Record<string,any>} schema @param {Record<string,any>} encoding */
export function describeOpenApiFormContent(value, schema, encoding) {
  const descriptor = describeOpenApiValue(value, schema, true);
  const array = descriptor.kind === "array";
  const itemSchema = array ? schema.items || {} : schema;
  const types = Array.isArray(itemSchema.type)
    ? itemSchema.type
    : [itemSchema.type];
  const type = types.find((/** @type {string} */ type) => type !== "null");
  const mediaType =
    encoding.contentType ||
    (["object", "array"].includes(type)
      ? "application/json"
      : ["string", "number", "integer", "boolean"].includes(type) &&
          !itemSchema.contentEncoding
        ? "text/plain"
        : "application/octet-stream");
  const jsonKind = (/** @type {Record<string,any>} */ property) => {
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
  };
  const serialization = {
    formBody: true,
    style: "content",
    mediaType,
    kind: array
      ? "array"
      : mediaType === "application/json"
        ? jsonKind(schema)
        : descriptor.kind,
    ...(descriptor.nullable ? { nullable: true } : {}),
    ...(array
      ? {
          formArrayItems: true,
          itemKind: jsonKind(itemSchema),
          itemNullable: itemSchema.nullable === true || types.includes("null"),
        }
      : {}),
    ...(!["application/json", "text/plain"].includes(mediaType) ||
    (mediaType === "text/plain" && ["object", "array"].includes(type)) ||
    itemSchema.contentEncoding ||
    encoding.encoding ||
    encoding.prefixEncoding ||
    encoding.itemEncoding
      ? { review: true }
      : {}),
  };
  return {
    name: "",
    value:
      mediaType === "application/json" || array
        ? JSON.stringify(value ?? null)
        : descriptor.text,
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
  const pair = (/** @type {string} */ value) =>
    new URLSearchParams([[name, value]]).toString();
  const serialize = (
    /** @type {string} */ value,
    /** @type {Record<string,any>} */ descriptor,
  ) => {
    if (options.mediaType === "application/json")
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
    if (options.mediaType !== "text/plain")
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
  if (compact === "null")
    return options.mediaType === "application/json" ? pair("null") : "";
  return arrayItems(compact)
    .map((item) => {
      const value = serialize(item, {
        kind:
          options.mediaType === "text/plain" ? "scalar-json" : options.itemKind,
        nullable: options.itemNullable,
      });
      return value === null ? "" : pair(value);
    })
    .filter(Boolean)
    .join("&");
}

/** Explicit Encoding Object styles use RFC6570, with form delimiters protected.
 * @param {string} name @param {string} text
 * @param {Record<string,any>} options */
export function serializeOpenApiForm(name, text, options) {
  if (options.review)
    throw new Error(
      `Review form serialization for ${name}. Disable this row and supply a manually serialized value.`,
    );
  if (options.style === "content")
    return serializeFormContent(name, text, options);
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
      explode: options.explode === true,
      kind: options.kind,
      nullable: options.nullable,
    },
    atom,
    encodeOpenApiContent,
    "Form",
  );
}
