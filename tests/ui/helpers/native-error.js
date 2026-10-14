/** Keep nested native scenario failures without serializing arbitrary properties.
 * Bounds match the reviewed operator diagnostic:32 nodes,6 levels, bounded text.
 * @param {unknown} error @returns {Record<string,any>} */
export function nativeErrorTree(error) {
  let count = 0;
  const seen = new Set();
  /** @param {unknown} value */
  const text = (value) => {
    try {
      return String(value);
    } catch {
      return "<unprintable failure>";
    }
  };
  /** @param {unknown} value @param {string} name */
  const property = (value, name) => {
    try {
      return value == null ? undefined : Reflect.get(Object(value), name);
    } catch {
      return undefined;
    }
  };
  /** @param {unknown} value @param {number} depth @returns {Record<string,any>} */
  const visit = (value, depth) => {
    if (count++ >= 32 || depth > 6) return { truncated: true };
    if (
      value !== null &&
      (typeof value === "object" || typeof value === "function")
    ) {
      if (seen.has(value)) return { cycle: true };
      seen.add(value);
    }
    const stack = property(value, "stack");
    const result = /** @type {Record<string,any>} */ ({
      name: text(property(value, "name") ?? "Error").slice(0, 256),
      message: text(property(value, "message") ?? value).slice(0, 8192),
      stack: typeof stack === "string" ? stack.slice(0, 16384) : null,
    });
    const cause = property(value, "cause"),
      children = property(value, "errors");
    if (cause !== undefined) result.cause = visit(cause, depth + 1);
    if (Array.isArray(children))
      result.errors = children
        .slice(0, 32)
        .map((child) => visit(child, depth + 1));
    return result;
  };
  return visit(error, 0);
}
