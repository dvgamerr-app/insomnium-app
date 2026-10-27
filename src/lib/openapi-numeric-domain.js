import { countKeywords as counts, countNumber } from "./openapi-counts.js";
import { OpenApiNumber } from "./openapi-value.js";
import { schemaReferenceFields } from "./openapi-references.js";

const bounds = new Set([
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
]);

/** @param {any} value */
const numeric = (value) =>
  value instanceof OpenApiNumber || typeof value === "number";

/** Normalize decimals without expanding exponent-sized strings.
 * @param {any} value */
function decimal(value) {
  const source = String(value);
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(source);
  if (!match) throw Error("Schema numeric values must be JSON numbers.");
  let digits = (match[2] + (match[3] || "")).replace(/^0+/, "");
  if (!digits)
    return { sign: 0, digits: "0", exponent: 0n, key: "0", integer: true };
  const trailing = digits.match(/0*$/)?.[0].length || 0;
  digits = digits.slice(0, digits.length - trailing);
  const exponent =
    BigInt(match[4] || "0") -
    BigInt((match[3] || "").length) +
    BigInt(trailing);
  const sign = match[1] ? -1 : 1;
  return {
    sign,
    digits,
    exponent,
    key: sign + ":" + digits + "e" + exponent,
    integer: exponent >= 0n,
  };
}

/** @param {ReturnType<typeof decimal>} left @param {ReturnType<typeof decimal>} right */
function compare(left, right) {
  if (left.sign !== right.sign) return left.sign - right.sign;
  if (!left.sign) return 0;
  const a = BigInt(left.digits.length) + left.exponent,
    b = BigInt(right.digits.length) + right.exponent;
  if (a !== b) return (a < b ? -1 : 1) * left.sign;
  const length = Math.max(left.digits.length, right.digits.length);
  const x = left.digits.padEnd(length, "0"),
    y = right.digits.padEnd(length, "0");
  return (x === y ? 0 : x < y ? -1 : 1) * left.sign;
}

/** @param {ReturnType<typeof decimal>} value @param {ReturnType<typeof decimal>} divisor */
function multiple(value, divisor) {
  if (divisor.sign <= 0) throw Error("Schema multipleOf must be positive.");
  if (!value.sign) return true;
  const exponent = value.exponent - divisor.exponent;
  if (exponent < 0n) return false;
  let a = BigInt(value.digits),
    b = BigInt(divisor.digits);
  while (b) [a, b] = [b, a % b];
  let remainder = BigInt(divisor.digits) / a;
  const binary = remainder.toString(2),
    twos = binary.match(/0*$/)?.[0].length || 0;
  remainder >>= BigInt(twos);
  let fives = 0n;
  const chunk = 5n ** 256n;
  while (remainder % chunk === 0n) {
    remainder /= chunk;
    fives += 256n;
  }
  while (remainder % 5n === 0n) {
    remainder /= 5n;
    fives++;
  }
  return remainder === 1n && exponent >= BigInt(twos) && exponent >= fives;
}

/** Preserve JSON Schema applicators/annotations in the existing interpreter.
 * Embed the finite numeric domain into ordered, equality-preserving Number ranks;
 * integer ranks retain integer type, and multipleOf becomes an exact predicate.
 * @param {any} schema @param {any} instance */
export function projectExact(schema, instance) {
  const domain = new Map();
  /** @param {any} value */
  const register = (value) => {
    const parsed = decimal(value);
    if (!domain.has(parsed.key)) domain.set(parsed.key, parsed);
  };
  /** @param {any} data */
  const collectData = (data) => {
    if (numeric(data)) register(data);
    else if (data && typeof data === "object")
      for (const child of Object.values(data)) collectData(child);
  };
  /** @param {any} node */
  const collectSchema = (node) => {
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      if (key === "const" || key === "enum") collectData(value);
      else if ((bounds.has(key) || key === "multipleOf") && numeric(value))
        register(value);
      else {
        const role =
          schemaReferenceFields[
            /** @type {keyof typeof schemaReferenceFields} */ (key)
          ];
        if (role?.startsWith("map:") && value && typeof value === "object")
          for (const child of Object.values(value)) collectSchema(child);
        else if (
          (role === "array:schema" || role === "schemaOrArray") &&
          Array.isArray(value)
        )
          value.forEach(collectSchema);
        else if (role) collectSchema(value);
      }
    }
  };
  collectData(instance);
  collectSchema(schema);
  const ordered = [...domain.values()].sort(compare);
  const ranks = new Map(
    ordered.map((value, index) => [
      value.key,
      2 * index + (value.integer ? 2 : 2.5),
    ]),
  );
  /** @param {any} value @returns {any} */
  const data = (value) =>
    numeric(value)
      ? ranks.get(decimal(value).key)
      : Array.isArray(value)
        ? value.map(data)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value).map(([key, child]) => [key, data(child)]),
            )
          : value;
  const guards = new WeakMap();
  /** @param {any} node @returns {any} */
  const project = (node) => {
    if (!node || typeof node !== "object") return node;
    if (Array.isArray(node)) return node.map(project);
    const result = /** @type {Record<string,any>} */ ({});
    for (const [key, value] of Object.entries(node)) {
      if (key === "multipleOf") continue;
      const role =
        schemaReferenceFields[
          /** @type {keyof typeof schemaReferenceFields} */ (key)
        ];
      const children =
        role?.startsWith("map:") &&
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
          ? Object.fromEntries(
              Object.entries(value).map(([name, child]) => [
                name,
                project(child),
              ]),
            )
          : (role === "array:schema" || role === "schemaOrArray") &&
              Array.isArray(value)
            ? value.map(project)
            : role
              ? project(value)
              : value;
      Object.defineProperty(result, key, {
        enumerable: true,
        configurable: true,
        writable: true,
        value:
          key === "const" || key === "enum"
            ? data(value)
            : bounds.has(key) && numeric(value)
              ? data(value)
              : counts.has(key)
                ? countNumber(value)
                : children,
      });
    }
    if (Object.hasOwn(node, "multipleOf")) {
      const divisor = decimal(node.multipleOf);
      const invalid = ordered
        .filter((value) => !multiple(value, divisor))
        .map((value) => ranks.get(value.key));
      if (!invalid.length) return result;
      const guard = { not: { enum: invalid } };
      guards.set(guard, String(node.multipleOf));
      result.allOf = [...(result.allOf || []), guard];
    }
    return result;
  };
  const projected = project(schema);
  return { schema: projected, instance: data(instance), guards };
}
