/** Keep nullable JSON values distinct from ordinary editor strings.
 * @param {any} value @param {Record<string,any>} schema @param {boolean} enabled */
export function describeOpenApiValue(value, schema, enabled) {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const nullable =
    enabled &&
    (value === null || schema.nullable === true || types.includes("null"));
  const compound = value !== null && typeof value === "object";
  const kind = compound
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
      compound || nullable
        ? JSON.stringify(value ?? null)
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
    value = JSON.parse(text);
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
        ? value !== null && typeof value === "object" && !Array.isArray(value)
        : kind === "scalar-json" &&
          (typeof value === "string" ||
            typeof value === "boolean" ||
            (typeof value === "number" && Number.isFinite(value)));
  if (!valid)
    throw new Error(
      `${location} parameter ${name} requires a JSON ${expected}.`,
    );
  return value;
}
