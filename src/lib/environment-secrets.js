/** Secret environment variables are top-level keys of `data` listed in `secretKeys`.
 * Values stay in `data` so templating and transport are unchanged; the editor masks
 * them and portable exports blank them. */
export const SECRET_MASK = "••••••••";

/** @param {unknown} keys @returns {string[]} */
export function normalizeSecretKeys(keys) {
  return Array.isArray(keys)
    ? [...new Set(keys.filter((key) => typeof key === "string"))]
    : [];
}

/** Top-level keys of an environment JSON text, or none while the text is invalid.
 * @param {string} text @returns {string[]} */
export function environmentTopLevelKeys(text) {
  try {
    const data = JSON.parse(text);
    return data && typeof data === "object" && !Array.isArray(data) ? Object.keys(data) : [];
  } catch {
    return [];
  }
}

/** @param {Record<string, any>} data @param {string[]} secretKeys */
export function maskSecretValues(data, secretKeys) {
  const copy = { ...data };
  for (const key of secretKeys) if (Object.hasOwn(copy, key)) copy[key] = SECRET_MASK;
  return copy;
}

/** Restore real values for secret keys whose edited value is still the mask.
 * @param {Record<string, any>} edited @param {Record<string, any>} original @param {string[]} secretKeys */
export function restoreSecretValues(edited, original, secretKeys) {
  const copy = { ...edited };
  for (const key of secretKeys)
    if (copy[key] === SECRET_MASK && Object.hasOwn(original, key)) copy[key] = original[key];
  return copy;
}

/** Blank secret values for files that leave this machine. Other resources pass through.
 * @param {Record<string, any>} resource */
export function redactEnvironment(resource) {
  if (resource._type !== "environment") return resource;
  const keys = normalizeSecretKeys(resource.secretKeys);
  if (!keys.length) return resource;
  /** @param {Record<string, any>} data */
  const blank = (data) => {
    const copy = { ...data };
    for (const key of keys) if (Object.hasOwn(copy, key)) copy[key] = "";
    return copy;
  };
  const copy = { ...resource };
  if (resource.data && typeof resource.data === "object") copy.data = blank(resource.data);
  const record = resource._legacySource?.record;
  if (record?.data && typeof record.data === "object")
    copy._legacySource = { ...resource._legacySource, record: { ...record, data: blank(record.data) } };
  return copy;
}
