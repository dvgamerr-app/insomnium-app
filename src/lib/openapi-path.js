import { readOpenApiValue } from "./openapi-value.js";
import { serializeOpenApiSerialized } from "./openapi-serialized-example.js";
import {
  serializeOpenApiContent,
  encodeOpenApiContent,
} from "./openapi-content.js";
/** RFC6570-derived OpenAPI path styles, keeping delimiters separate from data.
 * @param {string} name @param {string} text
 * @param {{style:string,explode:boolean,kind:string,nullable?:boolean,mediaType?:string,review?:boolean}} options */
export function serializeOpenApiPath(name, text, options) {
  if (options.style === "serialized")
    return serializeOpenApiSerialized(name, text, options, "path");
  if (options.style === "content") {
    const value = serializeOpenApiContent(name, text, options, "Path");
    return value === null ? "" : encodeOpenApiContent(value);
  }
  const { style, explode, kind } = options;
  if (!["simple", "label", "matrix"].includes(style))
    throw new Error(`Unsupported path style ${style}.`);
  const atom = (/** @type {unknown} */ value) => {
    if (
      value !== null &&
      !["string", "number", "boolean"].includes(typeof value)
    )
      throw new Error(`Path parameter ${name} requires flat scalar values.`);
    return encodeURIComponent(String(value ?? "")).replace(
      /[!'()*]/g,
      (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase(),
    );
  };
  const value = readOpenApiValue(name, text, options, "Path");
  if (value === null) return "";
  const key = atom(name);
  const prefix = style === "label" ? "." : style === "matrix" ? `;${key}=` : "";
  if (kind === "scalar" || kind === "scalar-json")
    return style === "matrix" && value === ""
      ? `;${key}`
      : prefix + atom(value);
  const delimiter = explode && style === "label" ? "." : ",";
  if (Array.isArray(value)) {
    const items = value
      .filter((/** @type {unknown} */ item) => item !== null)
      .map(atom);
    if (!items.length) return "";
    if (style === "matrix" && explode)
      return items
        .map((item) => (item ? `;${key}=${item}` : `;${key}`))
        .join("");
    return prefix + items.join(delimiter);
  }
  const entries = Object.entries(value)
    .filter(([, item]) => item !== null)
    .map(([property, item]) => [atom(property), atom(item)]);
  if (!entries.length) return "";
  if (style === "matrix" && explode)
    return entries
      .map(([property, item]) =>
        item ? `;${property}=${item}` : `;${property}`,
      )
      .join("");
  return (
    prefix +
    entries
      .map(([property, item]) =>
        explode
          ? item
            ? `${property}=${item}`
            : property
          : `${property},${item}`,
      )
      .join(delimiter)
  );
}

/** Expand encoded OpenAPI placeholders once, including embedded/repeated slots.
 * @param {URL} url @param {Array<Record<string,any>>} parameters
 * @param {(value:unknown)=>string} resolve @param {boolean} [required] */
export function expandOpenApiPath(url, parameters, resolve, required = false) {
  if (!required && !parameters.some((p) => p._openapiSerialization)) return;
  const values = new Map();
  const pathname = url.pathname.replace(/%7B(.*?)%7D/gi, (_, encodedName) => {
    const name = decodeURIComponent(encodedName);
    const parameter = parameters.find(
      (p) => p.name === name && p._openapiSerialization && !p.disabled,
    );
    if (!parameter) throw new Error(`Path variable not found: ${name}`);
    if (!values.has(name))
      values.set(
        name,
        serializeOpenApiPath(
          name,
          resolve(parameter.value),
          parameter._openapiSerialization,
        ),
      );
    return values.get(name);
  });
  url.pathname = pathname;
  if (url.pathname !== pathname)
    throw new Error(
      "Path parameter expansion would normalize URL segments. Review the path values.",
    );
}
