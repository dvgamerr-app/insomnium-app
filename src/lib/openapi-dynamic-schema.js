import { sample } from "openapi-sampler";
import { schemaReferenceFields } from "./openapi-references.js";

/** @typedef {{nodes:Record<string,any>[],ids:Map<Record<string,any>,number>,bases:(string|undefined)[],references:Map<number,{keyword:string,target:number|undefined,dynamicName:string|undefined}[]>,anchors:Map<string,Map<string,number>>,bindings:Map<Record<string,any>,number>}} SchemaEvaluation */

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
    /** @type {Map<string,{value:Record<string,any>,pending:boolean,referenced:boolean}>} */ (
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
  /** @param {number} id @param {Map<string,number>} inherited @param {number} depth @returns {Record<string,any>} */
  function visit(id, inherited, depth) {
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
      value: /** @type {Record<string,any>} */ ({}),
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
      put(state.value, field, expanded);
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
      if (state.referenced) {
        for (const field of Object.keys(state.value)) delete state.value[field];
        for (const [field, value] of Object.entries(target))
          put(state.value, field, value);
      } else state.value = target;
    } else if (targets.length) {
      const siblings = { ...state.value };
      for (const field of Object.keys(state.value)) delete state.value[field];
      put(state.value, "allOf", [...targets, siblings]);
    }
    state.pending = false;
    return state.value;
  }
  return visit(entry, new Map(), 0);
}

/** @param {Record<string,any>} definition @param {Record<string,any>} root
 * @param {SchemaEvaluation|undefined} evaluation */
export function sampleApiSchema(definition, root, evaluation) {
  const entry = evaluation?.bindings.get(definition);
  const schema =
    entry === undefined || !evaluation
      ? definition
      : expandDynamicSchema(entry, evaluation);
  return sample(schema, { skipReadOnly: true, quiet: true }, root);
}
