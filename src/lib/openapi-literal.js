import { countKeywords } from "./openapi-counts.js";
import { schemaReferenceFields } from "./openapi-references.js";
import { cloneOpenApiNumbers } from "./openapi-value.js";
import { isAlias, isScalar, isSeq, isMap } from "yaml";
import { apiSourceLocation } from "./openapi-document.js";
import { OpenApiNumber, parseOpenApiNumbers } from "./openapi-value.js";

/** @param {string} source */
function decimal(source) {
  let text = source.replaceAll("_", "");
  if (/^[+-]?0[xob][\da-f]+$/i.test(text)) {
    const negative = text.startsWith("-");
    text = text.replace(/^[+-]/, "");
    return (negative ? -BigInt(text) : BigInt(text)).toString();
  }
  const match = /^([+-]?)(\d*)(?:\.(\d*))?([eE][+-]?\d+)?$/.exec(text);
  if (!match || (!match[2] && !match[3]))
    throw Error("Numeric YAML literal cannot be represented as a JSON number.");
  return (
    (match[1] === "-" ? "-" : "") +
    (match[2].replace(/^0+(?=\d)/, "") || "0") +
    (match[3] === undefined ? "" : "." + (match[3] || "0")) +
    (match[4] || "")
  );
}

/** Read literal data from its proven AST owner, never by matching rounded values.
 * @param {any} node @param {import('yaml').Document} document */
export function literal(node, document) {
  let count = 0,
    numeric = false;
  const active = new Set();
  /** @param {any} item @param {number} depth @returns {string} */
  const visit = (item, depth) => {
    if (++count > 100000 || depth > 128)
      throw Error("Authored literal exceeds its processing budget.");
    if (isAlias(item)) item = item.resolve(document);
    if (!item) return "null";
    if (active.has(item))
      throw Error("Cyclic authored literal is not JSON data.");
    active.add(item);
    let text;
    if (isScalar(item)) {
      if (typeof item.value === "number") {
        numeric = true;
        text = decimal(item.source || String(item.value));
      } else text = JSON.stringify(item.value);
    } else if (isSeq(item))
      text =
        "[" +
        item.items.map((child) => visit(child, depth + 1)).join(",") +
        "]";
    else if (isMap(item))
      text =
        "{" +
        item.items
          .map((pair) => {
            if (!isScalar(pair.key))
              throw Error("Authored JSON property requires a scalar key.");
            return (
              JSON.stringify(String(pair.key.value)) +
              ":" +
              visit(pair.value, depth + 1)
            );
          })
          .join(",") +
        "}";
    else throw Error("Unsupported authored JSON literal.");
    active.delete(item);
    return text;
  };
  return { json: visit(node, 0), numeric };
}

/** Structured-cloneable identity map for resolved annotation owners.
 * @param {any} schema @param {any} origins @param {Map<string,any>} sources */
export function collectApiLiterals(schema, origins, sources) {
  const result = /** @type {Map<Record<string,any>,Map<string,string>>} */ (
    new Map()
  );
  const pending = [schema],
    seen = new WeakSet();
  while (pending.length) {
    const node = pending.pop();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    for (const key of [
      ...countKeywords,
      "example",
      "default",
      "const",
      "value",
      "dataValue",
      "minimum",
      "maximum",
      "exclusiveMinimum",
      "exclusiveMaximum",
      "multipleOf",
      "examples",
      "enum",
    ]) {
      if (!Object.hasOwn(node, key)) continue;
      const location = origins.locate(node, [key]);
      const source = location && sources.get(location.source);
      const ast =
        source && apiSourceLocation(source.parsed.document, location.path);
      if (!ast) continue;
      const data = literal(ast.node, source.parsed.document);
      if (!data.numeric) continue;
      // Assert that reference protection/restoration did not transform this data.
      if (JSON.stringify(JSON.parse(data.json)) !== JSON.stringify(node[key]))
        continue;
      const fields = result.get(node) || new Map();
      fields.set(key, data.json);
      result.set(node, fields);
      if (Array.isArray(node[key]) && ["examples", "enum"].includes(key)) {
        const child = apiSourceLocation(source.parsed.document, [
          ...location.path,
          0,
        ]);
        if (child)
          fields.set(
            key + "/0",
            literal(child.node, source.parsed.document).json,
          );
      }
    }
    for (const child of Object.values(node))
      if (child && typeof child === "object") pending.push(child);
  }
  return result;
}

/** @param {Record<string,any>} owner @param {string} key @param {any} value
 * @param {Map<Record<string,any>,Map<string,string>>|undefined} catalog */
export function restoreLiteral(owner, key, value, catalog) {
  const json = catalog?.get(owner)?.get(key);
  if (json === undefined) return value;
  const exact = parseOpenApiNumbers(json),
    approximate = JSON.parse(json);
  /** Preserve the sampler's actual shape/readOnly filtering; restore only owned leaves.
   * @param {any} output @param {any} original @param {any} precise @returns {any} */
  const merge = (output, original, precise) => {
    if (
      precise instanceof OpenApiNumber &&
      ((typeof output === "number" && output === original) ||
        (output === null && !Number.isFinite(original)))
    )
      return precise;
    if (
      !output ||
      !original ||
      typeof output !== "object" ||
      typeof original !== "object" ||
      Array.isArray(output) !== Array.isArray(original)
    )
      return output;
    if (Array.isArray(output))
      return output.map((item, index) =>
        merge(item, original[index], precise[index]),
      );
    return Object.fromEntries(
      Object.entries(output).map(([field, item]) => [
        field,
        Object.hasOwn(original, field)
          ? merge(item, original[field], precise[field])
          : item,
      ]),
    );
  };
  return merge(value, approximate, exact);
}

/** Follow explicit sampler precedence and ordinary property/item sampling.
 * @param {any} schema @param {any} value @param {Map<Record<string,any>,Map<string,string>>|undefined} catalog
 * @param {number} [depth] @returns {any} */
export function restoreSampleNumbers(schema, value, catalog, depth = 0) {
  if (value instanceof OpenApiNumber) return value;
  if (!schema || typeof schema !== "object" || depth > 64) return value;
  if (
    schema.example === undefined &&
    (schema.oneOf || schema.anyOf || schema.$ref)
  )
    return value;
  for (const key of ["example", "const", "examples", "enum", "default"]) {
    if (
      schema[key] === undefined ||
      (["examples", "enum"].includes(key) && !schema[key]?.length)
    )
      continue;
    return restoreLiteral(
      schema,
      ["examples", "enum"].includes(key) ? key + "/0" : key,
      value,
      catalog,
    );
  }
  if (schema.allOf || schema.oneOf || schema.anyOf || schema.$ref) return value;
  if (Array.isArray(value))
    return value.map((item, index) =>
      restoreSampleNumbers(
        schema.prefixItems?.[index] ?? schema.items,
        item,
        catalog,
        depth + 1,
      ),
    );
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        restoreSampleNumbers(
          schema.properties?.[key] ?? schema.additionalProperties,
          item,
          catalog,
          depth + 1,
        ),
      ]),
    );
  return value;
}

export const numericAssertions = new Set([
  ...countKeywords,
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "const",
  "enum",
]);

/** Restore numeric assertions without walking payload literals as schemas.
 * @param {any} schema @param {Map<Record<string,any>,Map<string,string>>|undefined} catalog */
export function restoreNumericSchema(schema, catalog) {
  const cache = new WeakMap();
  /** @param {any} node @returns {any} */
  const visit = (node) => {
    if (!node || typeof node !== "object") return node;
    if (cache.has(node)) return cache.get(node);
    const result = {};
    cache.set(node, result);
    for (const [key, value] of Object.entries(node)) {
      const role =
        schemaReferenceFields[
          /** @type {keyof typeof schemaReferenceFields} */ (key)
        ];
      let restored = value;
      if (numericAssertions.has(key))
        restored = cloneOpenApiNumbers(
          restoreLiteral(node, key, value, catalog),
        );
      else if (
        role?.startsWith("map:") &&
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      )
        restored = Object.fromEntries(
          Object.entries(value).map(([name, child]) => [name, visit(child)]),
        );
      else if (
        (role === "array:schema" || role === "schemaOrArray") &&
        Array.isArray(value)
      )
        restored = value.map(visit);
      else if (role) restored = visit(value);
      else restored = cloneOpenApiNumbers(value);
      Object.defineProperty(result, key, {
        value: restored,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return result;
  };
  return visit(schema);
}
