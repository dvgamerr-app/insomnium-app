import { OpenApiNumber, cloneOpenApiNumbers } from "./openapi-value.js";
import { schemaReferenceFields } from "./openapi-references.js";

export const countKeywords = new Set([
  "minItems",
  "maxItems",
  "minLength",
  "maxLength",
  "minContains",
  "maxContains",
  "minProperties",
  "maxProperties",
]);
export class InvalidOpenApiCount extends Error {
  constructor() {
    super("Schema counts must be non-negative integers.");
  }
}
/** Instance cardinalities are safe integers. Capping larger valid counts to
 * an exactly representable sentinel ABOVE that range preserves comparisons, without
 * turning an arbitrary-size JSON integer into Infinity or rounding a fraction.
 * @param {any} value */
export function countNumber(value) {
  const valid =
    value instanceof OpenApiNumber
      ? value.isInteger() &&
        (!String(value).startsWith("-") ||
          !/[1-9]/.test(String(value).split(/[eE]/)[0]))
      : typeof value === "number" &&
        Number.isFinite(value) &&
        Number.isInteger(value) &&
        value >= 0;
  if (!valid) throw new InvalidOpenApiCount();
  return Math.min(Number(String(value)), Number.MAX_SAFE_INTEGER + 1);
}

/** Normalize only actual schema count keywords before the upstream sampler.
 * @param {any} schema */
export function prepareCountSchema(schema) {
  const cache = new WeakMap();
  let count = 0;
  /** @param {any} node @returns {any} */
  function visit(node) {
    if (!node || typeof node !== "object") return node;
    if (Array.isArray(node)) return cloneOpenApiNumbers(node);
    if (cache.has(node)) return cache.get(node);
    if (++count > 10000)
      throw Error("Count sampling exceeds the schema budget.");
    const result = {};
    cache.set(node, result);
    for (const [key, value] of Object.entries(node)) {
      const role =
        schemaReferenceFields[
          /** @type {keyof typeof schemaReferenceFields} */ (key)
        ];
      Object.defineProperty(result, key, {
        enumerable: true,
        writable: true,
        configurable: true,
        value: countKeywords.has(key)
          ? countNumber(value)
          : role?.startsWith("map:") && value && typeof value === "object"
            ? Object.fromEntries(
                Object.entries(value).map(([name, child]) => [
                  name,
                  visit(child),
                ]),
              )
            : (role === "array:schema" || role === "schemaOrArray") &&
                Array.isArray(value)
              ? value.map(visit)
              : role
                ? visit(value)
                : cloneOpenApiNumbers(value),
      });
    }
    return result;
  }
  return visit(schema);
}
