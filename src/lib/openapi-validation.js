import { structuralNumbers } from "./openapi-structural-numbers.js";
import v2 from "./generated/openapi-2.0.js";
import v30 from "./generated/openapi-3.0.js";
import v31 from "./generated/openapi-3.1.js";
import v32 from "./generated/openapi-3.2.js";

/** @param {Record<string, any>} value
 * @param {(path:(string|number)[],fallback:any)=>any} [read] */
export function validateApiDocument(
  value,
  read = (path, fallback) => fallback,
) {
  const version =
    value.swagger === "2.0"
      ? "2.0"
      : String(value.openapi || "")
          .split(".")
          .slice(0, 2)
          .join(".");
  const validators = /** @type {Record<string, any>} */ ({
    "2.0": v2,
    "3.0": v30,
    3.1: v31,
    3.2: v32,
  });
  const validate = validators[version];
  if (!validate)
    return {
      valid: false,
      errors: [
        {
          message: "Expected Swagger 2.0 or OpenAPI 3.0, 3.1 or 3.2.",
          path: "",
        },
      ],
    };
  const counts = /** @type {{path:(string|number)[],message:string}[]} */ ([]);
  const normalized = structuralNumbers(value, read, counts);
  const valid = validate(normalized) && counts.length === 0;
  return {
    valid,
    errors: [
      ...counts.map((error) => ({
        message: error.message,
        path:
          "/" +
          error.path
            .map((part) =>
              String(part).replaceAll("~", "~0").replaceAll("/", "~1"),
            )
            .join("/"),
      })),
      ...(validate.errors || []).map((/** @type {any} */ error) => ({
        message: error.message,
        path: error.instancePath || "",
      })),
    ],
  };
}
