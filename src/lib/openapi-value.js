/** A transient numeric token; never stored in request metadata or JSON payloads. */
export class OpenApiNumber {
  /** @param {string} source */
  constructor(source) {
    this.source = source;
    Object.freeze(this);
  }
  toString() {
    return this.source;
  }
  /** Classify the decimal value without rounding, exponent expansion or BigInt allocation. */
  isInteger() {
    const [mantissa, exponent = "0"] = this.source.toLowerCase().split("e");
    const fraction = mantissa.split(".")[1] || "";
    const digits = mantissa.replace(/[-.]/g, "");
    if (!/[1-9]/.test(digits)) return true;
    const scale = Number(exponent) - fraction.length;
    return scale >= 0 || -scale <= (digits.match(/0*$/)?.[0].length ?? 0);
  }
}

/** Parse strict JSON while preserving numeric source tokens on every supported engine.
 * JSON.parse validates syntax. Prefix all original string VALUES before replacing
 * numbers with tagged strings, so authored strings/keys cannot impersonate tokens.
 * @param {string} text @returns {any} */
export function parseOpenApiNumbers(text) {
  JSON.parse(text);
  let encoded = "";
  for (let index = 0; index < text.length;) {
    const char = text[index];
    if (char === '"') {
      const start = index++;
      while (index < text.length) {
        if (text[index] === "\\") index += 2;
        else if (text[index++] === '"') break;
      }
      let next = index;
      while (/[ \t\r\n]/.test(text[next] ?? "") && next < text.length) next++;
      encoded +=
        text[next] === ":"
          ? text.slice(start, index)
          : '"s:' + text.slice(start + 1, index);
    } else if (char === "-" || /[0-9]/.test(char)) {
      const start = index++;
      while (index < text.length && /[0-9eE+.\-]/.test(text[index])) index++;
      encoded += '"n:' + text.slice(start, index) + '"';
    } else {
      encoded += char;
      index++;
    }
  }
  return JSON.parse(encoded, (_, value) =>
    typeof value === "string"
      ? value.startsWith("n:")
        ? new OpenApiNumber(value.slice(2))
        : value.slice(2)
      : value,
  );
}

/** @param {unknown} value */
export function isOpenApiScalar(value) {
  return (
    value instanceof OpenApiNumber ||
    ["string", "number", "boolean"].includes(typeof value)
  );
}

/** Clone JSON values without stripping transient numeric-token identity.
 * @param {any} value @returns {any} */
export function cloneOpenApiNumbers(value) {
  if (value instanceof OpenApiNumber) return value;
  if (Array.isArray(value)) return value.map(cloneOpenApiNumbers);
  if (
    value &&
    typeof value === "object" &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        cloneOpenApiNumbers(child),
      ]),
    );
  return structuredClone(value);
}

/** JSON serialization of transient numeric tokens, with collision-safe strings.
 * @param {any} value @param {number} [space] @returns {string} */
export function stringifyOpenApiNumbers(value, space) {
  const json = JSON.stringify(
    value,
    (_, item) =>
      item instanceof OpenApiNumber
        ? "n:" + item.source
        : typeof item === "string"
          ? "s:" + item
          : item,
    space,
  );
  if (json === undefined) return json;
  let result = "";
  for (let index = 0; index < json.length;) {
    if (json[index] !== '"') {
      result += json[index++];
      continue;
    }
    const start = index++;
    while (index < json.length) {
      if (json[index] === "\\") index += 2;
      else if (json[index++] === '"') break;
    }
    let next = index;
    while (next < json.length && /[ \t\r\n]/.test(json[next])) next++;
    if (json[next] === ":") result += json.slice(start, index);
    else if (json.slice(start + 1, start + 3) === "n:")
      result += json.slice(start + 3, index - 1);
    else result += '"' + json.slice(start + 3, index);
  }
  return result;
}

/** Keep nullable JSON values distinct from ordinary editor strings.
 * @param {any} value @param {Record<string,any>} schema @param {boolean} enabled */
export function describeOpenApiValue(value, schema, enabled) {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const nullable =
    enabled &&
    (value === null || schema.nullable === true || types.includes("null"));
  const compound =
    value !== null &&
    typeof value === "object" &&
    !(value instanceof OpenApiNumber);
  const kind =
    value instanceof OpenApiNumber
      ? "scalar-json"
      : compound
        ? Array.isArray(value)
          ? "array"
          : "object"
        : nullable
          ? types.includes("array")
            ? "array"
            : types.includes("object")
              ? "object"
              : "scalar-json"
          : "scalar";
  return {
    kind,
    nullable,
    text:
      compound || nullable || value instanceof OpenApiNumber
        ? stringifyOpenApiNumbers(value ?? null)
        : String(value ?? ""),
  };
}

/** Parse editable JSON without conflating null, empty strings, false and zero.
 * @param {string} name @param {string} text
 * @param {{kind:string,nullable?:boolean}} options @param {string} location */
export function readOpenApiValue(name, text, { kind, nullable }, location) {
  if (kind === "scalar") return text;
  const expected = kind === "scalar-json" ? "scalar" : kind;
  let value;
  try {
    value = parseOpenApiNumbers(text);
  } catch {
    throw new Error(
      `${location} parameter ${name} requires valid JSON ${expected}.`,
    );
  }
  if (value === null && nullable) return null;
  const valid =
    kind === "array"
      ? Array.isArray(value)
      : kind === "object"
        ? value !== null &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          !(value instanceof OpenApiNumber)
        : kind === "scalar-json" &&
          (value instanceof OpenApiNumber ||
            typeof value === "string" ||
            typeof value === "boolean" ||
            (typeof value === "number" && Number.isFinite(value)));
  if (!valid)
    throw new Error(
      `${location} parameter ${name} requires a JSON ${expected}.`,
    );
  return value;
}
