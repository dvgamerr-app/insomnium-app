// Host-only identity records. Abort reasons supplied by a guest or another
// caller cannot grant completion authority or revive a cancelled operation.
const completed = new WeakSet();
const parents = new WeakMap();

/** Preserve the authority above a derived signal even after normal cleanup.
 * @param {AbortSignal} child @param {AbortSignal} parent */
export function linkPluginRequestSignal(child, parent) {
  if (child === parent || parents.has(child))
    throw new Error("Plugin request signal already has an owner");
  let cursor = parent;
  const seen = new Set([child]);
  while (cursor) {
    if (seen.has(cursor)) throw new Error("Cyclic plugin request owner");
    seen.add(cursor);
    cursor = parents.get(cursor);
  }
  parents.set(child, parent);
}

/** Ordinary operation listeners still receive Abort; retained UI alone may
 * survive this explicit host completion. Cancellation is never promoted.
 * @param {AbortController} controller @param {unknown} [reason] */
export function completePluginRequest(controller, reason) {
  if (controller.signal.aborted) return;
  completed.add(controller.signal);
  controller.abort(reason);
}

/** @param {AbortSignal} signal */
export function pluginRequestIsCurrent(signal) {
  let cursor = signal;
  const seen = new Set();
  while (cursor) {
    if (seen.has(cursor) || (cursor.aborted && !completed.has(cursor)))
      return false;
    seen.add(cursor);
    cursor = parents.get(cursor);
  }
  return true;
}

/** @param {AbortSignal} signal */
export function pluginRequestCompleted(signal) {
  return completed.has(signal) && pluginRequestIsCurrent(signal);
}
