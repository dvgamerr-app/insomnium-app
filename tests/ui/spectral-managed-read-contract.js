import assert from "node:assert/strict";
import { resolve, join, sep, basename } from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { referenceObjectDocument } from "./helpers/openapi-external-contract.js";

// Reuse this producer-contract scenario for the OAS 3.2 default-rule regression.
const numericFocus = process.env.INSOMNIUM_SPECTRAL_NUMERIC_CONTRACT === "1";
const pathItemFocus = process.env.INSOMNIUM_SPECTRAL_PATHITEM_CONTRACT === "1";
const legacySiblingFocus =
  process.env.INSOMNIUM_SPECTRAL_LEGACY_SIBLING_CONTRACT === "1";
const referenceFocus =
  process.env.INSOMNIUM_SPECTRAL_REFERENCE_OBJECT_CONTRACT === "1";
if (
  process.env.INSOMNIUM_SPECTRAL_EXAMPLE_CONTRACT === "1" ||
  pathItemFocus ||
  legacySiblingFocus ||
  referenceFocus ||
  numericFocus
) {
  const output = resolve("artifacts/spectral-example-contract-" + Date.now());
  await mkdir(output, { recursive: true });
  const repositories = /** @type {Record<string,string>} */ ({});
  for (const mode of ["custom", "fallback"]) {
    const repository = join(output, mode);
    await mkdir(join(repository, "other"), { recursive: true });
    await Bun.write(
      join(repository, "other/.spectral.yaml"),
      mode === "fallback"
        ? "extends: [./missing-owned.yaml]\n"
        : legacySiblingFocus || numericFocus
          ? "extends: [spectral:oas]\n"
          : referenceFocus
            ? "extends: []\nrules:\n  detached-parameter:\n    severity: error\n    given: '$.paths[\"/detached\"].get.parameters[0]'\n    then:\n      function: schema\n      functionOptions:\n        schema:\n          type: object\n          required: [name, in]\n          properties:\n            name: {const: nested}\n          anyOf:\n            - required: [type]\n              properties:\n                type: {const: string}\n            - required: [schema]\n              properties:\n                schema:\n                  type: object\n                  required: [type]\n                  properties:\n                    type: {const: string}\n"
            : "extends: []\nrules:\n  original-serialized:\n    severity: error\n    given: '$..examples.authored'\n    then:\n      field: serializedValue\n      function: truthy\n  absent-value:\n    severity: error\n    given: '$..examples.authored'\n    then:\n      field: value\n      function: falsy\n",
    );
    repositories[mode] = repository;
  }
  /** @type {Record<string,any>[]} */
  const cases = numericFocus
    ? [
        {
          id: "underflow-multiple",
          raw: "3e-400",
          schema: { type: "number", multipleOf: "__BOUND__" },
          bound: "3e-400",
        },
        {
          id: "enum-structural-valid",
          raw: "9007199254740993",
          schema: { type: "integer", enum: [9007199254740992, "__BOUND__"] },
          bound: "9007199254740993",
        },
        {
          id: "enum-structural-object",
          raw: '{"n":9007199254740993}',
          schema: {
            type: "object",
            enum: [{ n: 9007199254740992 }, { n: "__BOUND__" }],
          },
          bound: "9007199254740993",
        },
        {
          id: "enum-structural-duplicate",
          raw: "1",
          schema: { type: "integer", enum: [1, "__BOUND__"] },
          bound: "1.00",
          structuralInvalid: true,
          legacyOnly: true,
        },
        { id: "exclusive-valid", raw: "0.100000000000000000001", bound: "0.1" },
        {
          id: "exclusive-invalid",
          raw: "0.1",
          bound: "0.100000000000000000001",
          invalid: true,
        },
        { id: "overflow", raw: "1e400", bound: "1e399" },
        {
          id: "multiple-invalid",
          raw: "0.300000000000000000001",
          schema: { type: "number", multipleOf: 0.1 },
          invalid: true,
        },
        {
          id: "multiple-valid",
          raw: "0.3",
          schema: { type: "number", multipleOf: 0.1 },
        },
        {
          id: "enum-invalid",
          raw: "9007199254740993",
          schema: { type: "integer", enum: ["__BOUND__"] },
          bound: "9007199254740992",
          invalid: true,
        },
        {
          id: "unique-valid",
          raw: "[9007199254740992,9007199254740993]",
          schema: {
            type: "array",
            items: { type: "integer" },
            uniqueItems: true,
          },
        },
        {
          id: "int32-invalid",
          raw: "2147483648",
          schema: { type: "integer", format: "int32" },
          invalid: true,
        },
        {
          id: "format-invalid",
          raw: '{"n":0.3,"email":"bad"}',
          schema: {
            type: "object",
            properties: {
              n: { type: "number", multipleOf: 0.1 },
              email: { type: "string", format: "email" },
            },
          },
          invalid: true,
        },
        {
          id: "attached-valid",
          raw: "0.100000000000000000001",
          bound: "0.1",
          attached: true,
        },
        {
          id: "attached-invalid",
          raw: "0.1",
          bound: "0.100000000000000000001",
          attached: true,
          invalid: true,
        },
        {
          id: "required-invalid",
          raw: '{"n":0.3}',
          schema: {
            type: "object",
            properties: { n: { type: "number", multipleOf: 0.1 } },
            required: ["other"],
          },
          invalid: true,
        },
        {
          id: "read-only-request",
          raw: '{"n":0.3}',
          schema: {
            type: "object",
            properties: {
              n: { type: "number", multipleOf: 0.1 },
              owned: { type: "integer", readOnly: true },
            },
            required: ["owned"],
          },
          requestOnly: true,
        },
        {
          id: "write-only-response",
          raw: '{"n":0.3}',
          schema: {
            type: "object",
            properties: {
              n: { type: "number", multipleOf: 0.1 },
              owned: { type: "integer", writeOnly: true },
            },
            required: ["owned"],
          },
          responseOnly: true,
        },
        {
          id: "custom-original",
          raw: "0.100000000000000000001",
          bound: "0.1",
          ruleset: "custom",
          invalid: true,
        },
        {
          id: "fallback-valid",
          raw: "0.100000000000000000001",
          bound: "0.1",
          ruleset: "fallback",
        },
        {
          id: "serialized-valid",
          raw: "0.100000000000000000001",
          bound: "0.1",
          modern: "serializedValue",
        },
        {
          id: "data-invalid",
          raw: "0.1",
          bound: "0.100000000000000000001",
          modern: "dataValue",
          invalid: true,
        },
      ].map((entry) => ({ ...entry, example: {} }))
    : [
        { id: "reference-roles", referenceRoles: true, example: {} },
        {
          id: "reference-roles-recursive",
          referenceRoles: true,
          recursive: true,
          example: {},
        },
        {
          id: "reference-roles-custom",
          referenceRoles: true,
          ruleset: "custom",
          example: {},
        },
        {
          id: "reference-roles-missing",
          referenceRoles: true,
          missingTarget: true,
          example: {},
        },
        {
          id: "reference-roles-attached",
          referenceRoles: true,
          attached: true,
          example: {},
        },
        { id: "legacy-sibling-valid", legacySibling: true, example: {} },
        {
          id: "legacy-sibling-invalid-ref",
          legacySibling: true,
          invalidSchema: true,
          example: {},
        },
        {
          id: "legacy-sibling-invalid-example",
          legacySibling: true,
          invalidExample: true,
          example: {},
        },
        {
          id: "legacy-sibling-nested",
          legacySibling: true,
          nestedSchema: true,
          example: {},
        },
        {
          id: "legacy-sibling-ignored-ref",
          legacySibling: true,
          ignoredRef: true,
          example: {},
        },
        {
          id: "legacy-sibling-ordinary",
          legacySibling: true,
          ordinaryLegacy: true,
          example: {},
        },
        {
          id: "legacy-sibling-custom",
          legacySibling: true,
          ruleset: "custom",
          example: {},
        },
        {
          id: "legacy-sibling-fallback",
          legacySibling: true,
          ruleset: "fallback",
          example: {},
        },
        { id: "pathitem-ref", pathItem: true, example: {} },
        {
          id: "pathitem-invalid",
          pathItem: true,
          invalidSibling: true,
          example: {},
          code: "oas3-schema",
        },
        {
          id: "ordinary-ref",
          ordinaryRef: true,
          example: {},
          code: "no-$ref-siblings",
        },
        {
          id: "custom-original",
          ruleset: "custom",
          example: { serializedValue: '{ "n": 2 }' },
        },
        {
          id: "fallback-modern",
          ruleset: "fallback",
          example: { serializedValue: '{ "n": 2 }' },
        },
        {
          id: "serialized-json",
          example: { serializedValue: '{ "n": 1e+02 }' },
        },
        { id: "data-json", example: { dataValue: { n: 2 } } },
        {
          id: "data-and-serialized",
          example: { dataValue: { n: 2 }, serializedValue: '{ "n": 2 }' },
        },
        {
          id: "data-false",
          schema: { type: "boolean" },
          example: { dataValue: false },
        },
        {
          id: "data-null",
          schema: { type: "null" },
          example: { dataValue: null },
        },
        { id: "legacy-value", example: { value: { n: 2 } } },
        {
          id: "external",
          example: { externalValue: "https://example.invalid/owned.json" },
        },
        {
          id: "external-and-data",
          example: {
            externalValue: "https://example.invalid/owned.json",
            dataValue: { n: 2 },
          },
        },
        {
          id: "encoded-parameter",
          parameter: true,
          schema: { type: "integer" },
          example: { serializedValue: "n=2" },
        },
        {
          id: "invalid-json",
          example: { serializedValue: "not JSON" },
          field: "serializedValue",
          code: "oas3-valid-media-example",
        },
        {
          id: "invalid-serialized-schema",
          example: { serializedValue: '{ "n": "bad" }' },
          field: "serializedValue",
          code: "oas3-valid-media-example",
        },
        {
          id: "invalid-data-schema",
          example: { dataValue: { n: "bad" } },
          field: "dataValue",
          code: "oas3-valid-media-example",
        },
        {
          id: "both-validate",
          example: { dataValue: { n: 2 }, serializedValue: '{ "n": "bad" }' },
          field: "serializedValue",
          code: "oas3-valid-media-example",
        },
        {
          id: "value-conflict",
          example: { serializedValue: '{ "n": 2 }', value: { n: 2 } },
          field: "value",
          code: "oas3-examples-value-or-externalValue",
        },
        {
          id: "data-value-conflict",
          example: { dataValue: { n: 2 }, value: { n: 2 } },
          field: "value",
          code: "oas3-examples-value-or-externalValue",
        },
        {
          id: "external-conflict",
          example: {
            serializedValue: '{ "n": 2 }',
            externalValue: "https://example.invalid/owned.json",
          },
          field: "externalValue",
          code: "oas3-examples-value-or-externalValue",
        },
        {
          id: "serialized-type",
          example: { serializedValue: 2 },
          field: "serializedValue",
          code: "oas3-examples-value-or-externalValue",
        },
        {
          id: "missing-value",
          example: {},
          code: "oas3-examples-value-or-externalValue",
        },
        {
          id: "legacy-invalid-schema",
          example: { value: { n: "bad" } },
          field: "value",
          code: "oas3-valid-media-example",
        },
      ];
  if (numericFocus) {
    for (const key of [
      "minItems",
      "maxItems",
      "minLength",
      "maxLength",
      "minProperties",
      "maxProperties",
      "minContains",
      "maxContains",
    ]) {
      const type = key.includes("Length")
        ? "string"
        : key.includes("Properties")
          ? "object"
          : "array";
      const raw =
        type === "string" ? '"a"' : type === "object" ? '{"n":0}' : "[0]";
      for (const bound of ["1e-400", "1.00"])
        cases.push({
          id: "count-" + key + "-" + (bound === "1.00" ? "valid" : "invalid"),
          raw,
          schema: {
            type,
            ...(type === "array" ? { items: { type: "number" } } : {}),
            ...(key.includes("Contains")
              ? { contains: { type: "number" } }
              : {}),
            [key]: "__BOUND__",
          },
          bound,
          countKey: key,
          structuralInvalid: bound !== "1.00",
          modernDialect: key.includes("Contains"),
          example: {},
        });
    }
    cases.push({
      id: "count-near-integer",
      raw: "[0]",
      schema: {
        type: "array",
        items: { type: "number" },
        minItems: "__BOUND__",
      },
      bound: "1.00000000000000000001",
      countKey: "minItems",
      structuralInvalid: true,
      example: {},
    });
  }
  if(numericFocus)cases.push(
    {id:"optional-items",raw:"[null,null]",schema:{type:"array",minItems:2},modernDialect:true,example:{}},
    {id:"false-items",raw:"[]",schema:{type:"array",items:false},modernDialect:true,example:{}},
    {id:"false-items-invalid",raw:"[0]",schema:{type:"array",items:false},modernDialect:true,invalid:true,example:{}},
    {id:"optional-items-custom",raw:"[]",schema:{type:"array"},modernDialect:true,ruleset:"custom",arrayCustom:true,example:{}},
    {id:"optional-items-fallback",raw:"[]",schema:{type:"array"},modernDialect:true,ruleset:"fallback",example:{}}
  );
  const results = [];
  const executable = process.env.INSOMNIUM_SPECTRAL_EXAMPLE_EXE;
  for (const version of numericFocus
    ? ["2.0", "3.0.3", "3.1.2", "3.2.1"]
    : referenceFocus
      ? ["2.0", "3.0.3", "3.0.4", "3.1.2", "3.2.0", "3.2.1"]
      : legacySiblingFocus
        ? ["2.0", "3.0.3", "3.0.4"]
        : pathItemFocus
          ? ["3.0.3", "3.0.4", "3.1.2", "3.2.0", "3.2.1"]
          : ["3.2.0", "3.2.1", "3.0.3", "3.1.2"]) {
    const selected = numericFocus
      ? cases.filter(
          (c) =>
            (!c.modern || version.startsWith("3.2.")) &&
            (!c.modernDialect || /^3\.[12]/.test(version)) &&
            (!c.legacyOnly ||
              version === "2.0" ||
              version.startsWith("3.0.")) &&
            (version !== "2.0" || (!c.requestOnly && !c.responseOnly)),
        )
      : referenceFocus
        ? cases.filter((c) => c.referenceRoles)
        : legacySiblingFocus
          ? cases.filter((c) => c.legacySibling)
          : pathItemFocus
            ? cases.filter((c) => c.pathItem || c.ordinaryRef)
            : version.startsWith("3.2.")
              ? cases.filter(
                  (c) =>
                    !c.pathItem &&
                    !c.ordinaryRef &&
                    !c.legacySibling &&
                    !c.referenceRoles,
                )
              : cases.filter((c) =>
                  [
                    "serialized-json",
                    "legacy-value",
                    "legacy-invalid-schema",
                  ].includes(c.id),
                );
    for (const entry of selected) {
      const media = {
        schema: entry.schema || {
          type: "object",
          properties: { n: { type: "number" } },
          required: ["n"],
        },
        examples: { authored: entry.example },
      };
      /** @type {Record<string,any>} */
      const operation = {
        operationId: "owned",
        responses: { 200: { description: "OK" } },
        ...(entry.parameter
          ? { parameters: [{ name: "n", in: "query", ...media }] }
          : { requestBody: { content: { "model/gltf+json": media } } }),
      };
      /** @type {Record<string,any>} */
      let spec = {
        openapi: version,
        info: { title: "Owned", version: "1" },
        servers: [{ url: "https://example.invalid" }],
        paths: { "/owned": { post: operation } },
      };
      const referenceFiles = [];
      if (referenceFocus) {
        spec = referenceObjectDocument(version);
        if (entry.recursive) {
          const schemas =
            version === "2.0"
              ? (spec.definitions = {})
              : spec.components.schemas;
          const prefix =
            version === "2.0" ? "#/definitions/" : "#/components/schemas/";
          schemas.Recursive = {
            type: "object",
            properties: { next: { $ref: prefix + "Recursive" } },
          };
          schemas.Root = { $ref: prefix + "Recursive" };
        }
        if (entry.missingTarget)
          spec.paths["/detached"].get.parameters[0].$ref += "/missing";
        if (entry.attached) {
          referenceFiles.push({
            name: "reference-source.json",
            contents: JSON.stringify(spec),
          });
          spec.paths = {
            "/owned": { $ref: "reference-source.json#/paths/~1owned" },
            "/detached": { $ref: "reference-source.json#/paths/~1detached" },
          };
          delete spec.components;
          delete spec.parameters;
          delete spec.responses;
        }
      }
      if (legacySiblingFocus) {
        const prefix =
          version === "2.0" ? "#/definitions/" : "#/components/schemas/";
        const schema = {
          $ref: entry.invalidSchema ? 42 : prefix + "Base",
          nullable: true,
          ...(entry.ignoredRef
            ? { properties: { unused: { $ref: "missing.json#/No" } } }
            : {}),
        };
        const target = {
          type: "string",
          ...(version === "2.0"
            ? { example: entry.invalidExample ? null : "owned" }
            : {}),
        };
        if (version === "2.0") {
          delete spec.openapi;
          Object.assign(spec, {
            swagger: "2.0",
            host: "example.invalid",
            schemes: ["https"],
            consumes: ["application/json"],
            definitions: { Base: target },
          });
          delete spec.servers;
          delete operation.requestBody;
          operation.parameters = [{ name: "body", in: "body", schema }];
        } else {
          Object.assign(spec, { components: { schemas: { Base: target } } });
          operation.requestBody = {
            content: {
              "application/json": {
                schema,
                example: entry.invalidExample ? null : "owned",
              },
            },
          };
        }
        if (entry.nestedSchema) {
          const wrapped = /** @type {Record<string,any>} */ ({
            type: "object",
            properties: { value: schema },
          });
          if (version === "2.0") {
            operation.parameters[0].schema = wrapped;
            wrapped.example = { value: "owned" };
          } else {
            const media = operation.requestBody.content["application/json"];
            media.schema = wrapped;
            media.example = { value: "owned" };
          }
        }
        if (entry.ordinaryLegacy) {
          operation.responses[200] = {
            $ref: "#/paths/~1base/get/responses/200",
            description: "ignored",
          };
          spec.paths["/base"] = {
            get: {
              operationId: "base",
              responses: { 200: { description: "OK" } },
            },
          };
        }
      }
      if (entry.pathItem || entry.ordinaryRef) {
        /** @type {any} */ (spec).paths = {
          "/ref": { get: { responses: { 200: { description: "OK" } } } },
          "/owned": { $ref: "#/paths/~1ref", put: operation },
        };
      }
      if (entry.invalidSibling)
        /** @type {any} */ (spec).paths["/owned"].put.parameters = 42;
      if (entry.ordinaryRef) {
        /** @type {any} */ (spec).paths["/owned"].put.requestBody = {
          $ref: 42,
          put: {},
        };
        /** @type {any} */ (spec).components = {
          requestBodies: {
            Body: { content: { "text/plain": { schema: { type: "string" } } } },
          },
        };
      }
      let contents = JSON.stringify(spec);
      if (numericFocus) {
        const numericSchema = entry.schema || {
          type: "number",
          minimum: "__BOUND__",
          ...(version === "2.0" || version.startsWith("3.0.")
            ? { exclusiveMinimum: true }
            : { exclusiveMinimum: "__BOUND__" }),
        };
        const sample = "__INSTANCE__";
        const media = {
          schema: numericSchema,
          ...(entry.modern
            ? {
                examples: {
                  authored: {
                    [entry.modern]:
                      entry.modern === "serializedValue" ? entry.raw : sample,
                  },
                },
              }
            : { example: sample }),
        };
        if (version === "2.0") {
          spec = {
            swagger: version,
            info: { title: "Owned", version: "1" },
            paths: {
              "/owned": {
                post: {
                  operationId: "owned",
                  responses: {
                    200: {
                      description: "OK",
                      schema: numericSchema,
                      examples: { "application/json": sample },
                    },
                  },
                },
              },
            },
          };
          spec.definitions = { Sample: { ...numericSchema, default: sample } };
        } else {
          spec.paths["/owned"].post.requestBody = {
            content: { "application/json": media },
          };
          spec.paths["/owned"].post.responses[200].content = {
            "application/json": media,
          };
          if (entry.requestOnly)
            delete spec.paths["/owned"].post.responses[200].content;
          if (entry.responseOnly) delete spec.paths["/owned"].post.requestBody;
        }
        if (entry.attached) {
          const attachedSource = JSON.stringify(spec)
            .replaceAll('"__INSTANCE__"', () => entry.raw)
            .replaceAll('"__BOUND__"', () => entry.bound);
          referenceFiles.push({
            name: "numbers.json",
            contents: attachedSource,
          });
          spec = {
            ...(version === "2.0"
              ? { swagger: version }
              : { openapi: version }),
            info: { title: "Owned", version: "1" },
            paths: { "/owned": { $ref: "numbers.json#/paths/~1owned" } },
          };
        }
        contents = JSON.stringify(spec)
          .replaceAll('"__INSTANCE__"', () => entry.raw)
          .replaceAll('"__BOUND__"', () => entry.bound);
      }
      const jobId = crypto.randomUUID();
      const child = Bun.spawn(
        executable
          ? [resolve(executable)]
          : [process.execPath, "tools/spectral-linter/host.js"],
        { stdin: "pipe", stdout: "pipe", stderr: "pipe", windowsHide: true },
      );
      child.stdin.write(
        JSON.stringify({
          protocol: 1,
          jobId,
          sourceJson: JSON.stringify({
            fileName: "openapi.yaml",
            contents,
            files: referenceFiles,
          }),
          repositoryRoot: entry.ruleset ? repositories[entry.ruleset] : null,
          rulesetPath: entry.ruleset
            ? join(repositories[entry.ruleset], "other/.spectral.yaml")
            : null,
        }) + "\n",
      );
      child.stdin.end();
      const [stdout, stderr, exit] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      assert.equal(exit, 0);
      const reply = JSON.parse(stdout);
      assert.equal(reply.jobId, jobId);
      assert.equal(reply.error, undefined, stdout + stderr);
      const parsed = /** @type {{diagnostics:Record<string,any>[]}} */ (
        JSON.parse(reply.resultJson)
      );
      if (numericFocus) {
        await Bun.write(
          join(output, version + "-" + entry.id + ".json"),
          JSON.stringify(
            { contents, referenceFiles, parsed, stderr, exit },
            null,
            2,
          ),
        );
        const errors = parsed.diagnostics.filter((r) => r.severity === 0);
        if(entry.arrayCustom){assert.ok(errors.some(r=>r.code==="array-items"),JSON.stringify(parsed));results.push({version,id:entry.id,diagnostics:parsed.diagnostics});continue;}
        if (entry.structuralInvalid) {
          if (entry.countKey)
            assert.ok(
              parsed.diagnostics.some(
                (r) =>
                  r.severity === 0 &&
                  r.path.at(-1) === entry.countKey &&
                  r.message.includes("must be a non-negative integer"),
              ),
              JSON.stringify(parsed),
            );
          assert.ok(
            parsed.diagnostics.some(
              (r) =>
                r.code === "duplicated-entry-in-enum" ||
                r.code === (version === "2.0" ? "oas2-schema" : "oas3-schema"),
            ),
            JSON.stringify(parsed),
          );
          results.push({
            version,
            id: entry.id,
            diagnostics: parsed.diagnostics,
          });
          continue;
        }
        assert.ok(
          !parsed.diagnostics.some(
            (r) => r.code === "duplicated-entry-in-enum",
          ),
          JSON.stringify(parsed),
        );
        assert.equal(
          errors.some((r) => /valid-(media|schema)-example$/.test(r.code)),
          !!entry.invalid,
          version + " " + entry.id + JSON.stringify(parsed),
        );
        assert.ok(
          errors.every((r) => /valid-(media|schema)-example$/.test(r.code)),
          JSON.stringify(parsed),
        );
        if (entry.attached && errors.length)
          assert.ok(errors.every((r) => r.source === "memory:///numbers.json"));
        results.push({
          version,
          id: entry.id,
          diagnostics: parsed.diagnostics,
        });
        continue;
      }
      if (entry.ruleset) {
        assert.equal(
          /** @type {any} */ (parsed).selectedRuleset,
          entry.ruleset === "custom" ? "custom" : "default",
        );
        assert.equal(
          /** @type {any} */ (parsed).fallback,
          entry.ruleset === "fallback",
        );
        if (
          entry.ruleset === "custom" &&
          !legacySiblingFocus &&
          !referenceFocus
        )
          assert.deepEqual(
            parsed.diagnostics,
            [],
            "Custom rules see original fields",
          );
      }
      const diagnostics = parsed.diagnostics.filter((r) =>
        [
          "oas3-valid-media-example",
          "oas3-examples-value-or-externalValue",
          ...(pathItemFocus ? ["no-$ref-siblings", "oas3-schema"] : []),
        ].includes(r.code),
      );
      if (legacySiblingFocus) {
        const siblingErrors = parsed.diagnostics.filter(
          (r) => r.code === "no-$ref-siblings",
        );
        await Bun.write(
          join(output, version + "-" + entry.id + ".json"),
          JSON.stringify({ spec, parsed, stderr, exit }, null, 2),
        );
        const warnings = parsed.diagnostics.filter(
          (r) => r.code === "oas-ignored-schema-ref-siblings",
        );
        assert.equal(
          siblingErrors.length > 0,
          entry.ruleset === "custom",
          version + " " + entry.id,
        );
        if (!entry.ordinaryLegacy && entry.ruleset !== "custom") {
          assert.ok(warnings.length > 0, JSON.stringify(parsed));
          assert.ok(
            warnings.every(
              (r) => r.severity === 1 && r.source === "memory:///openapi.yaml",
            ),
          );
        }
        const exampleErrors = parsed.diagnostics.filter((r) =>
          /valid-(media|schema)-example$/.test(r.code),
        );
        if (!entry.invalidSchema)
          assert.equal(
            exampleErrors.length > 0,
            !!entry.invalidExample,
            JSON.stringify(parsed),
          );
        if (entry.invalidSchema)
          assert.ok(
            parsed.diagnostics.some(
              (r) =>
                r.severity === 0 &&
                r.code === (version === "2.0" ? "oas2-schema" : "oas3-schema"),
            ),
            JSON.stringify(parsed),
          );
        if (
          !entry.invalidExample &&
          !entry.invalidSchema &&
          entry.ruleset !== "custom"
        )
          assert.deepEqual(
            parsed.diagnostics.filter((r) => r.severity === 0),
            [],
            JSON.stringify(parsed),
          );
        results.push({
          version,
          id: entry.id,
          diagnostics: parsed.diagnostics,
        });
        continue;
      }
      if (referenceFocus) {
        await Bun.write(
          join(output, version + "-reference-roles.json"),
          JSON.stringify({ spec, parsed, stderr, exit }, null, 2),
        );
        const errors = parsed.diagnostics.filter((r) => r.severity === 0);
        if (
          !entry.attached &&
          entry.ruleset !== "custom" &&
          (version === "2.0" || version.startsWith("3.0."))
        )
          assert.ok(
            parsed.diagnostics.some(
              (r) =>
                r.code === "oas-ignored-reference-siblings" && r.severity === 1,
            ),
            JSON.stringify(parsed),
          );
        results.push({
          version,
          id: entry.id,
          passed: entry.missingTarget
            ? errors.length > 0 &&
              errors.every(
                (r) =>
                  r.code === "invalid-ref" &&
                  r.path.includes("/detached") &&
                  r.source === "memory:///openapi.yaml" &&
                  !!r.range &&
                  JSON.stringify(spec).slice(
                    r.range.start.character,
                    r.range.end.character,
                  ) ===
                    JSON.stringify(
                      spec.paths["/detached"].get.parameters[0].$ref,
                    ),
              )
            : errors.length === 0,
          diagnostics: parsed.diagnostics,
        });
        continue;
      }
      await Bun.write(
        join(output, version + "-" + entry.id + ".json"),
        JSON.stringify({ spec, parsed, stderr, exit }, null, 2),
      );
      const code =
        !version.startsWith("3.2.") && entry.id === "serialized-json"
          ? "oas3-valid-media-example"
          : pathItemFocus && entry.ordinaryRef && !version.startsWith("3.0.")
            ? "oas3-schema"
            : entry.code;
      if (code) {
        assert.ok(
          diagnostics.some((r) => r.code === code),
          version + " " + entry.id + JSON.stringify(diagnostics),
        );
        if (entry.field)
          assert.ok(
            diagnostics.some(
              (r) => r.code === code && r.path.includes(entry.field),
            ),
            JSON.stringify(diagnostics),
          );
      } else assert.deepEqual(diagnostics, [], version + " " + entry.id);
      results.push({ version, id: entry.id, diagnostics });
    }
  }
  const passed =
    !referenceFocus || results.every((r) => "passed" in r && r.passed);
  await Bun.write(
    join(output, "acceptance.json"),
    JSON.stringify(
      {
        passed,
        executable: executable || "source-host",
        count: results.length,
        results,
        limits:
          "Default-rule producer examples only; no full OpenAPI/native/provider/platform claim.",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed, output, count: results.length }));
  process.exit(passed ? 0 : 1);
}

// Actual producer source/SDK protocol controls only; not Rust/native app acceptance.
const output = resolve(
    "artifacts/spectral-managed-read-fix/producer-" + Date.now(),
  ),
  repository = join(output, "repository");
await mkdir(join(repository, "other/functions"), { recursive: true });
const sha = (/** @type {Uint8Array} */ raw) =>
    createHash("sha256").update(raw).digest("hex"),
  spec = {
    fileName: "openapi.yaml",
    contents:
      "openapi: 3.1.0\ninfo: {title: Owned, version: '1'}\npaths: {}\ncomponents:\n  schemas:\n    Owned:\n      $ref: './schema.yaml'\n",
    files: [],
  };
const executable = process.env.INSOMNIUM_SPECTRAL_READ_TEST_EXE;
if (executable) {
  assert.ok(
    resolve(executable).startsWith(
      resolve("artifacts/spectral-managed-read-fix") + sep,
    ),
  );
  assert.equal(basename(executable), "spectral-linter.exe");
  assert.ok(await Bun.file(executable).exists());
}
await writeFile(join(repository, "schema.yaml"), "type: string\n");
const rules =
  "extends: []\nrules:\n  owned:\n    severity: warn\n    given: '$.info'\n    then:\n      function: check\nfunctions: [check]\nfunctionsDir: ./functions\n";
await writeFile(join(repository, "other/.spectral.yaml"), rules);
await writeFile(
  join(repository, "other/functions/helper.js"),
  "export const message='Owned helper 😀';\n",
);
await writeFile(
  join(repository, "other/functions/check.js"),
  "import {message} from './helper.js';export default function(){return [{message,path:['info','title']}];}\n",
);
/** @param {number} protocol */ async function run(protocol) {
  const env = { ...process.env };
  for (const key of ["BUN_BE_BUN", "BUN_OPTIONS", "NODE_OPTIONS", "NODE_PATH"])
    delete env[key];
  const jobId = crypto.randomUUID(),
    child = Bun.spawn(
      executable
        ? [executable]
        : [process.execPath, "tools/spectral-linter/host.js"],
      {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
        env,
      },
    ),
    frame = {
      protocol,
      jobId,
      sourceJson: JSON.stringify(spec),
      repositoryRoot: repository,
      rulesetPath: join(repository, "other/.spectral.yaml"),
    };
  child.stdin.write(JSON.stringify(frame) + "\n");
  child.stdin.end();
  const [stdout, stderr, exit] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  await Bun.write(
    join(output, "raw-" + protocol + "-" + jobId + ".json"),
    JSON.stringify({ stdout, stderr, exit }, null, 2),
  );
  assert.equal(exit, 0);
  const reply = JSON.parse(stdout);
  assert.equal(reply.jobId, jobId);
  assert.equal(reply.protocol, protocol);
  assert.equal(reply.error, undefined);
  const parsed = JSON.parse(reply.resultJson);
  await Bun.write(
    join(output, "frame-" + protocol + "-" + jobId + ".json"),
    JSON.stringify({ reply, stderr, exit }, null, 2),
  );
  return { reply, parsed };
}
const before = await run(1),
  actual = await run(2);
assert.deepEqual(actual.parsed, before.parsed);
assert.equal(actual.parsed.selectedRuleset, "custom");
assert.ok(
  actual.parsed.diagnostics.some(
    (/** @type {any} */ r) => r.message === "Owned helper 😀",
  ),
);
assert.equal(actual.reply.readSet.version, 1);
const names = new Map();
for (const row of actual.reply.readSet.entries) {
  const name = Buffer.from(row.logical, "base64").toString("utf16le");
  names.set(name.replaceAll("\\", "/"), row);
  assert.equal(row.outcome, "bytes");
  assert.equal(row.sha256, sha(await readFile(join(repository, name))));
}
for (const path of [
  "other/.spectral.yaml",
  "other/functions/check.js",
  "other/functions/helper.js",
  "schema.yaml",
])
  assert.ok(names.has(path), "Actual consumed closure " + path);
await writeFile(
  join(repository, "other/.spectral.yaml"),
  "extends: [./missing-owned.yaml]\n",
);
const fallback = await run(2);
assert.equal(fallback.parsed.fallback, true);
assert.ok(
  fallback.reply.readSet.entries.some(
    (/** @type {any} */ row) =>
      row.outcome === "missing" &&
      Buffer.from(row.logical, "base64")
        .toString("utf16le")
        .endsWith("missing-owned.yaml"),
  ),
  "Failed direct fallback dependency read must be recorded",
);
await writeFile(
  join(repository, "other/extend.yaml"),
  'extends: []\nrules:\n  extension-warning:\n    severity: warn\n    given: "$.info"\n    then:\n      field: x-extension\n      function: truthy\n',
);
await writeFile(
  join(repository, "other/.spectral.yaml"),
  "extends: [./extend.yaml]\n",
);
const nestedBefore = await run(1),
  nestedActual = await run(2);
assert.deepEqual(nestedActual.parsed, nestedBefore.parsed);
assert.ok(
  nestedActual.reply.readSet.entries.some(
    (/** @type {any} */ row) =>
      row.outcome === "bytes" &&
      Buffer.from(row.logical, "base64")
        .toString("utf16le")
        .endsWith("extend.yaml"),
  ),
  "Actual nested YAML consumed bytes must be recorded",
);
await Bun.write(
  join(output, "acceptance.json"),
  JSON.stringify(
    {
      passed: true,
      actualSourceProducer: true,
      actualCompiledProducer: !!executable,
      executableSha256: executable
        ? sha(await Bun.file(executable).bytes())
        : null,
      native: false,
      version1ResultEqualVersion2: true,
      paths: [...names.keys()],
      fallbackMissingReceipt: true,
      nestedExtendsResultEqual: true,
      nestedExtendsSelectedRuleset: nestedActual.parsed.selectedRuleset,
      nestedExtendsFallback: nestedActual.parsed.fallback,
      externalAmbientNotClaimed: true,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ passed: true, output, paths: [...names.keys()] }));
