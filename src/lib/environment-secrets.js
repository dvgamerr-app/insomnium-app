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

/** Blank secret values and their imported provenance for portable files.
 * @param {Record<string, any>} resource @param {Map<string, Record<string, any>>} baseEnvironments */
export function redactEnvironment(resource, baseEnvironments) {
  const environment = resource._type === "environment" ? resource
    : resource._type === "workspace" ? baseEnvironments.get(resource._id) : null;
  if (!environment) return resource;
  const keys = normalizeSecretKeys(environment.secretKeys);
  if (!keys.length) return resource;
  const secretKeys = new Set(keys);
  /** @param {Record<string, any>} data */
  const blank = (data) => {
    const copy = { ...data };
    for (const key of keys) if (Object.hasOwn(copy, key)) copy[key] = "";
    return copy;
  };
  /** @param {any} source */
  const redactSource = (source) => {
    if (!source || typeof source !== "object" || Array.isArray(source)) return source;
    const copy = { ...source };
    for (const field of resource._type === "workspace" ? ["variable"] : ["values", "variable"])
      if (Array.isArray(source[field])) copy[field] = source[field].map((/** @type {any} */ row) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return row;
        const key = field === "values" ? row.key : row.key || row.id;
        // Import normalizes collection variable aliases to object property keys.
        return (field === "values" || key) && secretKeys.has(String(key)) && Object.hasOwn(row, "value")
          ? { ...row, value: "" } : row;
      });
    return copy;
  };
  const copy = { ...resource };
  if (resource._type === "environment" && resource.data && typeof resource.data === "object") copy.data = blank(resource.data);
  if (Object.hasOwn(resource, "_postmanSource")) copy._postmanSource = redactSource(resource._postmanSource);
  const record = resource._legacySource?.record;
  if (record && typeof record === "object" && !Array.isArray(record)) {
    const portableRecord = { ...record };
    if (resource._type === "environment" && record.data && typeof record.data === "object") portableRecord.data = blank(record.data);
    if (Object.hasOwn(record, "_postmanSource")) portableRecord._postmanSource = redactSource(record._postmanSource);
    copy._legacySource = { ...resource._legacySource, record: portableRecord };
  }
  return copy;
}
