/** RFC9110 media-type syntax and RFC8259's parameter-free JSON registration.
 * Preserve metadata while recognizing one JSON media type, not a media list.
 * @param {unknown} value */
export function isOpenApiJsonMediaType(value) {
  if (typeof value !== "string" || /[\r\n]/.test(value)) return false;
  const base = /^[ \t]*application\/json(?=[ \t;]|$)/i.exec(value);
  if (!base) return false;
  let index = base[0].length;
  const token = /[!#$%&'*+.^_`|~0-9A-Za-z-]+/y;
  const whitespace = () => {
    while (value[index] === " " || value[index] === "\t") index++;
  };
  const readToken = () => {
    token.lastIndex = index;
    if (!token.exec(value)) return false;
    index = token.lastIndex;
    return true;
  };
  const quotedChar = (/** @type {number} */ code) =>
    code === 9 || (code >= 32 && code <= 126) || (code >= 128 && code <= 255);
  while (index < value.length) {
    whitespace();
    if (index === value.length) return true;
    if (value[index++] !== ";") return false;
    whitespace();
    // RFC9110 parameters permits empty semicolon sections.
    if (index === value.length || value[index] === ";") continue;
    if (!readToken() || value[index++] !== "=") return false;
    if (value[index] !== '"') {
      if (!readToken()) return false;
      continue;
    }
    index++;
    let closed = false;
    while (index < value.length) {
      const char = value[index++];
      if (char === '"') {
        closed = true;
        break;
      }
      if (char === "\\") {
        if (!quotedChar(value.charCodeAt(index++))) return false;
      } else if (!quotedChar(char.charCodeAt(0))) return false;
    }
    if (!closed) return false;
  }
  return true;
}

/** Media serialization precedes location encoding; JSON null is a represented value.
 * @param {string} name @param {string} text
 * @param {{mediaType?:string,kind:string,nullable?:boolean,review?:boolean}} options
 * @param {string} location */
export function serializeOpenApiContent(name, text, options, location) {
  if (options.review || !isOpenApiJsonMediaType(options.mediaType))
    throw new Error(
      `Review ${location.toLowerCase()} content serialization for ${name}. Disable this row and supply an explicitly serialized value.`,
    );
  const kind = options.kind === "scalar" ? "scalar-json" : options.kind;
  const expected =
    kind === "json" ? "value" : kind === "scalar-json" ? "scalar" : kind;
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(
      `${location} parameter ${name} requires valid JSON ${expected}.`,
    );
  }
  const valid =
    kind === "json" ||
    (value === null && options.nullable) ||
    (kind === "array" && Array.isArray(value)) ||
    (kind === "object" &&
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)) ||
    (kind === "scalar-json" &&
      ["string", "number", "boolean"].includes(typeof value));
  if (!valid)
    throw new Error(
      `${location} parameter ${name} requires a JSON ${expected}.`,
    );
  // Remove only JSON whitespace outside strings. Re-stringifying parsed values
  // would round large integer lexemes and change explicit string escapes.
  let result = "",
    quoted = false,
    escaped = false;
  for (const char of text) {
    if (quoted) {
      result += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') {
      quoted = true;
      result += char;
    } else if (!/[ \t\r\n]/.test(char)) result += char;
  }
  return result;
}

/** Strict URI data encoding, independent of query/path separators.
 * @param {string} value */
export function encodeOpenApiContent(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase(),
  );
}
