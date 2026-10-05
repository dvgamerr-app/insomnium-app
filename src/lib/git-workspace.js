import { requestTypes, validateTopology } from "./resources.js";
import { validEnvironmentSelection, workspaceFor } from "./model.js";

/** Build the full durable candidate without normalizing away history, metadata or
 * settings. Only invalid request/environment selections and tabs are repaired.
 * @param {Record<string,any>} before @param {Record<string,any>[]} resources */
export function checkoutWorkspace(before, resources) {
  const result = JSON.parse(JSON.stringify({ ...before, resources }));
  validateTopology(result.resources);
  const byId = new Map(
    result.resources.map((/** @type {Record<string,any>} */ r) => [r._id, r]),
  );
  if (byId.get(result.activeWorkspaceId)?._type !== "workspace")
    throw new Error("Checkout lost the active collection.");
  if (
    Object.hasOwn(result, "activeRequestId") &&
    (!requestTypes.includes(byId.get(result.activeRequestId)?._type) ||
      workspaceFor(result.resources, result.activeRequestId) !==
        result.activeWorkspaceId)
  )
    result.activeRequestId = "";
  if (Object.hasOwn(result, "activeEnvironmentId"))
    result.activeEnvironmentId = validEnvironmentSelection(
      result.resources,
      result.activeWorkspaceId,
      result.activeEnvironmentId,
    );
  if (Object.hasOwn(result, "openTabs")) {
    if (
      !Array.isArray(result.openTabs) ||
      result.openTabs.some(
        (/** @type {unknown} */ id) => typeof id !== "string",
      )
    )
      throw new Error("Invalid checkout request tabs.");
    result.openTabs = result.openTabs.filter(
      (/** @type {string} */ id) =>
        requestTypes.includes(byId.get(id)?._type) &&
        workspaceFor(result.resources, id),
    );
  }
  return result;
}

/** JSON equality independent of native object-key ordering.
 * @param {any} value @returns {any} */
function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, ordered(value[key])]),
    );
  return value;
}
/** @param {unknown} left @param {unknown} right */
export function sameWorkspace(left, right) {
  return JSON.stringify(ordered(left)) === JSON.stringify(ordered(right));
}
