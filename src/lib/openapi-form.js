import { serializeOpenApiStyle } from "./openapi-style.js";
import { encodeOpenApiContent } from "./openapi-content.js";

/** Explicit Encoding Object styles use RFC6570, with form delimiters protected.
 * @param {string} name @param {string} text
 * @param {{style:string,explode:boolean,kind:string,nullable?:boolean,allowReserved?:boolean,review?:boolean}} options */
export function serializeOpenApiForm(name, text, options) {
  if (options.review)
    throw new Error(
      `Review form serialization for ${name}. Disable this row and supply a manually serialized value.`,
    );
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
    options,
    atom,
    encodeOpenApiContent,
    "Form",
  );
}
