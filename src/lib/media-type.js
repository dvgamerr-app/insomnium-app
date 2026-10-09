/** Parse one RFC9110 media type and unescape quoted parameter values.
 * @param {unknown} value @returns {{name:string,parameters:{name:string,value:string}[]}|null} */
export function parseMediaType(value) {
  if (typeof value !== "string" || /[\r\n]/.test(value)) return null;
  const base =
    /^[ \t]*([!#$%&'*+.^_`|~0-9A-Za-z-]+)\/([!#$%&'*+.^_`|~0-9A-Za-z-]+)(?=[ \t;]|$)/.exec(
      value,
    );
  if (!base) return null;
  const name = `${base[1].toLowerCase()}/${base[2].toLowerCase()}`;
  const parameters = /** @type {{name:string,value:string}[]} */ ([]);
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
    if (index === value.length) return { name, parameters };
    if (value[index++] !== ";") return null;
    whitespace();
    if (index === value.length || value[index] === ";") continue;
    const parameterStart = index;
    if (!readToken()) return null;
    const parameterName = value.slice(parameterStart, index).toLowerCase();
    if (value[index++] !== "=") return null;
    if (value[index] !== '"') {
      const valueStart = index;
      if (!readToken()) return null;
      parameters.push({
        name: parameterName,
        value: value.slice(valueStart, index),
      });
      continue;
    }
    index++;
    let closed = false;
    let parameterValue = "";
    while (index < value.length) {
      const char = value[index++];
      if (char === '"') {
        closed = true;
        break;
      }
      if (char === "\\") {
        if (!quotedChar(value.charCodeAt(index))) return null;
        parameterValue += value[index++];
      } else {
        if (!quotedChar(char.charCodeAt(0))) return null;
        parameterValue += char;
      }
    }
    if (!closed) return null;
    parameters.push({ name: parameterName, value: parameterValue });
  }
  return { name, parameters };
}

/** @param {unknown} value @returns {string|null} */
export function mediaTypeName(value) {
  return parseMediaType(value)?.name ?? null;
}

/** Form fields use the existing UTF-8 form encoder. Other charsets need byte handling.
 * @param {unknown} value */
export function isUtf8PlainTextMediaType(value) {
  const media = parseMediaType(value);
  if (media?.name !== "text/plain") return false;
  const charsets = media.parameters.filter(
    (parameter) => parameter.name === "charset",
  );
  return (
    charsets.length === 0 ||
    (charsets.length === 1 && charsets[0].value.toLowerCase() === "utf-8")
  );
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
