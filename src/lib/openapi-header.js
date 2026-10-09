import { readOpenApiValue } from "./openapi-value.js";
import { serializeOpenApiSerialized } from "./openapi-serialized-example.js";
import { serializeOpenApiContent } from "./openapi-content.js";
/** Serialize OpenAPI simple header values without URI encoding or automatic quoting.
 * @param {string} name @param {string} text
 * @param {{style:string,explode:boolean,kind:string,nullable?:boolean,mediaType?:string,review?:boolean}} options */
export function serializeOpenApiHeader(name, text, options) {
  if (options.style === "serialized")
    return serializeOpenApiSerialized(name, text, options, "header");
  if (options.style === "content")
    return serializeOpenApiContent(name, text, options, "Header");
  const { style, explode, kind } = options;
  if (style !== "simple") throw new Error(`Unsupported header style ${style}.`);
  const atom = (/** @type {unknown} */ value) => {
    if (
      value !== null &&
      !["string", "number", "boolean"].includes(typeof value)
    )
      throw new Error(`Header parameter ${name} requires flat scalar values.`);
    const result = String(value ?? "");
    if (/[\u0000-\u0008\u000a-\u001f\u007f]/.test(result))
      throw new Error(
        `Header parameter ${name} contains invalid control characters.`,
      );
    return result;
  };
  const value = readOpenApiValue(name, text, options, "Header");
  if (value === null) return null;
  if (kind === "scalar" || kind === "scalar-json") return atom(value);
  if (Array.isArray(value)) {
    const items = value
      .filter((/** @type {unknown} */ item) => item !== null)
      .map(atom);
    return items.length ? items.join(",") : null;
  }
  const entries = Object.entries(value).filter(([, item]) => item !== null);
  if (!entries.length) return null;
  return entries
    .map(([key, item]) =>
      explode
        ? item === ""
          ? atom(key)
          : atom(key) + "=" + atom(item)
        : atom(key) + "," + atom(item),
    )
    .join(",");
}
