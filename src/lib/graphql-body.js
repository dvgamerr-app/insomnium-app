/** Read the saved envelope before rendering or transport coercion. Textual
 * variables remain supported for the legacy variables editor.
 * @param {string} text */
export function readGraphqlBody(text) {
  const value = JSON.parse(text || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("GraphQL body must be a JSON object.");
  if (value.query != null && typeof value.query !== "string")
    throw new Error("GraphQL query must be text.");
  if (value.operationName != null && typeof value.operationName !== "string")
    throw new Error("GraphQL operation name must be text.");
  if (value.variables != null && typeof value.variables !== "string" &&
      (typeof value.variables !== "object" || Array.isArray(value.variables)))
    throw new Error("GraphQL variables must be a JSON object.");
  if (value.extensions != null &&
      (typeof value.extensions !== "object" || Array.isArray(value.extensions)))
    throw new Error("GraphQL extensions must be a JSON object.");
  return value;
}
