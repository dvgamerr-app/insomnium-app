/** Serialize OpenAPI simple header values without URI encoding or automatic quoting.
 * @param {string} name @param {string} text
 * @param {{style:string,explode:boolean,kind:string}} options */
export function serializeOpenApiHeader(name, text, { style, explode, kind }) {
  if (style !== "simple") throw new Error(`Unsupported header style ${style}.`);
  const atom = (/** @type {unknown} */ value) => {
    if (
      value !== null &&
      !["string", "number", "boolean"].includes(typeof value)
    )
      throw new Error(`Header parameter ${name} requires flat scalar values.`);
    const result = String(value ?? "");
    if (/[\u0000-\u0008\u000a-\u001f\u007f]/.test(result))
      throw new Error(
        `Header parameter ${name} contains invalid control characters.`,
      );
    return result;
  };
  if (kind === "scalar") return atom(text);
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`Header parameter ${name} requires valid JSON ${kind}.`);
  }
  if (kind === "array") {
    if (!Array.isArray(value))
      throw new Error(`Header parameter ${name} requires a JSON array.`);
    return value.map(atom).join(",");
  }
  if (
    kind !== "object" ||
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  )
    throw new Error(`Header parameter ${name} requires a JSON object.`);
  return Object.entries(value)
    .map(([key, item]) =>
      explode ? `${atom(key)}=${atom(item)}` : `${atom(key)},${atom(item)}`,
    )
    .join(",");
}
