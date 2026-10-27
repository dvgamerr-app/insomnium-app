import { prepareCountSchema } from "./openapi-counts.js";
import { prepareNumericSamples } from "./openapi-numeric-sample.js";
import { validateExact } from "./openapi-exact-validation.js";
import { OpenApiNumber, cloneOpenApiNumbers } from "./openapi-value.js";
import { sample } from "./openapi-sampler.js";
import { schemaReferenceFields } from "./openapi-references.js";

const assertions = new Set([
  "type",
  "const",
  "enum",
  "multipleOf",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minLength",
  "maxLength",
  "pattern",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minContains",
  "maxContains",
  "minProperties",
  "maxProperties",
  "required",
  "dependentRequired",
]);
/** @param {Record<string,any>} target @param {string} key @param {any} value */
function put(target, key, value) {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

/** Request sampling skips read-only properties. An allOf/ref expansion can
 * carry that annotation below the property root; alternatives and conditionals
 * are not unconditional annotations and must not be flattened here.
 * @param {any} schema */
function readOnlyProperty(schema) {
  const pending = [schema];
  const seen = new Set();
  while (pending.length) {
    const node = pending.pop();
    if (
      !node ||
      typeof node !== "object" ||
      Array.isArray(node) ||
      seen.has(node)
    )
      continue;
    seen.add(node);
    if (seen.size > 10000)
      throw Error("Read-only schema sampling exceeds the processing limit.");
    if (node.readOnly === true) return true;
    if (Array.isArray(node.allOf))
      for (const branch of node.allOf) pending.push(branch);
  }
  return false;
}

/** Turn a resolved, possibly cyclic graph into local references for the
 * interpreter. Resource identities already resolved on the actual sampling path.
 * @param {Record<string,any>|boolean} schema @param {string} [version] */
export function booleanSchemaValidator(schema, version = "") {
  const pending = /** @type {Record<string,any>[]} */ ([]);
  const ids = new Map();
  const definitions = /** @type {Record<string,any>} */ ({});
  /** @param {any} child @returns {any} */
  const link = (child) => {
    if (typeof child === "boolean") return child;
    if (!child || typeof child !== "object" || Array.isArray(child))
      return true;
    if (!ids.has(child)) {
      if (pending.length >= 10000)
        throw Error("Schema validation exceeds the processing limit.");
      ids.set(child, pending.length);
      pending.push(child);
    }
    return { $ref: "#/$defs/s" + ids.get(child) };
  };
  const root = link(schema);
  for (let index = 0; index < pending.length; index++) {
    const node = pending[index],
      result = /** @type {Record<string,any>} */ ({});
    for (const [key, value] of Object.entries(node)) {
      if (value === undefined) continue;
      if (
        ["$defs", "definitions", "contentSchema", "dependencies"].includes(key)
      )
        continue;
      const role =
        schemaReferenceFields[
          /** @type {keyof typeof schemaReferenceFields} */ (key)
        ];
      if (
        role?.startsWith("map:") &&
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        const map = {};
        for (const [name, child] of Object.entries(value))
          put(map, name, link(child));
        put(result, key, map);
      } else if (
        (role === "array:schema" || role === "schemaOrArray") &&
        Array.isArray(value)
      )
        put(result, key, value.map(link));
      else if (role) put(result, key, link(value));
      else if (assertions.has(key))
        put(result, key, cloneOpenApiNumbers(value));
    }
    if (version === "2.0" || /^3\.0\./.test(version)) {
      // Draft-4 bounds are boolean modifiers; the projection uses numeric
      // exclusive bounds. Nullable changes type only, retaining enum/allOf/etc.
      for (const [flag, bound] of [
        ["exclusiveMinimum", "minimum"],
        ["exclusiveMaximum", "maximum"],
      ]) {
        if (typeof node[flag] === "boolean") {
          delete result[flag];
          if (
            node[flag] &&
            (typeof node[bound] === "number" ||
              node[bound] instanceof OpenApiNumber)
          )
            put(result, flag, node[bound]);
        }
      }
      if (
        /^3\.0\./.test(version) &&
        node.nullable === true &&
        typeof node.type === "string"
      )
        put(result, "type", [node.type, "null"]);
    }
    // OpenAPI request sampling intentionally excludes read-only properties.
    if (Array.isArray(result.required))
      result.required = result.required.filter(
        (name) => !readOnlyProperty(node.properties?.[name]),
      );
    definitions["s" + index] = result;
  }
  const projected =
    typeof root === "boolean" ? root : { ...root, $defs: definitions };
  return {
    validate: (/** @type {any} */ instance) =>
      validateExact(projected, instance),
  };
}

/** Preserve false as an impossible branch; omit forbidden optional properties
 * and select viable boolean branches before using the existing sampler.
 * @param {Record<string,any>|boolean} schema */
export function prepareBooleanSample(schema) {
  const seen = /** @type {WeakMap<object,Record<string,any>|boolean>} */ (
    new WeakMap()
  );
  let count = 0;
  /** @param {any} node @returns {any} */
  function visit(node) {
    if (typeof node === "boolean") return node ? {} : false;
    if (!node || typeof node !== "object" || Array.isArray(node)) return node;
    if (seen.has(node)) return seen.get(node);
    if (++count > 10000)
      throw Error("Boolean schema sampling exceeds the processing limit.");
    const result = /** @type {Record<string,any>} */ ({});
    seen.set(node, result);
    for (const [key, value] of Object.entries(node)) {
      const role =
        schemaReferenceFields[
          /** @type {keyof typeof schemaReferenceFields} */ (key)
        ];
      if (["$defs", "definitions"].includes(key)) continue;
      if (
        role?.startsWith("map:") &&
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        const map = {};
        for (const [name, child] of Object.entries(value)) {
          if (key === "properties" && readOnlyProperty(child)) continue;
          put(map, name, visit(child));
        }
        put(result, key, map);
      } else if (
        (role === "array:schema" || role === "schemaOrArray") &&
        Array.isArray(value)
      )
        put(result, key, value.map(visit));
      else if (role) put(result, key, visit(value));
      else put(result, key, cloneOpenApiNumbers(value));
    }
    const impossible = () => {
      seen.set(node, false);
      return false;
    };
    if (Array.isArray(result.required))
      result.required = result.required.filter(
        (name) => !readOnlyProperty(node.properties?.[name]),
      );
    if (result.allOf?.includes(false)) return impossible();
    for (const keyword of ["anyOf", "oneOf"])
      if (Array.isArray(result[keyword])) {
        result[keyword] = result[keyword].filter(
          /** @param {any} branch */ (branch) => branch !== false,
        );
        if (!result[keyword].length) return impossible();
      }
    if (node.not === true) return impossible();
    if (node.not === false) delete result.not;
    if (typeof node.if === "boolean") {
      const chosen = node.if ? result.then : result.else;
      delete result.if;
      delete result.then;
      delete result.else;
      if (chosen === false) return impossible();
      if (chosen) result.allOf = [...(result.allOf || []), chosen];
    }
    for (const [name, child] of Object.entries(result.properties || {}))
      if (child === false) {
        if ((result.required || []).includes(name)) {
          if (result.type === "object") return impossible();
          if (Array.isArray(result.type)) {
            result.type = result.type.filter(
              /** @param {string} type */ (type) => type !== "object",
            );
            if (!result.type.length) return impossible();
          } else if (!result.type) result.const = null;
        }
        delete result.properties[name];
      }
    let limit = Infinity;
    if (Array.isArray(result.prefixItems)) {
      const forbidden = result.prefixItems.indexOf(false);
      if (forbidden !== -1) {
        limit = forbidden;
        result.prefixItems = result.prefixItems.slice(0, forbidden);
      }
    }
    if (result.items === false) {
      limit = Math.min(limit, result.prefixItems?.length || 0);
      delete result.items;
    }
    if (limit !== Infinity) {
      result.maxItems = Math.min(result.maxItems ?? Infinity, limit);
      if ((result.minItems || 0) > result.maxItems) {
        if (result.type === "array") return impossible();
        result.const = null;
      }
    }
    return result;
  }
  return visit(schema);
}

/** @param {Record<string,any>|boolean} schema @param {any} value @param {string} [version] */
export function validateBooleanSample(schema, value, version = "") {
  const result = booleanSchemaValidator(schema, version).validate(value);
  if (!result.valid)
    throw Error(
      "Example does not satisfy the schema: " +
        result.errors
          .slice(0, 3)
          .map((error) => error.instanceLocation + " " + error.keyword)
          .join(", "),
    );
  return value;
}

/** @param {Record<string,any>|boolean} schema @param {Record<string,any>} root @param {boolean} [deferValidation] @param {string} [version] */
export function sampleBooleanSchema(
  schema,
  root,
  deferValidation = false,
  version = "",
) {
  const prepared = prepareBooleanSample(prepareCountSchema(schema));
  if (prepared === false)
    throw Error("Schema accepts no value for the generated sample.");
  const validators = new WeakMap();
  const accepts = (/** @type {any} */ node, /** @type {any} */ value) => {
    if (typeof node === "boolean") return node;
    let validator = validators.get(node);
    if (!validator) {
      validator = booleanSchemaValidator(node, version);
      validators.set(node, validator);
    }
    return validator.validate(value).valid;
  };
  const numeric = prepareNumericSamples(prepared, root, accepts);
  const value = sample(numeric, { skipReadOnly: true, quiet: true }, root, {
    accepts,
    child: (child) => sampleBooleanSchema(child, root, true, version),
  });
  return deferValidation
    ? value
    : validateBooleanSample(schema, value, version);
}
