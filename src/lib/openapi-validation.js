import v2 from "./generated/openapi-2.0.js";
import v30 from "./generated/openapi-3.0.js";
import v31 from "./generated/openapi-3.1.js";
import v32 from "./generated/openapi-3.2.js";

/** @param {Record<string, any>} value */
export function validateApiDocument(value) {
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
  const valid = validate(value);
  return {
    valid,
    errors: (validate.errors || []).map((/** @type {any} */ error) => ({
      message: error.message,
      path: error.instancePath || "",
    })),
  };
}
