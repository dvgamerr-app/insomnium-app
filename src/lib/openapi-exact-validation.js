import { Validator } from "@cfworker/json-schema";
import { projectExact } from "./openapi-numeric-domain.js";
const bounds = new Set([
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
]);

/** @param {any} schema @param {any} instance */
export function validateExact(schema, instance) {
  const {
    schema: projected,
    instance: projectedInstance,
    guards,
  } = projectExact(schema, instance);
  const result = new Validator(projected, "2020-12").validate(
    projectedInstance,
  );
  /** Resolve the interpreter's evaluation path, including its local $ref steps.
   * @param {string} pointer */
  const at = (pointer) => {
    let node = projected;
    for (const part of pointer.slice(2).split("/").filter(Boolean)) {
      if (part === "$ref" && typeof node?.$ref === "string") {
        node = node.$ref
          .slice(2)
          .split("/")
          .reduce(
            (/** @type {any} */ target, /** @type {string} */ key) =>
              target?.[key.replaceAll("~1", "/").replaceAll("~0", "~")],
            projected,
          );
      } else node = node?.[part.replaceAll("~1", "/").replaceAll("~0", "~")];
    }
    return node;
  };
  const exactErrors = [],
    otherErrors = [];
  for (const error of result.errors) {
    const parent = at(
      error.keywordLocation.slice(0, error.keywordLocation.lastIndexOf("/")),
    );
    if (error.keyword === "not" && parent && guards.has(parent))
      exactErrors.push({
        ...error,
        keyword: "multipleOf",
        error: "Number is not an exact multiple of " + guards.get(parent) + ".",
      });
    else
      otherErrors.push(
        bounds.has(error.keyword) || ["enum", "const"].includes(error.keyword)
          ? {
              ...error,
              error: "Instance does not satisfy " + error.keyword + ".",
            }
          : error,
      );
  }
  return { ...result, errors: [...exactErrors, ...otherErrors] };
}
