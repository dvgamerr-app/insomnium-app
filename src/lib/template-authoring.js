// Authoring is data-only: parsing never renders expressions or executes tags.
import { decodeArgument } from "./template-tags.js";
import { isTemplateTagName } from "./template-registration.js";

export const templateArgumentTypes = [
  "string",
  "number",
  "boolean",
  "variable",
  "expression",
  "enum",
  "file",
  "model",
];
const MAX_ARGUMENTS = 32;
const MAX_TEXT = 1024 * 1024;

/** Nunjucks does not accept JSON unicode/scientific-number escapes.
 * @param {string} value */
function quote(value) {
  return (
    "'" +
    value
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t") +
    "'"
  );
}

/** Expand decimal exponents rather than emitting an unsupported symbol.
 * @param {number} value */
function numberLiteral(value) {
  if (!Number.isFinite(value)) throw Error("A numeric argument must be finite");
  if (Object.is(value, -0)) return "-0";
  const text = String(value);
  if (!/[eE]/.test(text)) return text;
  const [coefficient, exponent] = text.split(/[eE]/);
  const negative = coefficient.startsWith("-");
  const unsigned = negative ? coefficient.slice(1) : coefficient;
  const point =
    (unsigned.indexOf(".") < 0 ? unsigned.length : unsigned.indexOf(".")) +
    Number(exponent);
  const digits = unsigned.replace(".", "");
  return (
    (negative ? "-" : "") +
    (point <= 0
      ? "0." + "0".repeat(-point) + digits
      : point >= digits.length
        ? digits + "0".repeat(point - digits.length)
        : digits.slice(0, point) + "." + digits.slice(point))
  );
}

/** @param {string} value @param {string|undefined} encoding */
export function encodeTemplateArgument(value, encoding) {
  if (encoding !== undefined && encoding !== "base64")
    throw Error("Unknown argument encoding");
  // The renderer decodes this legacy sentinel even for ordinary strings.
  // Wrap a literal sentinel once so authored text survives that boundary.
  if (!value || (encoding !== "base64" && !/^b64::(.+)::46b$/.test(value)))
    return value;
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return "b64::" + btoa(binary) + "::46b";
}

/** @typedef {{type:string,value:string|number|boolean,encoding?:string,quotedBy?:string,raw?:string}} AuthoringArgument */

/** @param {AuthoringArgument} argument */
export function serializeTemplateArgument(argument) {
  if (!templateArgumentTypes.includes(argument.type))
    throw Error("Unknown argument type");
  if (argument.raw !== undefined) {
    if (typeof argument.raw !== "string" || !argument.raw.trim())
      throw Error("Missing argument expression");
    return argument.raw;
  }
  if (argument.type === "number") {
    if (typeof argument.value !== "number")
      throw Error("A numeric argument must be a number");
    return numberLiteral(argument.value);
  }
  if (argument.type === "boolean") {
    if (typeof argument.value !== "boolean")
      throw Error("A boolean argument must be true or false");
    return argument.value ? "true" : "false";
  }
  if (["variable", "expression"].includes(argument.type)) {
    if (typeof argument.value !== "string")
      throw Error("An expression must be text");
    return argument.value.trim() || "''";
  }
  return quote(
    encodeTemplateArgument(String(argument.value), argument.encoding),
  );
}

/** Keep legacy defaults, including enum values represented as strings.
 * @param {Record<string,any>} definition @returns {AuthoringArgument} */
export function defaultTemplateArgument(definition) {
  const type = definition.type;
  if (!templateArgumentTypes.includes(type))
    throw Error("Unknown argument type");
  const fallback = definition.defaultValue;
  let value;
  if (type === "enum")
    value = String(
      fallback !== undefined
        ? fallback
        : (definition.options?.[0]?.value ?? ""),
    );
  else if (type === "number") {
    const parsed =
      typeof fallback === "number" ? fallback : Number.parseFloat(fallback);
    value = Number.isFinite(parsed) ? parsed : 0;
  } else if (type === "boolean") value = !!fallback;
  else if (["variable", "expression"].includes(type)) value = "";
  else value = String(fallback || "");
  return {
    type,
    value,
    ...(definition.encoding ? { encoding: definition.encoding } : {}),
  };
}

/** @param {string} name @param {AuthoringArgument[]} args */
export function serializeTemplateTag(name, args) {
  if (!isTemplateTagName(name) || /\s|%}|{%/.test(name))
    throw Error("Tag name cannot be authored");
  if (!Array.isArray(args) || args.length > MAX_ARGUMENTS)
    throw Error("Too many template arguments");
  const text =
    "{% " +
    name +
    (args.length ? " " + args.map(serializeTemplateArgument).join(", ") : "") +
    " %}";
  if (text.length > MAX_TEXT) throw Error("Template tag is too large");
  return text;
}

/** @param {Record<string,any>} definition */
export function defaultTemplateTag(definition) {
  return serializeTemplateTag(
    definition.name,
    (definition.args ?? []).map(defaultTemplateArgument),
  );
}

/** Preserve nested expressions, commas in strings/regexes and exact raw spelling.
 * This tokenizer deliberately does not evaluate or validate Nunjucks expressions.
 * Invalid/unrecognized input can remain in the dialog's raw editor unchanged.
 * @param {string} text @returns {{name:string,args:AuthoringArgument[]}} */
export function parseTemplateTag(text) {
  if (typeof text !== "string" || text.length > MAX_TEXT)
    throw Error("Template tag is too large");
  const match = /^\s*{%\s*([^\s]+?)(?:\s+([\s\S]*?))?\s*%}\s*$/.exec(text);
  if (!match || !isTemplateTagName(match[1]))
    throw Error("Expected one template tag");
  const name = match[1],
    source = (match[2] ?? "").trim();
  if (!source) return { name, args: [] };
  const parts = [];
  const stack = [];
  let start = 0,
    delimiter = "",
    regex = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (delimiter) {
      if (c === "\\") {
        i++;
        if (i >= source.length) throw Error("Incomplete quoted argument");
      } else if (c === delimiter) {
        delimiter = "";
        regex = false;
      }
      continue;
    }
    if (c === "'" || c === '"') {
      delimiter = c;
      continue;
    }
    if (
      c === "r" &&
      source[i + 1] === "/" &&
      (i === 0 || /[\s,(\[{:]/.test(source[i - 1]))
    ) {
      delimiter = "/";
      regex = true;
      i++;
      continue;
    }
    if ("([{".includes(c)) stack.push(c);
    else if (")]}".includes(c)) {
      const expected = /** @type {Record<string,string>} */ ({
        ")": "(",
        "]": "[",
        "}": "{",
      })[c];
      if (stack.pop() !== expected)
        throw Error("Unbalanced argument expression");
    } else if (c === "," && !stack.length) {
      parts.push(source.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (delimiter || regex || stack.length)
    throw Error("Incomplete argument expression");
  parts.push(source.slice(start).trim());
  if (parts.length > MAX_ARGUMENTS || parts.some((part) => !part))
    throw Error("Invalid argument list");
  return { name, args: parts.map(parseArgument) };
}

/** @param {string} raw @returns {AuthoringArgument} */
function parseArgument(raw) {
  const quotedBy = raw[0];
  if (quotedBy === "'" || quotedBy === '"') {
    let value = "",
      ended = false;
    for (let i = 1; i < raw.length; i++) {
      let c = raw[i];
      if (c === "\\") {
        c = raw[++i];
        value += c === "n" ? "\n" : c === "r" ? "\r" : c === "t" ? "\t" : c;
      } else if (c === quotedBy) {
        ended = i === raw.length - 1;
        break;
      } else value += c;
    }
    if (ended) {
      const decoded = decodeArgument(value);
      return {
        type: "string",
        value: decoded,
        quotedBy,
        raw,
        ...(decoded !== value ? { encoding: "base64" } : {}),
      };
    }
  }
  if (/^-?\d+(?:\.\d*)?$/.test(raw))
    return { type: "number", value: Number(raw), raw };
  if (raw === "true" || raw === "false")
    return { type: "boolean", value: raw === "true", raw };
  return {
    type: /^[\w$]+(?:\.[\w$]+)*$/u.test(raw) ? "variable" : "expression",
    value: raw,
    raw,
  };
}

/** Apply a single edit without rewriting other authored expressions/defaults.
 * @param {{name:string,args:AuthoringArgument[]}} tag @param {Record<string,any>} definition
 * @param {number} index @param {AuthoringArgument} argument */
export function updateTemplateArgument(tag, definition, index, argument) {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= (definition.args?.length ?? 0)
  )
    throw Error("Unknown argument");
  const args = tag.args.map((arg) => ({ ...arg }));
  for (let i = args.length; i < definition.args.length; i++)
    args.push(defaultTemplateArgument(definition.args[i]));
  args[index] = { ...argument };
  delete args[index].raw;
  return { name: tag.name, args };
}

/** Find the block at a caret without mistaking quoted percent-delimiters for its
 * end. A nonempty selection is edited exactly as selected, including raw text.
 * @param {string} text @param {number} start @param {number} end */
export function templateTagRange(text, start, end) {
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    end > text.length
  )
    throw Error("Invalid editor selection");
  if (start !== end) return { start, end, text: text.slice(start, end) };
  let offset = 0;
  while (offset <= start) {
    const begin = text.indexOf("{%", offset);
    if (begin < 0 || begin > start) break;
    let i = begin + 2;
    while (/\s/.test(text[i] ?? "") && i < text.length) i++;
    // A registered name is a lexer symbol; quote characters inside it are data.
    while (
      i < text.length &&
      !/\s/.test(text[i]) &&
      text.slice(i, i + 2) !== "%}"
    )
      i++;
    let delimiter = "";
    for (; i < text.length; i++) {
      const c = text[i];
      if (delimiter) {
        if (c === "\\") i++;
        else if (c === delimiter) delimiter = "";
        continue;
      }
      if (c === "'" || c === '"') {
        delimiter = c;
        continue;
      }
      if (c === "r" && text[i + 1] === "/" && /[\s,(\[{:]/.test(text[i - 1])) {
        delimiter = "/";
        i++;
        continue;
      }
      if (text.slice(i, i + 2) === "%}") {
        const finish = i + 2;
        if (start >= begin && start < finish)
          return { start: begin, end: finish, text: text.slice(begin, finish) };
        offset = finish;
        break;
      }
    }
    if (i >= text.length) break;
  }
  return { start, end, text: "" };
}

/** JSON editors display escaped string source. Decode only the owning JSON
 * string, map the tag selection back to source offsets, and escape replacement
 * on Apply. Never parse/evaluate the surrounding document or template.
 * @param {string} source @param {number} start @param {number} end @param {boolean} json */
export function templateEditorRange(source, start, end, json) {
  if (json) {
    for (let quote = 0; quote < source.length; quote++) {
      if (source[quote] !== '"') continue;
      let finish = quote + 1;
      for (; finish < source.length; finish++) {
        if (source[finish] === "\\") finish++;
        else if (source[finish] === '"') break;
      }
      if (start > quote && end <= finish && finish < source.length) {
        try {
          const decoded = JSON.parse(source.slice(quote, finish + 1));
          /** @type {number[]} */ const offsets = [quote + 1];
          let offset = quote + 1;
          while (offset < finish) {
            offset +=
              source[offset] === "\\"
                ? source[offset + 1] === "u"
                  ? 6
                  : 2
                : 1;
            offsets.push(offset);
          }
          const index = (/** @type {number} */ position) => {
            const found = offsets.findIndex((offset) => offset >= position);
            return found < 0 ? decoded.length : found;
          };
          const range = templateTagRange(decoded, index(start), index(end));
          return {
            start: offsets[range.start],
            end: offsets[range.end],
            text: range.text,
            jsonString: true,
          };
        } catch {
          /* Incomplete JSON remains editable through raw authoring. */
        }
      }
      quote = finish;
    }
  }
  return { ...templateTagRange(source, start, end), jsonString: false };
}
