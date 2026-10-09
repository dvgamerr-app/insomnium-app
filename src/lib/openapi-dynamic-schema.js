import { sample } from "openapi-sampler";
import { schemaReferenceFields } from "./openapi-references.js";
import {
  sampleBooleanSchema,
  validateBooleanSample,
  prepareBooleanSample,
} from "./openapi-boolean-schema.js";

/** @typedef {{nodes:Record<string,any>[],ids:Map<Record<string,any>,number>,bases:(string|undefined)[],references:Map<number,{keyword:string,target:number|undefined,dynamicName:string|undefined}[]>,anchors:Map<string,Map<string,number>>,booleans:Map<number|undefined,boolean>,bindings:Map<Record<string,any>,number>}} SchemaEvaluation */

const annotations = new Set([
  "$id",
  "$schema",
  "$anchor",
  "$dynamicAnchor",
  "$comment",
  "title",
  "description",
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

/** Expand each sampling path with its own resource scope. This chooses reference
 * targets; instance validation and the sampler's existing approximation remain separate.
 * @param {number} entry @param {SchemaEvaluation} graph */
export function expandDynamicSchema(entry, graph) {
  const cache =
    /** @type {Map<string,{value:Record<string,any>|boolean,pending:boolean,referenced:boolean}>} */ (
      new Map()
    );
  let count = 0;
  let literalSize = 0;
  /** @param {any} value @returns {any} */
  function copyLiteral(value) {
    literalSize += (JSON.stringify(value) || "").length;
    if (literalSize > 8 * 1024 * 1024)
      throw Error(
        "Dynamic schema sampling exceeds the literal processing limit.",
      );
    return structuredClone(value);
  }
  /** @param {number} id @param {Map<string,number>} inherited @param {number} depth @returns {Record<string,any>|boolean} */
  function visit(id, inherited, depth) {
    if (graph.booleans.has(id))
      return /** @type {boolean} */ (graph.booleans.get(id));
    const node = graph.nodes[id];
    if (!node) throw Error("Dynamic schema reference target is unavailable.");
    const scope = new Map(inherited);
    const base = graph.bases[id];
    for (const [name, target] of (base && graph.anchors.get(base)) || [])
      if (!scope.has(name)) scope.set(name, target);
    const key =
      id +
      ":" +
      JSON.stringify([...scope].sort(([a], [b]) => a.localeCompare(b)));
    const existing = cache.get(key);
    if (existing) {
      if (existing.pending) existing.referenced = true;
      return existing.value;
    }
    if (++count > 10000 || depth > 100)
      throw Error("Dynamic schema sampling exceeds the processing limit.");
    const state = {
      value: /** @type {Record<string,any>|boolean} */ ({}),
      pending: true,
      referenced: false,
    };
    cache.set(key, state);
    const references = graph.references.get(id) || [];
    /** @param {any} child @returns {any} */
    const childSchema = (child) => {
      if (!child || typeof child !== "object" || Array.isArray(child))
        return copyLiteral(child);
      const childId = graph.ids.get(child);
      return childId === undefined
        ? copyLiteral(child)
        : visit(childId, scope, depth + 1);
    };
    for (const [field, value] of Object.entries(node)) {
      if (field === "$ref" || field === "$dynamicRef") continue;
      // Definitions declare resources but do not evaluate them on this path.
      if (["$defs", "definitions"].includes(field)) continue;
      const role =
        schemaReferenceFields[
          /** @type {keyof typeof schemaReferenceFields} */ (field)
        ];
      let expanded = value;
      if (
        role?.startsWith("map:") &&
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        expanded = {};
        for (const [name, child] of Object.entries(value))
          put(expanded, name, childSchema(child));
      } else if (
        (role === "array:schema" || role === "schemaOrArray") &&
        Array.isArray(value)
      )
        expanded = value.map(childSchema);
      else if (role) expanded = childSchema(value);
      else expanded = copyLiteral(value);
      put(/** @type {Record<string,any>} */ (state.value), field, expanded);
    }
    const targets = references.map((reference) => {
      const target =
        reference.dynamicName && scope.has(reference.dynamicName)
          ? scope.get(reference.dynamicName)
          : reference.target;
      if (target === undefined)
        throw Error("Dynamic schema reference target is unavailable.");
      return visit(target, scope, depth + 1);
    });
    if (
      targets.length === 1 &&
      Object.keys(state.value).every((field) => annotations.has(field))
    ) {
      const target = targets[0];
      if (target === state.value)
        throw Error("Schema reference cycle has no finite sample shape.");
      if (state.referenced && typeof target !== "boolean") {
        for (const field of Object.keys(state.value))
          delete (/** @type {Record<string,any>} */ (state.value)[field]);
        for (const [field, value] of Object.entries(target))
          put(/** @type {Record<string,any>} */ (state.value), field, value);
      } else state.value = target;
    } else if (targets.length) {
      const siblings = { .../** @type {Record<string,any>} */ (state.value) };
      for (const field of Object.keys(state.value))
        delete (/** @type {Record<string,any>} */ (state.value)[field]);
      put(/** @type {Record<string,any>} */ (state.value), "allOf", [
        ...targets,
        siblings,
      ]);
    }
    state.pending = false;
    return state.value;
  }
  return visit(entry, new Map(), 0);
}

/** @param {Record<string,any>|boolean} definition @param {Record<string,any>} root
 * @param {SchemaEvaluation|undefined} evaluation */
export function sampleApiSchema(definition, root, evaluation) {
  const entry =
    typeof definition === "object"
      ? evaluation?.bindings.get(definition)
      : undefined;
  const schema =
    entry === undefined || !evaluation
      ? definition
      : expandDynamicSchema(entry, evaluation);
  if (typeof schema === "boolean" || evaluation?.booleans.size)
    return sampleBooleanSchema(schema, root);
  return sample(schema, { skipReadOnly: true, quiet: true }, root);
}

/** @param {Record<string,any>|boolean} definition @param {any} value @param {SchemaEvaluation|undefined} evaluation */
export function validateApiSchemaSample(definition, value, evaluation) {
  if (typeof definition !== "boolean" && !evaluation?.booleans.size)
    return value;
  const entry =
    typeof definition === "object"
      ? evaluation?.bindings.get(definition)
      : undefined;
  return validateBooleanSample(
    entry === undefined || !evaluation
      ? definition
      : expandDynamicSchema(entry, evaluation),
    value,
  );
}

/** @param {Record<string,any>|boolean} definition @param {SchemaEvaluation|undefined} evaluation */
export function isImpossibleApiSchema(definition, evaluation) {
  if (typeof definition !== "boolean" && !evaluation?.booleans.size)
    return false;
  const entry =
    typeof definition === "object"
      ? evaluation?.bindings.get(definition)
      : undefined;
  return (
    prepareBooleanSample(
      entry === undefined || !evaluation
        ? definition
        : expandDynamicSchema(entry, evaluation),
    ) === false
  );
}
