import { getContext } from "svelte";

export const FIELD_CONTEXT = Symbol("ui-field");

/** @typedef {{id:string, describedBy:string|undefined, invalid:boolean, disabled:boolean, readOnly:boolean}} FieldContext */

export function fieldContext() {
  return /** @type {FieldContext|undefined} */ (getContext(FIELD_CONTEXT));
}
