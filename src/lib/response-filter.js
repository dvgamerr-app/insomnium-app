import { JSONPath } from "jsonpath-plus";
import { jsonPrettify } from "./json-prettify.js";

/** Run in a disposable worker; never select the native script evaluator.
 * @param {string} body @param {string} path */
export function filterJsonResponse(body, path) {
  if (body.length > 20 * 1024 * 1024)
    throw new Error("Response exceeds the 20 Mi character filter limit");
  if (!path.trim() || path.length > 4096)
    throw new Error("JSONPath must contain 1–4096 characters");
  const json = JSON.parse(body);
  let matches = 0;
  let resultSize = 2;
  // JSONPath Plus skips falsy roots before evaluation. Root selection must still return them.
  const result =
    path.trim() === "$"
      ? [json]
      : JSONPath({
          json,
          path: path.trim(),
          eval: "safe",
          wrap: true,
          callback(value) {
            matches++;
            resultSize += (JSON.stringify(value)?.length || 4) + 1;
            if (matches > 10000 || resultSize > 20 * 1024 * 1024)
              throw new Error(
                "Response filter exceeds 10000 matches or 20 Mi result characters",
              );
          },
        });
  return jsonPrettify(JSON.stringify(result ?? []), "  ");
}
