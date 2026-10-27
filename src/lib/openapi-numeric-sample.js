import { sample, SamplerBudgetExceeded } from "./openapi-sampler.js";
import { OpenApiNumber, cloneOpenApiNumbers } from "./openapi-value.js";
import { schemaReferenceFields } from "./openapi-references.js";

const precisionLimit = 4096;
const numeric = (/** @type {any} */ v) =>
  typeof v === "number" || v instanceof OpenApiNumber;
/** @typedef {{c:bigint,e:bigint}} Decimal */
/** @param {any} value @returns {Decimal} */
function decimal(value) {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(
    String(value),
  );
  if (!match) throw Error("Numeric sampling requires finite decimal literals.");
  let digits = (match[2] + (match[3] || "")).replace(/^0+/, "");
  if (!digits) return { c: 0n, e: 0n };
  const trailing = digits.match(/0*$/)?.[0].length || 0;
  digits = digits.slice(0, digits.length - trailing);
  if (digits.length > precisionLimit)
    throw Error("Numeric sampling exceeds the significant-digit budget.");
  return {
    c: BigInt((match[1] || "") + digits),
    e:
      BigInt(match[4] || "0") -
      BigInt((match[3] || "").length) +
      BigInt(trailing),
  };
}
/** @param {bigint} n */
function power(n) {
  if (n < 0n || n > BigInt(precisionLimit))
    throw Error("Numeric sampling exceeds the arithmetic budget.");
  return 10n ** n;
}
/** @param {Decimal} v */
const token = (v) =>
  new OpenApiNumber(
    v.c === 0n ? "0" : v.e === 0n ? String(v.c) : v.c + "e" + v.e,
  );
/** @param {bigint} a @param {bigint} b */
function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}
/** Exact rational least common multiple, without expanding exponent gaps.
 * @param {Decimal[]} values @returns {Decimal} */
function lattice(values) {
  let rest = 1n,
    twos = /** @type {bigint|undefined} */ (undefined),
    fives = twos;
  for (const value of values) {
    let c = value.c,
      a = value.e,
      b = value.e;
    if (c <= 0n) throw Error("Schema multipleOf must be positive.");
    while (c % 2n === 0n) {
      c /= 2n;
      a++;
    }
    while (c % 5n === 0n) {
      c /= 5n;
      b++;
    }
    rest = (rest / gcd(rest, c)) * c;
    if (String(rest).length > precisionLimit)
      throw Error("Numeric sampling exceeds the lattice digit budget.");
    twos = twos === undefined || a > twos ? a : twos;
    fives = fives === undefined || b > fives ? b : fives;
  }
  const a = twos ?? 0n,
    b = fives ?? 0n,
    e = a < b ? a : b;
  if (a - e > BigInt(precisionLimit) || b - e > BigInt(precisionLimit))
    throw Error("Numeric sampling exceeds the lattice budget.");
  return { c: rest * 2n ** (a - e) * 5n ** (b - e), e };
}
/** @param {bigint} numerator @param {bigint} denominator */
function floor(numerator, denominator) {
  const q = numerator / denominator;
  return numerator < 0n && numerator % denominator ? q - 1n : q;
}

/** Enumerate exact witnesses near every numeric boundary and divisibility lattice.
 * The interpreter, rather than interval flattening, decides applicator semantics.
 * @param {any} schema @param {number} digits */
function* candidates(schema, digits = 1) {
  const anchors = /** @type {Decimal[]} */ ([
      decimal(0),
      decimal(1),
      decimal(-1),
    ]),
    divisors = /** @type {Decimal[]} */ ([]),
    pending = [schema],
    seen = new WeakSet();
  let count = 0;
  while (pending.length) {
    const node = pending.pop();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    if (++count > 512)
      throw Error("Numeric sampling exceeds the assertion budget.");
    for (const key of [
      "minimum",
      "maximum",
      "exclusiveMinimum",
      "exclusiveMaximum",
      "multipleOf",
    ])
      if (numeric(node[key])) {
        const value = decimal(node[key]);
        anchors.push(value);
        digits = Math.max(digits, String(value.c).length);
        if (key === "multipleOf") divisors.push(value);
      }
    for (const v of [
      node.const,
      ...(Array.isArray(node.enum) ? node.enum : []),
    ])
      if (numeric(v)) anchors.push(decimal(v));
    if (anchors.length > 4096)
      throw Error("Numeric sampling exceeds the boundary budget.");
    for (const key of ["allOf", "oneOf", "anyOf"])
      if (Array.isArray(node[key])) pending.push(...node[key]);
    for (const key of ["not", "if", "then", "else"])
      if (node[key]) pending.push(node[key]);
  }
  // Boundaries themselves preserve inclusive constraints. Decimal neighbours
  // work even when the exponent is far outside Number's finite range.
  for (const a of anchors) {
    yield token(a);
    yield token({ c: a.c * 10n - 1n, e: a.e - 1n });
    yield token({ c: a.c * 10n + 1n, e: a.e - 1n });
  }
  for (let i = 0; i < anchors.length; i++)
    for (let j = i + 1; j < anchors.length; j++) {
      const a = anchors[i],
        b = anchors[j],
        e = a.e < b.e ? a.e : b.e;
      if (a.e - e > BigInt(precisionLimit) || b.e - e > BigInt(precisionLimit))
        continue;
      // Dividing by two is multiplication by five followed by a decimal shift.
      yield token({
        c: (a.c * power(a.e - e) + b.c * power(b.e - e)) * 5n,
        e: e - 1n,
      });
    }
  const steps = [decimal(1), ...divisors];
  if (divisors.length)
    steps.push(lattice(divisors), lattice([...divisors, decimal(1)]));
  for (const original of steps)
    for (const anchor of anchors) {
      const step = { ...original };
      let delta = anchor.e - step.e;
      // A coarser positive power-of-ten multiple remains on the original lattice.
      // Keep only enough significant digits to distinguish authored boundaries.
      const budget = BigInt(
        Math.min(precisionLimit, digits + String(step.c).length + 2),
      );
      if (delta > budget) {
        step.e += delta - budget;
        delta = budget;
      }
      let q;
      if (delta < -BigInt(precisionLimit)) q = anchor.c < 0n ? -1n : 0n;
      else
        q =
          delta >= 0n
            ? floor(anchor.c * power(delta), step.c)
            : floor(anchor.c, step.c * power(-delta));
      for (const offset of [-1n, 0n, 1n, 2n])
        yield token({ c: (q + offset) * step.c, e: step.e });
    }
}

/** @param {any} node @param {WeakSet<object>} [seen] @returns {boolean} */
function authored(node, seen = new WeakSet()) {
  if (!node || typeof node !== "object" || seen.has(node)) return false;
  seen.add(node);
  if (
    ["example", "default"].some((key) => node[key] !== undefined) ||
    ["examples"].some((key) => node[key]?.length)
  )
    return true;
  return (
    ["if", "then", "else"].some((key) => authored(node[key], seen)) ||
    ["allOf", "oneOf", "anyOf"].some(
      (key) =>
        Array.isArray(node[key]) &&
        node[key].some((/** @type {any} */ child) => authored(child, seen)),
    )
  );
}
/** @param {any} node @param {WeakSet<object>} [seen] @returns {boolean} */
function numericShape(node, seen = new WeakSet()) {
  if (!node || typeof node !== "object" || seen.has(node)) return false;
  seen.add(node);
  const type = Array.isArray(node.type) ? node.type[0] : node.type;
  if (type) return type === "number" || type === "integer";
  if (
    numeric(node.const) ||
    (Array.isArray(node.enum) && numeric(node.enum[0]))
  )
    return true;
  if (node.oneOf || node.anyOf)
    return numericShape((node.oneOf || node.anyOf)[0], seen);
  return (
    [
      "minimum",
      "maximum",
      "exclusiveMinimum",
      "exclusiveMaximum",
      "multipleOf",
    ].some((key) => numeric(node[key])) ||
    node.allOf?.some((/** @type {any} */ child) => numericShape(child, seen)) ||
    false
  );
}

/** Preserve the upstream sampler's existing preference when it already satisfies
 * the exact schema. Only its working copy uses approximate numeric assertions.
 * @param {any} node @param {WeakMap<object,any>} [seen] @returns {any} */
function approximate(node, seen = new WeakMap()) {
  if (node instanceof OpenApiNumber) return Number(String(node));
  if (!node || typeof node !== "object") return node;
  if (seen.has(node)) return seen.get(node);
  const result = Array.isArray(node) ? [] : {};
  seen.set(node, result);
  for (const [key, value] of Object.entries(node))
    Object.defineProperty(result, key, {
      enumerable: true,
      writable: true,
      configurable: true,
      value: approximate(value, seen),
    });
  return result;
}

/** Add transient sampler hints only for derived numeric values. Authored values
 * retain their precedence and fail validation rather than being silently repaired.
 * @param {any} schema @param {Record<string,any>} root
 * @param {(schema:any,value:any)=>boolean} accepts */
export function prepareNumericSamples(schema, root, accepts) {
  const cache = new WeakMap();
  let count = 0;
  /** @param {any} node @returns {any} */
  function visit(node) {
    if (!node || typeof node !== "object") return node;
    if (cache.has(node)) return cache.get(node);
    if (++count > 10000)
      throw Error("Numeric sampling exceeds the schema budget.");
    let value;
    if (numericShape(node) && !authored(node) && !node.$ref) {
      let preferred;
      try {
        preferred = sample(
          approximate(node),
          { skipReadOnly: true, quiet: true },
          root,
          false,
        );
      } catch (error) {
        if (!(error instanceof SamplerBudgetExceeded)) throw error;
      }
      if (numeric(preferred) && accepts(node, preferred)) value = preferred;
      else {
        let attempts = 0;
        for (const candidate of candidates(node)) {
          if (++attempts > 4096)
            throw Error("Numeric sampling exceeds the witness budget.");
          if (accepts(node, candidate)) {
            value = candidate;
            break;
          }
        }
      }
    }
    const result = {};
    cache.set(node, result);
    for (const [key, child] of Object.entries(node)) {
      const role =
        schemaReferenceFields[
          /** @type {keyof typeof schemaReferenceFields} */ (key)
        ];
      Object.defineProperty(result, key, {
        enumerable: true,
        configurable: true,
        writable: true,
        value:
          role?.startsWith("map:") && child && typeof child === "object"
            ? Object.fromEntries(
                Object.entries(child).map(([name, entry]) => [
                  name,
                  visit(entry),
                ]),
              )
            : (role === "array:schema" || role === "schemaOrArray") &&
                Array.isArray(child)
              ? child.map(visit)
              : role
                ? visit(child)
                : cloneOpenApiNumbers(child),
      });
    }
    if (value !== undefined)
      Object.defineProperty(result, "example", { enumerable: true, value });
    return result;
  }
  return visit(schema);
}
