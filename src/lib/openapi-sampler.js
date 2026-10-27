import { allocationSchema, repairCardinality } from "./openapi-cardinality.js";
import * as samplerModule from "openapi-sampler";
const { sample: upstream } = samplerModule;
const { _registerSampler, _samplers } =
  /** @type {{_registerSampler:(type:string,fn:(...args:any[])=>any)=>void,_samplers:Record<string,(...args:any[])=>any>}} */ (
    /** @type {unknown} */ (samplerModule)
  );
import samplerPackage from "openapi-sampler/package.json";

// These exported extension hooks are pinned to the inspected upstream version.
// Guard actual allocation sites after upstream applicator/ref/annotation choice,
// rather than rejecting a large constraint in an unused branch or an example.
if (samplerPackage.version !== "1.7.8")
  throw Error("Review OpenAPI sampler allocation hooks before upgrading.");
const originals = { ..._samplers };
/** @type {{nodes:number,bytes:number,depth:number}|undefined} */
let active;
/** @type {{accepts:(s:any,v:any)=>boolean,child?:(s:any)=>any}|undefined} */
let controller;
export class SamplerBudgetExceeded extends Error {
  constructor() {
    super(
      "Automatic sample exceeds the sampling budget. Supply an explicit example or revise the schema.",
    );
  }
}
function exceeded() {
  throw new SamplerBudgetExceeded();
}
/** @param {number} nodes @param {number} [bytes] */
function spend(nodes, bytes = 0) {
  if (!active) return;
  active.nodes -= nodes;
  active.bytes -= bytes;
  if (active.nodes < 0 || active.bytes < 0 || !Number.isFinite(nodes + bytes))
    exceeded();
}
/** Count occurrences, including repeated authored values, before a generated
 * result can reach JSON serialization. Bound traversal as well as allocations.
 * @param {any} value @param {Set<object>} [ancestors] */
function account(value, ancestors = new Set()) {
  spend(1);
  if (typeof value === "string") {
    spend(0, value.length * 6 + 2);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (ancestors.has(value)) exceeded();
  ancestors.add(value);
  if (Array.isArray(value)) {
    for (const child of value) account(child, ancestors);
  } else
    for (const key in value)
      if (Object.hasOwn(value, key)) {
        spend(0, key.length * 6 + 4);
        account(value[key], ancestors);
      }
  ancestors.delete(value);
}
for (const type of [
  "array",
  "object",
  "string",
  "number",
  "integer",
  "boolean",
]) {
  const original = originals[type];
  if (typeof original !== "function")
    throw Error("OpenAPI sampler allocation hook is unavailable.");
  _registerSampler(
    type,
    (
      /** @type {any} */ schema,
      /** @type {any} */ options,
      /** @type {any} */ spec,
      /** @type {any} */ context,
    ) => {
      if (!active) return original(schema, options, spec, context);
      spend(1);
      const control = controller && {
        accepts: controller.accepts,
        child: controller.child || ((child) => sample(child, options, spec)),
        spend,
        isBudget: (/** @type {any} */ error) =>
          error instanceof SamplerBudgetExceeded,
      };
      const working = allocationSchema(schema, type, control);
      if (type === "array") {
        const items = working.prefixItems || working.items || working.contains;
        let length = Math.min(
          working.maxItems ?? Infinity,
          working.minItems || 1,
        );
        if (Array.isArray(items)) length = Math.max(length, items.length);
        if (items && (length > 10000 || !Number.isFinite(length))) exceeded();
        if (items) spend(length);
      } else if (type === "string") {
        const length = Number(schema.minLength || 0);
        if (!Number.isFinite(length) || length * 6 > active.bytes) exceeded();
      } else if (type === "object") {
        spend(Object.keys(schema.properties || {}).length);
      }
      const result = repairCardinality(
        schema,
        original(working, options, spec, context),
        control,
      );
      account(result);
      return result;
    },
  );
}

/** Each synchronous sample owns a fresh work budget; nested invocations share it.
 * An exception always releases ownership, including failed numeric preferences.
 * @param {any} schema @param {any} options @param {any} root
 * @param {false|{accepts:(s:any,v:any)=>boolean,child?:(s:any)=>any}} [control] @returns {any} */
export function sample(schema, options, root, control = controller) {
  const previous = active,
    previousControl = controller;
  controller = control || undefined;
  active ??= { nodes: 100000, bytes: 8 * 1024 * 1024, depth: 0 };
  try {
    if (++active.depth > 64) exceeded();
    return repairCardinality(
      schema,
      upstream(schema, options, root),
      controller && {
        accepts: controller.accepts,
        child: controller.child || ((child) => sample(child, options, root)),
        spend,
        isBudget: (error) => error instanceof SamplerBudgetExceeded,
      },
    );
  } finally {
    if (active) active.depth--;
    active = previous;
    controller = previousControl;
  }
}
