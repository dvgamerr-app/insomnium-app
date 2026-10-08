import { readOpenApiValue } from "./openapi-value.js";
import {
  serializeOpenApiContent,
  encodeOpenApiContent,
} from "./openapi-content.js";
/** Serialize flat OpenAPI 3 query values; delimiters remain distinct from encoded data.
 * @param {string} name @param {string} text
 * @param {{style:string,explode:boolean,kind:string,nullable?:boolean,mediaType?:string,review?:boolean,allowReserved?:boolean}} options */
export function serializeOpenApiQuery(name, text, options) {
  if (options.style === "content")
    return `${encodeOpenApiContent(name)}=${encodeOpenApiContent(serializeOpenApiContent(name, text, options, "Query"))}`;
  const { style, explode, kind } = options;
  const atom = (/** @type {unknown} */ value) => {
    if (
      value !== null &&
      !["string", "number", "boolean"].includes(typeof value)
    )
      throw new Error(`Query parameter ${name} requires flat scalar values.`);
    const text = String(value ?? "");
    if (!options.allowReserved) return encodeOpenApiContent(text);
    // RFC6570 reserved expansion retains valid percent triples verbatim. The
    // application must still encode #/[] for the query destination (OAS C.4.2).
    // &, =, + and style delimiters retain their syntax; callers can pre-encode
    // data that must survive form decoding. HTTP URL parsing also encodes '.
    return (text.match(/%[\da-f]{2}|[\s\S]/giu) ?? [])
      .map((char) =>
        /^%[\da-f]{2}$/i.test(char) || /^[\w.~:/?@!$&'()*+,;=-]$/.test(char)
          ? char
          : encodeOpenApiContent(char),
      )
      .join("");
  };
  const key = encodeOpenApiContent(name);
  const value = readOpenApiValue(name, text, options, "Query");
  if (
    !["form", "spaceDelimited", "pipeDelimited", "deepObject"].includes(style)
  )
    throw new Error(`Unsupported query style ${style}.`);
  if (value === null) {
    if (style === "form") return "";
    throw new Error(`Review undefined query values for ${style}.`);
  }
  if (style === "deepObject") {
    if (kind !== "object" || !explode)
      throw new Error("deepObject requires an exploded flat object.");
    return Object.entries(value)
      .map(([property, item]) => `${key}%5B${atom(property)}%5D=${atom(item)}`)
      .join("&");
  }
  if (
    style !== "form" &&
    (kind === "scalar" || kind === "scalar-json" || explode)
  )
    throw new Error(`${style} requires a non-exploded array or flat object.`);
  if (kind === "scalar" || kind === "scalar-json")
    return `${key}=${atom(value)}`;
  if (Array.isArray(value)) {
    const items = value
      .filter(
        (/** @type {unknown} */ item) => style !== "form" || item !== null,
      )
      .map(atom);
    if (style === "form" && !items.length) return "";
    if (explode) return items.map((item) => `${key}=${item}`).join("&");
    return `${key}=${items.join(style === "spaceDelimited" ? "%20" : style === "pipeDelimited" ? "%7C" : ",")}`;
  }
  const entries = Object.entries(value)
    .filter(([, item]) => style !== "form" || item !== null)
    .map(([property, item]) => [atom(property), atom(item)]);
  if (style === "form" && !entries.length) return "";
  if (explode)
    return entries.map(([property, item]) => `${property}=${item}`).join("&");
  return `${key}=${entries.flat().join(style === "spaceDelimited" ? "%20" : style === "pipeDelimited" ? "%7C" : ",")}`;
}
