import { countKeywords, countNumber } from "./openapi-counts.js";
import { apiObjectRole, referenceObjectFields } from "./openapi-references.js";
import { projectExact } from "./openapi-numeric-domain.js";

/** Metaschemas check enum arrays for uniqueness; their entries are arbitrary JSON
 * data. Preserve exact numeric equality in that check without changing any other
 * structural assertion, source document, payload or schema keyword.
 * @param {Record<string,any>} root
 * @param {(path:(string|number)[],fallback:any)=>any} read
 * @param {{path:(string|number)[],message:string}[]} [errors] */
export function structuralNumbers(root, read, errors = []) {
  const cache = new WeakMap();
  let count = 0;
  /** @param {any} node @param {(string|number)[]} path @returns {any} */
  function visit(node, path) {
    if (!node || typeof node !== "object") return node;
    const role = apiObjectRole(root, path);
    if (role === "other") return node;
    if (
      (root.swagger === "2.0" || /^3\.0\./.test(String(root.openapi || ""))) &&
      typeof node.$ref === "string" &&
      referenceObjectFields(role, true)
    )
      return node;
    if (cache.has(node)) return cache.get(node);
    if (++count > 100000)
      throw Error("Structural numeric validation exceeds the object budget.");
    const result = Array.isArray(node) ? [] : {};
    cache.set(node, result);
    for (const [key, value] of Object.entries(node)) {
      const schemaRole =
        role === "schema" ||
        (root.swagger === "2.0" && ["parameter", "header"].includes(role));
      const isEnum =
        key === "enum" &&
        Array.isArray(value) &&
        (role === "schema" ||
          (root.swagger === "2.0" && ["parameter", "header"].includes(role)));
      let normalizedCount;
      if (schemaRole && countKeywords.has(key)) {
        try {
          normalizedCount = countNumber(read([...path, key], value));
        } catch {
          normalizedCount = -1;
          errors.push({
            path: [...path, key],
            message: key + " must be a non-negative integer.",
          });
        }
      }
      Object.defineProperty(result, key, {
        enumerable: true,
        writable: true,
        configurable: true,
        value:
          normalizedCount !== undefined
            ? normalizedCount
            : isEnum
              ? projectExact({}, read([...path, key], value)).instance
              : key === "multipleOf" && schemaRole && typeof value === "number"
                ? structuralDivisor(read([...path, key], value))
                : visit(value, [
                    ...path,
                    Array.isArray(node) ? Number(key) : key,
                  ]),
      });
    }
    return result;
  }
  return visit(root, []);
}

/** Metaschemas assert only number type and positivity for multipleOf. A finite
 * sign representative preserves both even when binary64 underflows to zero.
 * @param {any} value */
function structuralDivisor(value) {
  const source = String(value),
    mantissa = source.split(/[eE]/)[0];
  return /[1-9]/.test(mantissa) ? (source.startsWith("-") ? -1 : 1) : 0;
}
