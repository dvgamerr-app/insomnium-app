/** Serialize flat OpenAPI 3 query values; delimiters remain distinct from encoded data.
 * @param {string} name @param {string} text
 * @param {{style:string,explode:boolean,kind:string}} options */
export function serializeOpenApiQuery(name, text, options) {
  const { style, explode, kind } = options;
  const atom = (/** @type {unknown} */ value) => {
    if (
      value !== null &&
      !["string", "number", "boolean"].includes(typeof value)
    )
      throw new Error(`Query parameter ${name} requires flat scalar values.`);
    return encodeURIComponent(String(value ?? "")).replace(
      /[!'()*]/g,
      (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase(),
    );
  };
  const key = atom(name);
  let value = /** @type {any} */ (text);
  if (kind !== "scalar") {
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error(`Query parameter ${name} requires valid JSON ${kind}.`);
    }
    if (
      kind === "array"
        ? !Array.isArray(value)
        : kind !== "object" ||
          !value ||
          typeof value !== "object" ||
          Array.isArray(value)
    )
      throw new Error(`Query parameter ${name} requires a JSON ${kind}.`);
  }
  if (
    !["form", "spaceDelimited", "pipeDelimited", "deepObject"].includes(style)
  )
    throw new Error(`Unsupported query style ${style}.`);
  if (style === "deepObject") {
    if (kind !== "object" || !explode)
      throw new Error("deepObject requires an exploded flat object.");
    return Object.entries(value)
      .map(([property, item]) => `${key}[${atom(property)}]=${atom(item)}`)
      .join("&");
  }
  if (style !== "form" && (kind === "scalar" || explode))
    throw new Error(`${style} requires a non-exploded array or flat object.`);
  if (kind === "scalar") return `${key}=${atom(value)}`;
  if (Array.isArray(value)) {
    const items = value.map(atom);
    if (explode) return items.map((item) => `${key}=${item}`).join("&");
    return `${key}=${items.join(style === "spaceDelimited" ? "%20" : style === "pipeDelimited" ? "|" : ",")}`;
  }
  const entries = Object.entries(value).map(([property, item]) => [
    atom(property),
    atom(item),
  ]);
  if (explode)
    return entries.map(([property, item]) => `${property}=${item}`).join("&");
  return `${key}=${entries.flat().join(style === "spaceDelimited" ? "%20" : style === "pipeDelimited" ? "|" : ",")}`;
}
