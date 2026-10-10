/** Shared host/guest helper-data contract. No application capabilities can be
 * supplied through data; the guest store facade is attached independently.
 * This function is embedded inside QuickJS and must remain self-contained.
 * @param {any} value */
export function validatePluginCallContext(value) {
  const record = (/** @type {any} */ item) =>
    item &&
    typeof item === "object" &&
    [Object.prototype, null].includes(Object.getPrototypeOf(item));
  if (
    !record(value) ||
    Object.keys(value).some(
      (key) => !["context", "meta", "renderPurpose"].includes(key),
    )
  )
    throw Error("Invalid plugin callback context");
  for (const key of ["context", "meta"]) {
    const item = value[key];
    if (item !== undefined && !record(item))
      throw Error("Invalid plugin callback context");
  }
  if (
    value.renderPurpose !== undefined &&
    value.renderPurpose !== null &&
    !["send", "general", "no-render"].includes(value.renderPurpose)
  )
    throw Error("Invalid plugin render purpose");
  return value;
}
