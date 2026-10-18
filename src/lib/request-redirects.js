/** Blank retains the application's existing ten-redirect policy.
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
