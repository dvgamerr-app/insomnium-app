import { serializeOpenApiStyle } from "./openapi-style.js";
import {
  serializeOpenApiContent,
  encodeOpenApiContent,
} from "./openapi-content.js";
/** Serialize flat OpenAPI 3 query values; delimiters remain distinct from encoded data.
 * @param {string} name @param {string} text
 * @param {{style:string,explode:boolean,kind:string,nullable?:boolean,mediaType?:string,review?:boolean,allowReserved?:boolean}} options */
export function serializeOpenApiQuery(name, text, options) {
  if (options.style === "content") {
    const value = serializeOpenApiContent(name, text, options, "Query");
    return value === null
      ? ""
      : `${encodeOpenApiContent(name)}=${encodeOpenApiContent(value)}`;
  }
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
  return serializeOpenApiStyle(
    name,
    text,
    options,
    atom,
    encodeOpenApiContent,
    "Query",
  );
}
