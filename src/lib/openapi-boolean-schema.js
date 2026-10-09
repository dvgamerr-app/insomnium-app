import { Validator } from "@cfworker/json-schema";
import { sample } from "openapi-sampler";
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

/** Turn a resolved, possibly cyclic graph into local references for the
 * interpreter. Resource identities already resolved on the actual sampling path.
 * @param {Record<string,any>|boolean} schema */
export function booleanSchemaValidator(schema) {
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
      else if (assertions.has(key)) put(result, key, structuredClone(value));
    }
    // OpenAPI request sampling intentionally excludes read-only properties.
    if (Array.isArray(result.required))
      result.required = result.required.filter(
        (name) => !node.properties?.[name]?.readOnly,
      );
    definitions["s" + index] = result;
  }
  return new Validator(
    typeof root === "boolean" ? root : { ...root, $defs: definitions },
    "2020-12",
  );
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
        for (const [name, child] of Object.entries(value))
          put(map, name, visit(child));
        put(result, key, map);
      } else if (
        (role === "array:schema" || role === "schemaOrArray") &&
        Array.isArray(value)
      )
        put(result, key, value.map(visit));
      else if (role) put(result, key, visit(value));
      else put(result, key, structuredClone(value));
    }
    const impossible = () => {
      seen.set(node, false);
      return false;
    };
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

/** @param {Record<string,any>|boolean} schema @param {any} value */
export function validateBooleanSample(schema, value) {
  const result = booleanSchemaValidator(schema).validate(value);
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

/** @param {Record<string,any>|boolean} schema @param {Record<string,any>} root */
export function sampleBooleanSchema(schema, root) {
  const prepared = prepareBooleanSample(schema);
  if (prepared === false)
    throw Error("Schema accepts no value for the generated sample.");
  const value = sample(prepared, { skipReadOnly: true, quiet: true }, root);
  return validateBooleanSample(schema, value);
}
