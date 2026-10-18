/** Blank leaves this level's redirect limit unspecified.
 * @param {unknown} value */
export function redirectLimit(value) {
  if (value == null || value === "") return null;
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !/^(?:-1|\d+)$/.test(value)) ||
    !Number.isInteger(Number(value)) ||
    Number(value) < -1 ||
    Number(value) > 2147483647
  )
    throw new Error(
      "Maximum redirects must be -1 (unlimited) or a whole number from 0 to 2,147,483,647.",
    );
  return Number(value);
}

/** Request overrides take precedence; the ordinary default keeps its old IPC shape.
 * @param {Record<string,any>} settings @param {Record<string,any>} request */
export function requestRedirectLimit(settings, request) {
  const override = redirectLimit(request.settingMaxRedirects);
  if (override !== null) return override;
  const global = redirectLimit(settings.maxRedirects);
  return global === 10 ? null : global;
}
