/** Parse one RFC9110 media type, preserving parameter syntax validation.
 * @param {unknown} value @returns {string|null} */
export function mediaTypeName(value) {
  if (typeof value !== "string" || /[\r\n]/.test(value)) return null;
  const base =
    /^[ \t]*([!#$%&'*+.^_`|~0-9A-Za-z-]+)\/([!#$%&'*+.^_`|~0-9A-Za-z-]+)(?=[ \t;]|$)/.exec(
      value,
    );
  if (!base) return null;
  const name = `${base[1].toLowerCase()}/${base[2].toLowerCase()}`;
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
    if (index === value.length) return name;
    if (value[index++] !== ";") return null;
    whitespace();
    if (index === value.length || value[index] === ";") continue;
    if (!readToken() || value[index++] !== "=") return null;
    if (value[index] !== '"') {
      if (!readToken()) return null;
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
        if (!quotedChar(value.charCodeAt(index++))) return null;
      } else if (!quotedChar(char.charCodeAt(0))) return null;
    }
    if (!closed) return null;
  }
  return name;
}

/** JSON representation for bodies/editors, including legacy text/json support.
 * Content parameters/form fields retain their separate application/json rule.
 * @param {unknown} value */
export function isJsonBodyMediaType(value) {
  const name = mediaTypeName(value);
  if (!name || name.includes("*")) return false;
  return (
    name === "application/json" ||
    name === "text/json" ||
    /\/.+\+json$/.test(name)
  );
}
