import {
  countKeywords,
  InvalidOpenApiCount,
} from "../../src/lib/openapi-counts.js";
import { createRulesetFunction } from "@stoplight/spectral-core";
import { parseDocument } from "yaml";
import { apiSourceLocation } from "../../src/lib/openapi-document.js";
import { literal } from "../../src/lib/openapi-literal.js";
import { parseOpenApiNumbers } from "../../src/lib/openapi-value.js";
import { projectExact } from "../../src/lib/openapi-numeric-domain.js";
import { schemaReferenceFields } from "../../src/lib/openapi-references.js";

const documents = new WeakMap();
// The inventory follows the same resolver graph used to evaluate the rule.
// Never infer an owner by searching for an equal, already rounded number.
export function exactExampleValue(context, path, fallback) {
  const override = context.exactExampleOverrides;
  if (override?.has(JSON.stringify(path)))
    return override.get(JSON.stringify(path));
  const owner = context.documentInventory.findAssociatedItemForPath(path, true);
  if (!owner || typeof owner.document.input !== "string") return fallback;
  let ast = documents.get(owner.document);
  if (!ast) {
    ast = parseDocument(owner.document.input);
    documents.set(owner.document, ast);
  }
  const location = apiSourceLocation(ast, owner.path);
  if (!location) return fallback;
  const data = literal(location.node, ast);
  if (
    !data.numeric ||
    JSON.stringify(JSON.parse(data.json)) !== JSON.stringify(fallback)
  )
    return fallback;
  return parseOpenApiNumbers(data.json);
}

function schemaAt(value, path, context) {
  if (!value || typeof value !== "object") return value;
  const result = Object.create(null);
  for (const [key, child] of Object.entries(value)) {
    // Annotations are not assertions. The selected instance is supplied separately.
    if (["example", "examples", "default", "x-example"].includes(key)) continue;
    const role = schemaReferenceFields[key];
    result[key] = [
      ...countKeywords,
      "minimum",
      "maximum",
      "exclusiveMinimum",
      "exclusiveMaximum",
      "multipleOf",
      "const",
      "enum",
    ].includes(key)
      ? exactExampleValue(context, [...path, key], child)
      : role?.startsWith("map:") && child && typeof child === "object"
        ? Object.fromEntries(
            Object.entries(child).map(([name, entry]) => [
              name,
              schemaAt(entry, [...path, key, name], context),
            ]),
          )
        : (role === "array:schema" || role === "schemaOrArray") &&
            Array.isArray(child)
          ? child.map((entry, index) =>
              schemaAt(entry, [...path, key, index], context),
            )
          : role
            ? schemaAt(child, [...path, key], context)
            : child;
  }
  // AJV's numeric formats operate on Number. Express their existing predicates
  // before projection so rank values cannot change an int32 range decision.
  if (["int32", "int64", "float", "double"].includes(result.format)) {
    const format = result.format;
    delete result.format;
    if (format === "int32" || format === "int64") {
      result.allOf = [
        ...(result.allOf || []),
        {
          anyOf: [
            { not: { type: "number" } },
            {
              type: "integer",
              ...(format === "int32"
                ? { minimum: -2147483648, maximum: 2147483647 }
                : {}),
            },
          ],
        },
      ];
    }
  }
  return result;
}

function items(target, opts, path) {
  if (opts.type === "schema")
    return (
      opts.oasVersion === 2
        ? ["example", "x-example", "default"]
        : ["example", "default"]
    )
      .filter((field) => Object.hasOwn(target, field))
      .map((field) => ({
        path: [...path, field],
        value: target[field],
        field,
      }));
  if (opts.oasVersion === 3 && Object.hasOwn(target, "example"))
    return [
      { path: [...path, "example"], value: target.example, field: "example" },
    ];
  if (
    !target.examples ||
    typeof target.examples !== "object" ||
    Array.isArray(target.examples)
  )
    return [];
  return Object.entries(target.examples).flatMap(([name, value]) => {
    if (
      opts.oasVersion === 3 &&
      (!value ||
        typeof value !== "object" ||
        Object.hasOwn(value, "externalValue"))
    )
      return [];
    return [
      {
        path: [
          ...path,
          "examples",
          name,
          ...(opts.oasVersion === 3 ? ["value"] : []),
        ],
        value: opts.oasVersion === 3 ? value.value : value,
        field: "examples",
        name,
      },
    ];
  });
}

export function exactExampleRules(oas) {
  const rules = { ...oas.rules };
  for (const name of [
    "oas2-valid-schema-example",
    "oas2-valid-media-example",
    "oas3-valid-schema-example",
    "oas3-valid-media-example",
  ]) {
    const rule = rules[name];
    if (!rule) continue;
    rules[name] = {
      ...rule,
      then: {
        ...rule.then,
        function: createRulesetFunction(
          {
            input: { type: "object" },
            options: { type: "object", additionalProperties: true },
          },
          async (target, opts, context) => {
            const originalSchema =
              opts.schemaField === "$" ? target : target[opts.schemaField];
            if (!originalSchema || typeof originalSchema !== "object")
              return rule.then.function(target, opts, context);
            const schema = schemaAt(
              originalSchema,
              opts.schemaField === "$"
                ? context.path
                : [...context.path, opts.schemaField],
              context,
            );
            const errors = [];
            for (const item of items(target, opts, context.path)) {
              const sample = exactExampleValue(context, item.path, item.value);
              let projected;
              try {
                projected = projectExact(schema, sample);
              } catch (error) {
                if (error instanceof InvalidOpenApiCount) return [];
                throw error;
              }
              // One instance per invocation: each finite domain includes precisely
              // the schema assertions and instance being checked.
              const input =
                opts.schemaField === "$"
                  ? { ...projected.schema }
                  : { ...target, [opts.schemaField]: projected.schema };
              delete input.example;
              delete input.examples;
              delete input.default;
              delete input["x-example"];
              input[item.field] =
                item.field === "examples"
                  ? {
                      [item.name]:
                        opts.oasVersion === 3
                          ? { value: projected.instance }
                          : projected.instance,
                    }
                  : projected.instance;
              for (const error of (await rule.then.function(
                input,
                opts,
                context,
              )) || [])
                errors.push({
                  ...error,
                  message: "Example does not satisfy its schema.",
                });
            }
            return errors;
          },
        ),
      },
    };
  }
  return { ...oas, rules };
}
