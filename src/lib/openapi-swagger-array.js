import { OpenApiNumber, parseOpenApiNumbers } from "./openapi-value.js";
import { encodeOpenApiContent } from "./openapi-content.js";

const separators = { csv: ",", ssv: " ", tsv: "\t", pipes: "|" };

/** Retain only the Items Object fields needed by editable array serialization.
 * @param {Record<string,any>} parameter */
export function swaggerArrayOptions(parameter) {
  /** @param {Record<string,any>} item @param {number} depth @returns {Record<string,any>} */
  const items = (item, depth) => {
    if (!item || depth > 64)
      throw Error("Invalid or excessive Swagger array nesting.");
    if (item.type === "array")
      return {
        type: "array",
        collectionFormat: item.collectionFormat ?? "csv",
        items: items(item.items, depth + 1),
      };
    if (!["string", "number", "integer", "boolean"].includes(item.type))
      throw Error("Swagger array items require a scalar or array type.");
    return { type: item.type };
  };
  return {
    style: "swagger",
    kind: "array",
    explode: false,
    collectionFormat: parameter.collectionFormat ?? "csv",
    items: items(parameter.items, 0),
  };
}

/** Return one value per parameter/part; only query/formData permit top-level multi.
 * @param {string} name @param {string} text @param {Record<string,any>} options
 * @param {string} location @returns {string[]} */
export function swaggerArrayValues(name, text, options, location) {
  if (options.review)
    throw Error(`Review Swagger array serialization for ${name}.`);
  const encoded = location === "query" || location === "path";
  const atom = (/** @type {string} */ value) => {
    if (
      location === "header" &&
      /[\u0000-\u0008\u000a-\u001f\u007f]/.test(value)
    )
      throw Error(
        `Header parameter ${name} contains invalid control characters.`,
      );
    return encoded ? encodeOpenApiContent(value) : value;
  };
  /** @param {any} value @param {Record<string,any>} item @param {number} depth @returns {string} */
  const serialize = (value, item, depth) => {
    if (!item || depth > 64)
      throw Error(`Invalid Swagger array items for ${name}.`);
    if (item.type === "array") {
      const separator =
        separators[
          /** @type {keyof typeof separators} */ (
            item.collectionFormat ?? "csv"
          )
        ];
      if (
        !Object.hasOwn(separators, item.collectionFormat ?? "csv") ||
        !Array.isArray(value)
      )
        throw Error(`Invalid Swagger nested array for ${name}.`);
      return value
        .map((v) => serialize(v, item.items, depth + 1))
        .join(encoded && separator !== "," ? atom(separator) : separator);
    }
    const valid =
      item.type === "string"
        ? typeof value === "string"
        : item.type === "boolean"
          ? typeof value === "boolean"
          : ["integer", "number"].includes(item.type) &&
            value instanceof OpenApiNumber &&
            (item.type !== "integer" || value.isInteger());
    if (!valid)
      throw Error(`Swagger array ${name} requires ${item.type} items.`);
    return atom(String(value));
  };
  let value;
  try {
    value = parseOpenApiNumbers(text);
  } catch {
    throw Error(`Swagger parameter ${name} requires a JSON array.`);
  }
  if (!Array.isArray(value))
    throw Error(`Swagger parameter ${name} requires a JSON array.`);
  const format = options.collectionFormat ?? "csv";
  if (format === "multi") {
    if (!["query", "formData"].includes(location))
      throw Error("Swagger multi is only valid in query or formData.");
    return value.map((v) => serialize(v, options.items, 0));
  }
  const separator = separators[/** @type {keyof typeof separators} */ (format)];
  if (!Object.hasOwn(separators, format))
    throw Error(`Unsupported Swagger collectionFormat ${format}.`);
  return value.length
    ? [
        value
          .map((v) => serialize(v, options.items, 0))
          .join(encoded && separator !== "," ? atom(separator) : separator),
      ]
    : [];
}
