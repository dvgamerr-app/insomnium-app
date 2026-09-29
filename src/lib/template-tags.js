import { Buffer } from "buffer/";
import { format } from "date-fns";
import { v1, v4 } from "uuid";
import { md5, sha1 } from "@noble/hashes/legacy.js";
import { sha256, sha512 } from "@noble/hashes/sha2.js";
import { JSONPath } from "jsonpath-plus";

export const localTagNames = ["base64", "now", "uuid", "hash", "jsonpath"];
/** Original encoded arguments are used for JSONPath and other quoted values.
 * @param {any} value */
export function decodeArgument(value) {
  const encoded = typeof value === "string" && value.match(/^b64::(.+)::46b$/);
  return encoded ? Buffer.from(encoded[1], "base64").toString("utf8") : value;
}

/** Synchronous, worker-local tags only. No filesystem/network/app capabilities.
 * @param {string} name @param {any[]} rawArgs @returns {any} */
export function runLocalTag(name, rawArgs) {
  if (!localTagNames.includes(name))
    throw new Error(`Unsupported template tag: ${name}`);
  const args = rawArgs.map(decodeArgument);
  if (name === "base64") {
    const [action, kind, value] = args;
    if (action !== "encode" && action !== "decode")
      throw new Error("invalid action");
    if (action === "encode" && (kind === "normal" || kind === "url")) {
      const result = Buffer.from(value || "", "utf8").toString("base64");
      return kind === "url"
        ? result.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
        : result;
    }
    return Buffer.from(value || "", "base64").toString("utf8");
  }
  if (name === "now") {
    const [kind = "iso-8601", pattern = ""] = args;
    const now = new Date();
    switch (typeof kind === "string" ? kind.toLowerCase() : kind) {
      case "millis":
      case "ms":
        return String(now.getTime());
      case "unix":
      case "seconds":
      case "s":
        return String(Math.round(now.getTime() / 1000));
      case "iso-8601":
        return now.toISOString();
      case "custom":
        return format(now, pattern);
      default:
        throw new Error(`Invalid date type "${kind}"`);
    }
  }
  if (name === "uuid") {
    const kind = String(args[0] === undefined ? "v4" : args[0]).toLowerCase();
    if (kind === "v1" || kind === "1") return v1();
    if (kind === "v4" || kind === "4") return v4();
    throw new Error(`Invalid UUID type "${kind}"`);
  }
  if (name === "hash") {
    const [algorithm, encoding, value = ""] = args;
    if (!["hex", "latin1", "base64"].includes(encoding))
      throw new Error(
        `Invalid encoding ${encoding}. Choices are hex, latin1, base64`,
      );
    if (typeof value !== "string")
      throw new Error(`Cannot hash value of type "${typeof value}"`);
    const algorithms = { md5, sha1, sha256, sha512 };
    const hash =
      algorithms[
        /** @type {keyof typeof algorithms} */ (String(algorithm).toLowerCase())
      ];
    if (!Object.hasOwn(algorithms, String(algorithm).toLowerCase()))
      throw new Error(`Unsupported hash algorithm: ${algorithm}`);
    return Buffer.from(hash(new TextEncoder().encode(value))).toString(
      encoding,
    );
  }
  const [json, path] = args;
  if (typeof path !== "string" || path.length > 4096)
    throw new Error("JSONPath tag requires a query of at most 4096 characters");
  const value = JSON.parse(json);
  let count = 0;
  let size = 0;
  const result =
    path === "$"
      ? [value]
      : JSONPath({
          json: value,
          path,
          eval: "safe",
          wrap: true,
          callback(item) {
            size += JSON.stringify(item)?.length || 4;
            if (++count > 10000 || size > 20 * 1024 * 1024)
              throw new Error("JSONPath tag result limit exceeded");
          },
        });
  if (!Array.isArray(result) || !result.length)
    throw new Error(`JSONPath query returned no results: ${path}`);
  return result[0];
}
