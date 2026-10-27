const missing = Symbol("no cardinality witness");
const provided = (/** @type {any} */ s) =>
  s &&
  (s.default !== undefined ||
    s.examples?.length ||
    (s.example !== undefined &&
      Object.getOwnPropertyDescriptor(s, "example")?.writable !== false));
/** @param {any} s @param {Set<object>} [seen] @returns {boolean} */
function providedInConjunction(s, seen = new Set()) {
  if (!s || typeof s !== "object" || seen.has(s)) return false;
  seen.add(s);
  return (
    !!provided(s) ||
    s.allOf?.some((/** @type {any} */ c) => providedInConjunction(c, seen)) ||
    false
  );
}
const object = (/** @type {any} */ v) =>
  v && typeof v === "object" && !Array.isArray(v);
/** @typedef {{accepts:(s:any,v:any)=>boolean,child:(s:any)=>any,spend:(n:number,b?:number)=>void,isBudget:(e:any)=>boolean}} Context */
/** @param {any[]} schemas @returns {any} */
const conjunction = (schemas) =>
  schemas.length === 0
    ? {}
    : schemas.length === 1
      ? schemas[0]
      : { allOf: schemas };

/** Collect conjunctions without flattening applicator semantics in validation.
 * @param {any} schema */
function shape(schema) {
  const nodes = /** @type {any[]} */ ([]),
    pending = [schema],
    seen = new WeakSet();
  while (pending.length) {
    const s = pending.pop();
    if (!object(s) || seen.has(s)) continue;
    seen.add(s);
    nodes.push(s);
    if (Array.isArray(s.allOf)) pending.push(...s.allOf);
  }
  const minimum = (/** @type {string} */ key) =>
    Math.max(0, ...nodes.map((s) => s[key] ?? 0));
  const maximum = (/** @type {string} */ key) =>
    Math.min(Infinity, ...nodes.map((s) => s[key] ?? Infinity));
  const names = [
    ...new Set(nodes.flatMap((s) => Object.keys(s.properties || {}))),
  ];
  return {
    nodes,
    minItems: minimum("minItems"),
    maxItems: maximum("maxItems"),
    minProperties: minimum("minProperties"),
    maxProperties: maximum("maxProperties"),
    required: [...new Set(nodes.flatMap((s) => s.required || []))],
    names,
    propertyNames: conjunction(
      nodes
        .filter((s) => s.propertyNames !== undefined)
        .map((s) => s.propertyNames),
    ),
    contains: nodes
      .filter((s) => s.contains !== undefined)
      .map((s) => ({
        schema: s.contains,
        min: s.minContains ?? 1,
        max: s.maxContains ?? Infinity,
      })),
    unique: nodes.some((s) => s.uniqueItems === true),
    item: (/** @type {number} */ i) =>
      conjunction(
        nodes.map(
          (s) =>
            s.prefixItems?.[i] ??
            (Array.isArray(s.items)
              ? (s.items[i] ?? s.additionalItems ?? {})
              : (s.items ?? {})),
        ),
      ),
    property: (/** @type {string} */ name) =>
      conjunction(
        nodes.map((s) => {
          const patterns = Object.entries(s.patternProperties || {})
            .filter(([pattern]) => new RegExp(pattern).test(name))
            .map(([, v]) => v);
          if (Object.hasOwn(s.properties || {}, name))
            return conjunction([s.properties[name], ...patterns]);
          return patterns.length
            ? conjunction(patterns)
            : (s.additionalProperties ?? {});
        }),
      ),
  };
}
/** @param {any} schema @param {Context} ctx @param {any[]} [exclude] */
function pick(schema, ctx, exclude = []) {
  ctx.spend(1 + exclude.length);
  const checked = exclude.length
    ? { allOf: [schema, { not: { enum: exclude } }] }
    : schema;
  let candidate;
  try {
    candidate = ctx.child(checked);
    if (ctx.accepts(checked, candidate)) return candidate;
  } catch (error) {
    if (ctx.isBudget(error)) throw error;
  }
  if (providedInConjunction(schema)) return missing;
  for (const value of [
    null,
    0,
    1,
    -1,
    0.5,
    "string",
    "",
    true,
    false,
    {},
    [],
    { property: 0 },
  ])
    if (ctx.accepts(checked, value)) return value;
  return missing;
}

/** Shape the upstream allocation itself, including omitted items and bounded tuples.
 * @param {any} schema @param {string} type @param {Context|undefined} ctx */
export function allocationSchema(schema, type, ctx) {
  if (!ctx) return schema;
  if (type === "array") {
    const minimum = Math.max(
        schema.minItems ?? 0,
        schema.contains === undefined ? 0 : (schema.minContains ?? 1),
      ),
      maximum = schema.maxItems ?? Infinity;
    if (minimum > maximum) return schema;
    const tuple =
      schema.prefixItems ||
      (Array.isArray(schema.items) ? schema.items : undefined);
    const length = Math.min(maximum, Math.max(minimum, tuple?.length || 1));
    const result = { ...schema, minItems: length };
    if (schema.prefixItems)
      result.prefixItems = schema.prefixItems.slice(0, maximum);
    if (Array.isArray(schema.items))
      result.items = schema.items.slice(0, maximum);
    else if (
      schema.items === undefined &&
      schema.prefixItems === undefined &&
      schema.contains === undefined &&
      minimum > 0
    )
      result.items = {};
    return result;
  }
  if (type === "object") {
    const min = schema.minProperties ?? 0,
      max = schema.maxProperties ?? Infinity;
    if (min <= max && min > 10000) ctx.spend(Infinity);
    const entries = Object.entries(schema.properties || {}),
      required = new Set(schema.required || []);
    if (entries.length > max) {
      const selected = entries.filter(([k]) => required.has(k));
      for (const entry of entries)
        if (!required.has(entry[0]) && selected.length < max)
          selected.push(entry);
      return {
        ...schema,
        properties: Object.fromEntries(selected),
        ...(selected.length >= max ? { additionalProperties: false } : {}),
      };
    }
    if (max === 0 && !required.size)
      return { ...schema, additionalProperties: false };
  }
  return schema;
}

/** @param {any} schema @param {any[]} original @param {Context} ctx */
function arrayValue(schema, original, ctx) {
  const s = shape(schema);
  ctx.spend(s.nodes.length);
  if (s.minItems > s.maxItems) return original;
  const value = original.slice(0, s.maxItems);
  const minimum = Math.max(s.minItems, ...s.contains.map((c) => c.min), 0);
  if (minimum > s.maxItems) return original;
  if (minimum > 10000) ctx.spend(Infinity);
  for (let i = 0; i < value.length; i++)
    if (
      !ctx.accepts(s.item(i), value[i]) ||
      (s.unique && !ctx.accepts({ uniqueItems: true }, value.slice(0, i + 1)))
    ) {
      if (providedInConjunction(s.item(i))) continue;
      const item = pick(s.item(i), ctx, s.unique ? value.slice(0, i) : []);
      if (item !== missing) value[i] = item;
    }
  while (value.length < minimum) {
    const item = pick(s.item(value.length), ctx, s.unique ? value : []);
    if (item === missing) return original;
    value.push(item);
  }
  const previous = /** @type {{schema:any,min:number,max:number}[]} */ ([]);
  const matches = (/** @type {any} */ c, /** @type {any[]} */ a) => {
    ctx.spend(a.length + 1);
    let n = 0;
    for (const v of a) if (ctx.accepts(c.schema, v)) n++;
    return n;
  };
  for (const clause of s.contains) {
    let count = matches(clause, value);
    const preserve = (/** @type {any[]} */ a) =>
      previous.every((c) => {
        const n = matches(c, a);
        return n >= c.min && n <= c.max;
      });
    for (let i = 0; count < clause.min && i < value.length; i++)
      if (
        !ctx.accepts(clause.schema, value[i]) &&
        !providedInConjunction(s.item(i))
      ) {
        ctx.spend(value.length);
        const item = pick(
          conjunction([s.item(i), clause.schema]),
          ctx,
          s.unique ? value.filter((_, n) => n !== i) : [],
        );
        if (item === missing) continue;
        const trial = value.slice();
        trial[i] = item;
        if (preserve(trial)) {
          value[i] = item;
          count++;
        }
      }
    while (count < clause.min && value.length < s.maxItems) {
      if (value.length >= 10000) ctx.spend(Infinity);
      const item = pick(
        conjunction([s.item(value.length), clause.schema]),
        ctx,
        s.unique ? value : [],
      );
      if (item === missing) break;
      const trial = [...value, item];
      if (!preserve(trial)) break;
      value.push(item);
      count++;
    }
    for (let i = value.length - 1; count > clause.max && i >= 0; i--)
      if (ctx.accepts(clause.schema, value[i])) {
        const item = pick(
          conjunction([s.item(i), { not: clause.schema }]),
          ctx,
          s.unique ? value.filter((_, n) => n !== i) : [],
        );
        if (item !== missing) {
          const trial = value.slice();
          trial[i] = item;
          if (preserve(trial)) {
            value[i] = item;
            count--;
            continue;
          }
        }
        if (value.length > s.minItems) {
          const trial = value.filter((_, n) => n !== i);
          if (preserve(trial)) {
            value.splice(i, 1);
            count--;
          }
        }
      }
    previous.push(clause);
  }
  return value;
}

/** @param {any} schema @param {Record<string,any>} original @param {Context} ctx */
function objectValue(schema, original, ctx) {
  const s = shape(schema);
  if (s.minProperties > s.maxProperties) return original;
  if (s.minProperties > 10000) ctx.spend(Infinity);
  const value = { ...original },
    put = (/** @type {string} */ name, /** @type {any} */ v) =>
      Object.defineProperty(value, name, {
        enumerable: true,
        writable: true,
        configurable: true,
        value: v,
      });
  for (const name of Object.keys(value))
    if (!s.required.includes(name) && !ctx.accepts(s.propertyNames, name))
      delete value[name];
  for (const name of [...s.names, ...s.required]) {
    if (!ctx.accepts(s.propertyNames, name)) continue;
    if (
      Object.hasOwn(value, name) &&
      ctx.accepts(s.property(name), value[name])
    )
      continue;
    if (!Object.hasOwn(value, name) && !s.required.includes(name)) continue;
    const item = pick(s.property(name), ctx);
    if (item !== missing) put(name, item);
  }
  let size = Object.keys(value).length;
  for (const name of Object.keys(value).reverse())
    if (
      size > s.maxProperties &&
      !s.required.includes(name)
    ) {
      delete value[name];
      size--;
    }
  const candidates = [
    ...s.names,
    ...s.nodes
      .flatMap((n) => n.propertyNames?.enum || [])
      .filter((n) => typeof n === "string"),
  ];
  const prefixes = [
    ...s.nodes
      .flatMap((n) => Object.keys(n.patternProperties || {}))
      .map((p) => /^\^([\w-]+)/.exec(p)?.[1])
      .filter(Boolean),
    "property",
    "x",
    "a",
  ];
  let cursor = 0;
  while (size < s.minProperties && cursor < 10000) {
    ctx.spend(1);
    const name = candidates.length
      ? candidates.shift()
      : (prefixes[cursor % prefixes.length] || "property") +
        (Math.floor(cursor / prefixes.length) + 1);
    cursor++;
    if (
      !name ||
      Object.hasOwn(value, name) ||
      !ctx.accepts(s.propertyNames, name)
    )
      continue;
    const item = pick(s.property(name), ctx);
    if (item !== missing) {
      put(name, item);
      size++;
    }
  }
  return value;
}

/** Every repaired candidate must satisfy the original full schema. This also
 * supports bounded allOf/alternative plans without weakening the interpreter.
 * @param {any} schema @param {any} value @param {Context|undefined} ctx */
export function repairCardinality(schema, value, ctx) {
  if (
    !ctx ||
    provided(schema) ||
    (!Array.isArray(value) &&
      (!object(value) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(value))))
  )
    return value;
  if (ctx.accepts(schema, value)) return value;
  for (const candidate of [
    schema.const,
    ...(Array.isArray(schema.enum) ? schema.enum : []),
  ])
    if (candidate !== undefined && ctx.accepts(schema, candidate))
      return candidate;
  const plans = [
    schema,
    ...(schema.anyOf || schema.oneOf || []).map((/** @type {any} */ child) => ({
      allOf: [schema, child],
    })),
  ];
  for (const plan of plans) {
    const candidate = Array.isArray(value)
      ? arrayValue(plan, value, ctx)
      : object(value)
        ? objectValue(plan, value, ctx)
        : value;
    if (ctx.accepts(schema, candidate)) return candidate;
  }
  return value;
}
