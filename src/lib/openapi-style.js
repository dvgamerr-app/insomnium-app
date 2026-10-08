import { readOpenApiValue } from "./openapi-value.js";
/** Shared RFC6570 flat value expansion, with destination-owned atom encoding.
 * @param {string} name @param {string} text
 * @param {{style:string,explode:boolean,kind:string,nullable?:boolean}} options
 * @param {(value:string)=>string} encodeAtom @param {(value:string)=>string} encodeName
 * @param {string} location */
export function serializeOpenApiStyle(
  name,
  text,
  options,
  encodeAtom,
  encodeName,
  location,
) {
  const key = encodeName(name);
  const { style, explode, kind } = options;
  const atom = (/** @type {unknown} */ value) => {
    if (
      value !== null &&
      !["string", "number", "boolean"].includes(typeof value)
    )
      throw new Error(
        `${location} parameter ${name} requires flat scalar values.`,
      );
    return encodeAtom(String(value ?? ""));
  };
  const value = readOpenApiValue(name, text, options, location);
  if (
    !["form", "spaceDelimited", "pipeDelimited", "deepObject"].includes(style)
  )
    throw new Error(`Unsupported ${location.toLowerCase()} style ${style}.`);
  if (value === null) {
    if (style === "form") return "";
    throw new Error(
      `Review undefined ${location.toLowerCase()} values for ${style}.`,
    );
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
