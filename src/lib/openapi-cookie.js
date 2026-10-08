import { readOpenApiValue } from "./openapi-value.js";

/** Cookie schema/content serialization, with RFC6265 delimiters and octets.
 * @param {string} name @param {string} text
 * @param {{style:string,explode:boolean,kind:string,nullable?:boolean,review?:boolean}} options */
export function serializeOpenApiCookie(name, text, options) {
  if (options.review)
    throw new Error(
      `Review cookie serialization for ${name}. Disable this row and add an explicitly serialized Cookie header.`,
    );
  if (!["form", "text/plain", "cookie"].includes(options.style))
    throw new Error(`Unsupported cookie style ${options.style}.`);
  const value = readOpenApiValue(name, text, options, "Cookie");
  if (value === null) return null;
  const compound = Array.isArray(value) || typeof value === "object";
  if (
    compound &&
    options.style !== "text/plain" &&
    Object.values(value).every((item) => item === null)
  )
    return null;
  if (compound && options.style !== "cookie")
    throw new Error(
      `Review compound cookie parameter ${name}: form delimiters are not Cookie header delimiters. Use an explicitly serialized text/plain value.`,
    );
  const encode = (/** @type {string} */ value) =>
    encodeURIComponent(value).replace(
      /[!'()*]/g,
      (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase(),
    );
  const pair = (/** @type {string} */ name, /** @type {unknown} */ value) => {
    if (
      !["string", "number", "boolean"].includes(typeof value) ||
      (typeof value === "number" && !Number.isFinite(value))
    )
      throw new Error(`Cookie parameter ${name} requires flat scalar values.`);
    const key = options.style === "form" ? encode(name) : name;
    const item =
      options.style === "form" ? encode(String(value)) : String(value);
    if (!key || !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(key))
      throw new Error(`Cookie parameter ${name} requires a valid cookie name.`);
    // RFC6265 cookie-octet; quoted values must be supplied explicitly, never autoquoted.
    const unquoted =
      item.length >= 2 && item.startsWith('"') && item.endsWith('"')
        ? item.slice(1, -1)
        : item;
    if (!/^[\x21\x23-\x2b\x2d-\x3a\x3c-\x5b\x5d-\x7e]*$/.test(unquoted))
      throw new Error(
        `Cookie parameter ${name} contains invalid cookie characters. Supply an explicitly encoded text/plain value.`,
      );
    return `${key}=${item}`;
  };
  if (compound) {
    if (!options.explode)
      throw new Error(
        `Cookie parameter ${name} requires explode=true for compound values.`,
      );
    const pairs = Array.isArray(value)
      ? value
          .filter((/** @type {unknown} */ item) => item !== null)
          .map((/** @type {unknown} */ item) => pair(name, item))
      : Object.entries(value)
          .filter(([, item]) => item !== null)
          .map(([key, item]) => pair(key, item));
    return pairs.length ? pairs.join("; ") : null;
  }
  return pair(name, value);
}
