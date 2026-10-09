import { getContext } from "svelte";

export const FIELD_CONTEXT = Symbol("ui-field");

/** @typedef {{id:string, describedBy:string|undefined, invalid:boolean, required:boolean, disabled:boolean, readOnly:boolean}} FieldContext */

export function fieldContext() {
  return /** @type {FieldContext|undefined} */ (getContext(FIELD_CONTEXT));
}

/** Combine caller help with reactive Field feedback; keep reading order and unique ID references.
 * @param {string|null|undefined} explicit @param {string|undefined} inherited */
export function fieldDescriptions(explicit, inherited) {
  const ids = [explicit, inherited].flatMap((value) =>
    (value || "").split(/[\t\n\f\r ]+/).filter(Boolean),
  );
  return [...new Set(ids)].join(" ") || undefined;
}
