import {getContext, setContext} from "svelte";

const PASSWORD_VISIBILITY = Symbol("password-visibility");

// A getter follows workspace replacement without retaining a previous profile.
/** @param {()=>boolean} reveal */
export function providePasswordVisibility(reveal) {
  setContext(PASSWORD_VISIBILITY, reveal);
}

export function passwordVisibility() {
  return /** @type {()=>boolean} */ (getContext(PASSWORD_VISIBILITY) ?? (() => false));
}

/** Only an explicit boolean preference changes password presentation.
 * @param {import('svelte/elements').HTMLInputTypeAttribute|null|undefined} type
 * @param {unknown} reveal */
export function visibleInputType(type, reveal) {
  return type === "password" && reveal === true ? "text" : type;
}
