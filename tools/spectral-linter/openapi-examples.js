import { projectExact } from "../../src/lib/openapi-numeric-domain.js";
import { structuralNumbers } from "../../src/lib/openapi-structural-numbers.js";
import { createRulesetFunction } from "@stoplight/spectral-core";
import { exactExampleRules, exactExampleValue } from "./exact-examples.js";
import { parseOpenApiNumbers } from "../../src/lib/openapi-value.js";
import { validateApiDocument } from "../../src/lib/openapi-validation.js";
import { isJsonBodyMediaType } from "../../src/lib/media-type.js";
import {
  apiObjectRole,
  referenceObjectFields,
} from "../../src/lib/openapi-references.js";

const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const has = (value, key) => Object.hasOwn(value, key);
const modern = (value) =>
  object(value) && (has(value, "dataValue") || has(value, "serializedValue"));
const options = { type: "object", additionalProperties: true };

// The upstream ruleset predates OAS 3.2 Example Objects. Adapt only its default
// example rules; never rewrite the document or the owner's custom ruleset.
function nextRole(kind, key) {
  key = String(key);
  if (kind === "openapi")
    return key === "paths"
      ? "paths"
      : key === "webhooks"
        ? "pathMap"
        : key === "components"
          ? "components"
          : "other";
  if (kind === "paths") return key.startsWith("/") ? "pathItem" : "other";
  if (kind === "components")
    return key === "callbacks"
      ? "callbackMap"
      : key === "pathItems"
        ? "pathMap"
        : "other";
  if (kind === "pathMap") return "pathItem";
  if (kind === "pathItem")
    return [
      "get",
      "put",
      "post",
      "delete",
      "options",
      "head",
      "patch",
      "trace",
      "query",
    ].includes(key)
      ? "operation"
      : key === "additionalOperations"
        ? "operationMap"
        : "other";
  if (kind === "operationMap") return "operation";
  if (kind === "operation")
    return key === "callbacks" ? "callbackMap" : "other";
  if (kind === "callbackMap") return "callback";
  if (kind === "callback") return key.startsWith("x-") ? "other" : "pathItem";
  return "other";
}
function pathItemSiblings(root) {
  const pending = [{ node: root, kind: "openapi" }];
  while (pending.length) {
    const { node, kind } = pending.pop();
    if (!object(node)) continue;
    if (kind === "pathItem" && has(node, "$ref")) return true;
    for (const [key, child] of Object.entries(node)) {
      const role = nextRole(kind, key);
      if (role !== "other") pending.push({ node: child, kind: role });
    }
  }
  return false;
}

function referenceObjectSiblings(root) {
  const pending = [{ node: root, path: [] }];
  const seen = new WeakMap();
  while (pending.length) {
    const { node, path } = pending.pop();
    if (!node || typeof node !== "object") continue;
    const kind = apiObjectRole(root, path);
    if (kind === "other") continue;
    const roles = seen.get(node) || new Set();
    if (roles.has(kind)) continue;
    roles.add(kind);
    seen.set(node, roles);
    if (
      typeof node.$ref === "string" &&
      Object.keys(node).length > 1 &&
      referenceObjectFields(
        kind,
        !/^3\.[12]\./.test(String(root.openapi || "")),
      )
    )
      return true;
    for (const [key, child] of Object.entries(node))
      if (child && typeof child === "object")
        pending.push({ node: child, path: [...path, key] });
  }
  return false;
}

export function defaultOpenApiRuleset(oas, version) {
  oas = exactExampleRules(oas);
  if (/^3\.[12]\./.test(String(version))) {
    const arrayRule = oas.rules["array-items"];
    oas = {
      ...oas,
      rules: {
        ...oas.rules,
        "array-items": {
          ...arrayRule,
          then: {
            ...arrayRule.then,
            function: createRulesetFunction(
              { input: null, options: null },
              (value, opts, context) =>
                apiObjectRole(
                  context.document.data,
                  context.path.slice(0, -1),
                ) === "schema"
                  ? undefined
                  : arrayRule.then.function(value, opts, context),
            ),
          },
        },
      },
    };
  }
  const structural = { ...oas.rules };
  const enumRule = structural["duplicated-entry-in-enum"];
  structural["duplicated-entry-in-enum"] = {
    ...enumRule,
    then: {
      ...enumRule.then,
      function: createRulesetFunction(
        {
          input: null,
          options: { type: "object", additionalProperties: true },
        },
        (value, opts, context) =>
          enumRule.then.function(
            projectExact({}, exactExampleValue(context, context.path, value))
              .instance,
            opts,
            context,
          ),
      ),
    },
  };
  for (const name of ["oas2-schema", "oas3-schema"]) {
    const rule = structural[name];
    structural[name] = {
      ...rule,
      then: {
        ...rule.then,
        function: createRulesetFunction(
          {
            input: null,
            options: null,
          },
          (value, opts, context) => {
            const errors = [];
            const normalized = structuralNumbers(
              value,
              (path, fallback) => exactExampleValue(context, path, fallback),
              errors,
            );
            return [
              ...errors,
              ...(rule.then.function(normalized, opts, context) || []),
            ];
          },
        ),
      },
    };
  }
  oas = { ...oas, rules: structural };
  if (/^3\.[12]\.\d+$/.test(String(version))) {
    const rule = oas.rules["oas3-schema"];
    oas = {
      ...oas,
      rules: {
        ...oas.rules,
        "oas3-schema": {
          ...rule,
          then: {
            function: createRulesetFunction(
              { input: null, options: null },
              (value, opts, context) => {
                if (!pathItemSiblings(value) && !referenceObjectSiblings(value))
                  return rule.then.function(value, opts, context);
                // Use the same generated structural validator as the worker. It retains
                // all sibling/type/unknown-field checks without treating Path Item as Reference.
                return validateApiDocument(value, (path, fallback) =>
                  exactExampleValue(context, path, fallback),
                ).errors.map((error) => ({
                  message: error.message,
                  path: String(error.path || "")
                    .split("/")
                    .slice(1)
                    .map((key) =>
                      key.replaceAll("~1", "/").replaceAll("~0", "~"),
                    ),
                }));
              },
            ),
          },
        },
      },
    };
  }

  if (version === "2.0" || /^3\.0\.\d+$/.test(String(version))) {
    const rule = oas.rules["no-$ref-siblings"];
    const role = (context) =>
      apiObjectRole(context.document.data, context.path.slice(0, -1));
    return {
      ...oas,
      rules: {
        ...oas.rules,
        ...(version === "2.0"
          ? {
              "oas2-schema": {
                ...oas.rules["oas2-schema"],
                then: {
                  function: createRulesetFunction(
                    { input: null, options: null },
                    (value, opts, context) => {
                      if (!referenceObjectSiblings(value))
                        return oas.rules["oas2-schema"].then.function(
                          value,
                          opts,
                          context,
                        );
                      return validateApiDocument(value, (path, fallback) =>
                        exactExampleValue(context, path, fallback),
                      ).errors.map((error) => ({
                        message: error.message,
                        path: String(error.path || "")
                          .split("/")
                          .slice(1)
                          .map((key) =>
                            key.replaceAll("~1", "/").replaceAll("~0", "~"),
                          ),
                      }));
                    },
                  ),
                },
              },
            }
          : {}),
        "no-$ref-siblings": {
          ...rule,
          then: {
            function: createRulesetFunction(
              { input: null, options: null },
              (value, opts, context) => {
                // Recognize Object roles, never a payload key merely named paths/callbacks.
                const kind = role(context);
                return kind === "pathItem" ||
                  kind === "schema" ||
                  (typeof value === "string" &&
                    referenceObjectFields(kind, true))
                  ? undefined
                  : rule.then.function(value, opts, context);
              },
            ),
          },
        },
        "oas-ignored-schema-ref-siblings": {
          ...rule,
          severity: "warn",
          description:
            "Sibling fields on a legacy schema reference are ignored.",
          documentationUrl:
            version === "2.0"
              ? "https://spec.openapis.org/oas/v2.0.html"
              : "https://spec.openapis.org/oas/v3.0.4.html#reference-object",
          then: {
            function: createRulesetFunction(
              { input: null, options: null },
              (value, opts, context) =>
                role(context) === "schema"
                  ? rule.then.function(value, opts, context)?.map((error) => ({
                      ...error,
                      message:
                        "This field is ignored next to a legacy schema $ref.",
                    }))
                  : undefined,
            ),
          },
        },
        "oas-ignored-reference-siblings": {
          ...rule,
          severity: "warn",
          description:
            "Sibling fields on a legacy Reference Object are ignored.",
          documentationUrl:
            "https://spec.openapis.org/oas/v3.0.4.html#reference-object",
          then: {
            function: createRulesetFunction(
              { input: null, options: null },
              (value, opts, context) => {
                const kind = role(context);
                return typeof value === "string" &&
                  kind !== "schema" &&
                  referenceObjectFields(kind, true)
                  ? rule.then.function(value, opts, context)?.map((error) => ({
                      ...error,
                      message:
                        "This field is ignored next to a legacy Reference Object $ref.",
                    }))
                  : undefined;
              },
            ),
          },
        },
      },
    };
  }
  if (!/^3\.2\.\d+$/.test(String(version))) return oas;
  const presence = oas.rules["oas3-examples-value-or-externalValue"];
  const media = oas.rules["oas3-valid-media-example"];
  const presenceFunction = createRulesetFunction(
    { input: null, options },
    (value, opts, context) => {
      if (!modern(value)) return presence.then.function(value, opts, context);
      const errors = [];
      const error = (field, message) =>
        errors.push({ message, path: [...context.path, field] });
      if (has(value, "value"))
        error(
          "value",
          "value must be absent with dataValue or serializedValue.",
        );
      if (has(value, "serializedValue") && has(value, "externalValue"))
        error(
          "externalValue",
          "externalValue must be absent with serializedValue.",
        );
      if (
        has(value, "serializedValue") &&
        typeof value.serializedValue !== "string"
      )
        error("serializedValue", "serializedValue must be a string.");
      return errors;
    },
  );
  const mediaFunction = createRulesetFunction(
    { input: null, options },
    async (target, opts, context) => {
      if (!object(target) || !object(target.examples))
        return media.then.function(target, opts, context);
      const legacy = Object.create(null),
        checks = [],
        errors = [];
      const jsonMedia =
        context.path.at(-2) === "content" &&
        isJsonBodyMediaType(context.path.at(-1));
      for (const [name, example] of Object.entries(target.examples)) {
        if (!modern(example)) {
          legacy[name] = example;
          continue;
        }
        if (has(example, "dataValue"))
          checks.push({ name, field: "dataValue", value: example.dataValue });
        if (
          has(example, "serializedValue") &&
          jsonMedia &&
          typeof example.serializedValue === "string"
        ) {
          try {
            checks.push({
              name,
              field: "serializedValue",
              value: parseOpenApiNumbers(example.serializedValue),
            });
          } catch {
            errors.push({
              message: "serializedValue contains invalid JSON.",
              path: [...context.path, "examples", name, "serializedValue"],
            });
          }
        }
        // Non-JSON serialized bytes are not schema-ready data. dataValue, when
        // supplied, is still checked. Never validate encoded wire text as a scalar.
      }
      errors.push(
        ...((await media.then.function(
          { ...target, examples: legacy },
          opts,
          context,
        )) || []),
      );
      for (const check of checks) {
        const actualPath = [
          ...context.path,
          "examples",
          check.name,
          check.field,
        ];
        const exact =
          check.field === "serializedValue"
            ? check.value
            : exactExampleValue(context, actualPath, check.value);
        const results = await media.then.function(
          { ...target, examples: { [check.name]: { value: check.value } } },
          opts,
          {
            ...context,
            exactExampleOverrides: new Map([
              [
                JSON.stringify([
                  ...context.path,
                  "examples",
                  check.name,
                  "value",
                ]),
                exact,
              ],
            ]),
          },
        );
        for (const result of results || []) {
          const prefix = [...context.path, "examples", check.name];
          const path = result.path || prefix;
          // A parsed JSON token has no source child nodes: anchor its diagnostics
          // on the authored field rather than an invented object inside the text.
          errors.push({
            ...result,
            path: [
              ...prefix,
              check.field,
              ...(check.field === "dataValue"
                ? path.slice(prefix.length + 1)
                : []),
            ],
          });
        }
      }
      return errors;
    },
  );
  return {
    ...oas,
    rules: {
      ...oas.rules,
      "oas3-examples-value-or-externalValue": {
        ...presence,
        description:
          "Example fields must obey OpenAPI 3.2 presence and exclusion rules.",
        message: "{{error}}",
        then: { ...presence.then, function: presenceFunction },
      },
      "oas3-valid-media-example": {
        ...media,
        then: { ...media.then, function: mediaFunction },
      },
    },
  };
}
