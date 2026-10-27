import { analyzeSpec, generateRequests } from "../../../src/lib/openapi.js";
import {
  encodeGitResource,
  decodeGitResource,
} from "../../../src/lib/git-resources.js";
import { prepareRenderedRequest } from "../../../src/lib/transport.js";

const ref = (/** @type {string} */ name) => ({
  $ref: "#/components/schemas/" + name,
});
const text = { type: "string", default: "allowed" };
const property = (/** @type {any} */ serverOnly) => ({
  type: "object",
  required: ["serverOnly"],
  properties: { serverOnly, name: text },
});
export const readOnlySchemaCases = [
  {
    name: "readonly direct false branch",
    schema: property({ readOnly: true, allOf: [false] }),
    expected: { name: "allowed" },
  },
  {
    name: "readonly allOf annotation",
    schema: property({ allOf: [false, { readOnly: true }] }),
    expected: { name: "allowed" },
  },
  {
    name: "readonly false reference siblings",
    schema: property({ ...ref("False"), readOnly: true }),
    expected: { name: "allowed" },
  },
  {
    name: "readonly false dynamic reference siblings",
    schema: property({
      $dynamicRef: "#/components/schemas/False",
      readOnly: true,
    }),
    expected: { name: "allowed" },
  },
  {
    name: "readonly nested required property",
    schema: {
      type: "object",
      properties: { profile: property({ readOnly: true, allOf: [false] }) },
    },
    expected: { profile: { name: "allowed" } },
  },
  {
    name: "readonly writable false sibling",
    schema: {
      ...property({ readOnly: true, allOf: [false] }),
      required: ["serverOnly", "writable"],
      properties: {
        serverOnly: { readOnly: true, allOf: [false] },
        writable: false,
        name: text,
      },
    },
    refusal: true,
  },
  {
    name: "readonly false annotation stays writable",
    schema: property({ readOnly: false, allOf: [false] }),
    refusal: true,
  },
  {
    name: "readonly invalid alternative is not unconditional",
    schema: property({ anyOf: [{ readOnly: true, allOf: [false] }, text] }),
    expected: { serverOnly: "allowed", name: "allowed" },
  },
  {
    name: "readonly negated annotation is not unconditional",
    schema: property({ ...text, not: { readOnly: true, allOf: [false] } }),
    expected: { serverOnly: "allowed", name: "allowed" },
  },
  {
    name: "readonly explicit omission",
    schema: property({ allOf: [false, { readOnly: true }] }),
    example: { name: "explicit" },
    expected: { name: "explicit" },
  },
  {
    name: "readonly explicit prohibited value",
    schema: property({ readOnly: true, allOf: [false] }),
    example: { serverOnly: "no", name: "explicit" },
    refusal: true,
  },
  {
    name: "readonly composed nonboolean property",
    schema: property({ allOf: [text, { readOnly: true }] }),
    expected: { name: "allowed" },
  },
  {
    name: "readonly literal annotation stays data",
    schema: {
      type: "object",
      required: ["payload"],
      properties: {
        payload: {
          type: "object",
          default: { readOnly: true, allOf: [false] },
        },
      },
    },
    expected: { payload: { readOnly: true, allOf: [false] } },
  },
].map((entry) => ({ ...entry, readOnlyContract: true }));
export const booleanSchemaCases = [
  { name: "direct true", schema: true, expected: null },
  { name: "referenced true", schema: ref("True"), expected: null },
  {
    name: "true reference siblings",
    schema: { ...ref("True"), ...text },
    expected: "allowed",
  },
  {
    name: "optional forbidden property",
    schema: {
      type: "object",
      properties: { allowed: text, forbidden: ref("False") },
    },
    expected: { allowed: "allowed" },
  },
  {
    name: "anyOf viable branch",
    schema: { anyOf: [ref("False"), text] },
    expected: "allowed",
  },
  {
    name: "oneOf viable branch",
    schema: { oneOf: [false, text] },
    expected: "allowed",
  },
  {
    name: "allOf true branch",
    schema: { allOf: [true, text] },
    expected: "allowed",
  },
  { name: "not false", schema: { ...text, not: false }, expected: "allowed" },
  {
    name: "boolean conditional true",
    schema: { if: true, then: text, else: false },
    expected: "allowed",
  },
  {
    name: "boolean conditional false",
    schema: { if: false, then: false, else: text },
    expected: "allowed",
  },
  {
    name: "empty array forbidden items",
    schema: { type: "array", items: false },
    expected: [],
  },
  {
    name: "prefix forbidden slot",
    schema: { type: "array", prefixItems: [text, false] },
    expected: ["allowed"],
  },
  { name: "false root", schema: false, refusal: true },
  { name: "false reference", schema: ref("False"), refusal: true },
  {
    name: "false reference siblings",
    schema: { ...ref("False"), ...text },
    refusal: true,
  },
  {
    name: "required forbidden property",
    schema: {
      type: "object",
      required: ["forbidden"],
      properties: { forbidden: false },
    },
    refusal: true,
  },
  {
    name: "allOf false branch",
    schema: { allOf: [ref("True"), ref("False"), text] },
    refusal: true,
  },
  { name: "anyOf all false", schema: { anyOf: [false, false] }, refusal: true },
  {
    name: "oneOf duplicate true",
    schema: { oneOf: [true, true] },
    refusal: true,
  },
  { name: "not true", schema: { ...text, not: true }, refusal: true },
  {
    name: "required array forbidden items",
    schema: { type: "array", minItems: 1, items: false },
    refusal: true,
  },
  {
    name: "invalid explicit example",
    schema: { type: "object", properties: { forbidden: false } },
    example: { forbidden: "no" },
    refusal: true,
  },
  {
    name: "valid explicit example",
    schema: { type: "object", properties: { forbidden: false } },
    example: { allowed: "yes" },
    expected: { allowed: "yes" },
  },
  {
    name: "literal booleans",
    schema: {
      type: "object",
      default: { true: true, false: false, $ref: false, $dynamicRef: true },
    },
    expected: { true: true, false: false, $ref: false, $dynamicRef: true },
  },
  ...readOnlySchemaCases,
];

/** @param {string} version @param {string} server */
export function booleanSchemaDocument(version, server) {
  return {
    openapi: version,
    info: { title: "Boolean schema samples", version: "1" },
    servers: [{ url: server }],
    components: { schemas: { True: true, False: false } },
    paths: Object.fromEntries(
      booleanSchemaCases.map((entry, index) => [
        "/boolean-" + index,
        {
          post: {
            summary: entry.name,
            operationId: "boolean_" + index,
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: entry.schema,
                  ...(Object.hasOwn(entry, "example")
                    ? { example: entry.example }
                    : {}),
                },
              },
            },
            responses: { 200: { description: "OK" } },
          },
        },
      ]),
    ),
  };
}

export const legacySchemaCases = /** @type {Record<string,any>[]} */ ([
  {
    name: "exclusive minimum refuses boundary",
    schema: { type: "integer", minimum: 5, exclusiveMinimum: true },
    value: 5,
    refusal: true,
  },
  {
    name: "exclusive minimum accepts above",
    schema: { type: "integer", minimum: 5, exclusiveMinimum: true },
    value: 6,
  },
  {
    name: "inclusive minimum",
    schema: { type: "integer", minimum: 5, exclusiveMinimum: false },
    value: 5,
  },
  {
    name: "exclusive maximum refuses boundary",
    schema: { type: "number", maximum: 5, exclusiveMaximum: true },
    value: 5,
    refusal: true,
  },
  {
    name: "exclusive maximum accepts below",
    schema: { type: "number", maximum: 5, exclusiveMaximum: true },
    value: 4,
  },
  {
    name: "inclusive maximum",
    schema: { type: "number", maximum: 5, exclusiveMaximum: false },
    value: 5,
  },
  {
    name: "multipleOf",
    schema: { type: "number", multipleOf: 2 },
    value: 3,
    refusal: true,
  },
  {
    name: "enum",
    schema: { type: "integer", enum: [1, 2] },
    value: 3,
    refusal: true,
  },
  {
    name: "object type violation",
    schema: {
      type: "object",
      properties: { n: { type: "number" } },
      required: ["n"],
    },
    value: { n: "bad" },
    refusal: true,
  },
  {
    name: "object missing required",
    schema: {
      type: "object",
      properties: { n: { type: "number" } },
      required: ["n"],
    },
    value: {},
    refusal: true,
  },
  {
    name: "object valid",
    schema: {
      type: "object",
      properties: { n: { type: "number" } },
      required: ["n"],
    },
    value: { n: 2 },
  },
  {
    name: "array minItems",
    schema: { type: "array", items: { type: "integer" }, minItems: 2 },
    value: [1],
    refusal: true,
  },
  {
    name: "readOnly required",
    schema: {
      type: "object",
      properties: {
        serverOnly: { type: "string", readOnly: true },
        name: { type: "string" },
      },
      required: ["serverOnly", "name"],
    },
    value: { name: "owned" },
  },
  {
    name: "generated exclusive sample",
    schema: { type: "integer", minimum: 5, exclusiveMinimum: true },
    generated: true,
  },
  {
    name: "generated pattern requires review",
    schema: { type: "string", pattern: "^owned$" },
    refusal: true,
  },
  {
    name: "invalid default",
    schema: { type: "integer", minimum: 5, default: 2 },
    refusal: true,
  },
  {
    name: "numeric keyword on string",
    schema: { type: "string", minimum: 5, exclusiveMinimum: true },
    value: "owned",
  },
  {
    name: "nullable typed null",
    schema: { type: "string", nullable: true },
    value: null,
    nullable: true,
  },
  {
    name: "nullable enum still applies",
    schema: { type: "string", nullable: true, enum: ["owned"] },
    value: null,
    refusal: true,
    nullable: true,
  },
  {
    name: "nullable without type",
    schema: { nullable: true, enum: ["owned"] },
    value: null,
    refusal: true,
    nullable: true,
  },
  {
    name: "nullable false",
    schema: { type: "string", nullable: false },
    value: null,
    refusal: true,
    nullable: true,
  },
  {
    name: "nullable allOf still applies",
    schema: { type: "object", nullable: true, allOf: [{ type: "object" }] },
    value: null,
    refusal: true,
    nullable: true,
  },
  {
    name: "nested nullable",
    schema: {
      type: "object",
      properties: { n: { type: "integer", nullable: true } },
      required: ["n"],
    },
    value: { n: null },
    nullable: true,
  },
]);

/** @param {string} version @param {Record<string,any>} entry */
export function legacySchemaDocument(version, entry) {
  const swagger = version === "2.0",
    definition = structuredClone(entry.schema),
    reference = {
      $ref: swagger ? "#/definitions/Payload" : "#/components/schemas/Payload",
    };
  const operation = /** @type {Record<string,any>} */ ({
    operationId: "owned",
    responses: { 200: { description: "OK" } },
  });
  if (entry.query) {
    operation.parameters = [
      swagger
        ? {
            name: "n",
            in: "query",
            required: false,
            ...definition,
            default: entry.value,
          }
        : {
            name: "n",
            in: "query",
            required: false,
            schema: reference,
            example: entry.value,
          },
    ];
  } else if (swagger) {
    if (Object.hasOwn(entry, "value")) definition.example = entry.value;
    operation.parameters = [{ name: "body", in: "body", schema: reference }];
  } else {
    operation.requestBody = {
      content: {
        "application/json": {
          schema: reference,
          ...(entry.external
            ? { examples: { owned: { externalValue: "raw.json" } } }
            : Object.hasOwn(entry, "value")
              ? { example: entry.value }
              : {}),
        },
      },
    };
  }
  return {
    info: { title: "Owned legacy schema", version: "1" },
    paths: { "/owned": { post: operation } },
    ...(swagger
      ? {
          swagger: version,
          host: "127.0.0.1:55555",
          schemes: ["http"],
          consumes: ["application/json"],
          definitions: { Payload: definition },
        }
      : {
          openapi: version,
          servers: [{ url: "http://127.0.0.1:55555" }],
          components: { schemas: { Payload: definition } },
        }),
  };
}

export function booleanSchemaEvidence() {
  const checks = /** @type {Record<string,any>[]} */ ([]);
  for (const version of ["2.0", "3.0.3", "3.0.4"]) {
    const prefix =
      version === "2.0" ? "#/definitions/" : "#/components/schemas/";
    for (const entry of [
      {
        name: "ignored nullable",
        wrapper: { nullable: true },
        base: { type: "string" },
        value: null,
        refusal: true,
      },
      {
        name: "ignored type override",
        wrapper: { type: "integer" },
        base: { type: "string" },
        value: 6,
        refusal: true,
      },
      {
        name: "ignored unresolved child",
        wrapper: { properties: { unused: { $ref: "missing.json#/No" } } },
        base: { type: "integer" },
        value: 6,
        refusal: false,
      },
      {
        name: "reference chain ignores type",
        wrapper: { type: "number" },
        base: { $ref: prefix + "Plain", type: "integer" },
        value: "owned",
        refusal: false,
      },
      {
        name: "pointer into ignored sibling",
        wrapper: {},
        base: {
          $ref: prefix + "Plain",
          properties: { owned: { type: "integer", default: 7 } },
        },
        value: 7,
        refusal: false,
        detached: true,
      },
    ]) {
      const document = /** @type {Record<string,any>} */ (
        legacySchemaDocument(version, { schema: {}, value: entry.value })
      );
      const definitions =
        version === "2.0" ? document.definitions : document.components.schemas;
      definitions.Base = structuredClone(entry.base);
      definitions.Plain = { type: "string" };
      definitions.Payload = {
        $ref: prefix + "Base" + (entry.detached ? "/properties/owned" : ""),
        ...entry.wrapper,
      };
      // Swagger examples belong to the referenced schema. A sibling example on
      // Payload is ignored just like every other Reference Object sibling.
      if (version === "2.0") {
        const target = entry.detached
          ? definitions.Base.properties.owned
          : entry.name === "reference chain ignores type"
            ? definitions.Plain
            : definitions.Base;
        target.example = entry.value;
      }
      const contents = JSON.stringify(document);
      const analysis = analyzeSpec({ contents });
      if (!analysis.valid)
        throw Error(entry.name + ": " + JSON.stringify(analysis.diagnostics));
      if (JSON.stringify(analysis.original) !== contents)
        throw Error("Reference sibling source was rewritten");
      if (JSON.stringify(analysis.schema).includes("__insomnium_literal_ref__"))
        throw Error("Private reference fields leaked");
      for (const [transport, current] of [
        ["direct", analysis],
        ["worker-clone", structuredClone(analysis)],
      ]) {
        const request = generateRequests(
          /** @type {ReturnType<typeof analyzeSpec>} */ (current),
          "wrk_ref",
          "spc_ref",
        ).find((r) => r._type === "request");
        if (
          !request ||
          !!request._openapiSchemaIssues?.length !== entry.refusal
        )
          throw Error(
            "Legacy reference sibling review changed: " +
              version +
              " " +
              entry.name,
          );
        if (
          !entry.refusal &&
          request.body.text !== JSON.stringify(entry.value, null, 2)
        )
          throw Error("Legacy reference sibling body changed: " + entry.name);
        checks.push({ version, name: entry.name, transport, passed: true });
      }
    }
  }
  for (const version of ["3.1.0", "3.2.0", "3.2.1"]) {
    const document = booleanSchemaDocument(version, "http://127.0.0.1:55555");
    const source = { contents: JSON.stringify(document) };
    const before = source.contents;
    const analysis = analyzeSpec(source);
    if (!analysis.valid) throw Error(JSON.stringify(analysis.diagnostics));
    if (
      analysis.schema.components.schemas.True !== true ||
      analysis.schema.components.schemas.False !== false
    )
      throw Error("Resolved boolean identities changed");
    for (const [transport, current] of [
      ["direct", analysis],
      ["worker-clone", structuredClone(analysis)],
    ]) {
      const resources = generateRequests(
        /** @type {ReturnType<typeof analyzeSpec>} */ (current),
        "wrk_bool",
        "spc_bool",
      );
      for (const [index, entry] of booleanSchemaCases.entries()) {
        const request = resources.find(
          (r) =>
            r._type === "request" &&
            new URL(r.url).pathname === "/boolean-" + index,
        );
        if (!request) throw Error("Missing boolean request");
        const encoded = encodeGitResource(request),
          restored = decodeGitResource(encoded.path, encoded.content);
        if (!restored) throw Error("Boolean Git request missing");
        if (entry.refusal) {
          if (
            !request._openapiIssues.length ||
            !restored._openapiSchemaIssues?.length
          )
            throw Error("Boolean refusal lost");
          let blocked = false;
          try {
            prepareRenderedRequest(
              { resources, settings: { timeout: 30000 } },
              restored,
              "run_bool",
            );
          } catch (error) {
            blocked = String(error).includes("Review this generated request");
          }
          if (!blocked)
            throw Error("Forbidden sample became sendable after Git");
        } else {
          const wanted = JSON.stringify(entry.expected, null, 2);
          if (
            request._openapiIssues.length ||
            request.body.text !== wanted ||
            restored.body.text !== wanted
          )
            throw Error(
              version + " " + entry.name + " " + JSON.stringify(request),
            );
          prepareRenderedRequest(
            { resources, settings: { timeout: 30000 } },
            restored,
            "run_bool",
          );
        }
        checks.push({
          version,
          transport,
          name: entry.name,
          refusal: !!entry.refusal,
          text: request.body.text,
          issues: request._openapiIssues,
          passed: true,
        });
      }
    }
    if (
      source.contents !== before ||
      JSON.stringify(analysis.original) !== before
    )
      throw Error("Boolean source changed");
    const attached = structuredClone(document);
    attached.paths["/boolean-0"].post.requestBody.content[
      "application/json"
    ].schema = /** @type {any} */ ({ $ref: "allowed.json" });
    const current = analyzeSpec({
      contents: JSON.stringify(attached),
      files: [{ name: "allowed.json", contents: "true" }],
    });
    if (!current.valid)
      throw Error(
        "Attached boolean root refused " + JSON.stringify(current.diagnostics),
      );
    const request = generateRequests(current, "wrk_bool", "spc_bool").find(
      (r) => r._type === "request",
    );
    if (request?.body.text !== "null" || request._openapiIssues.length)
      throw Error("Attached true sample changed");
    checks.push({
      version,
      name: "attached true root/source preserved",
      passed: true,
    });
    const optional = structuredClone(document);
    optional.paths["/boolean-12"].post.requestBody.required = false;
    const omitted = generateRequests(
      analyzeSpec({ contents: JSON.stringify(optional) }),
      "wrk_bool",
      "spc_bool",
    ).find(
      (r) => r._type === "request" && new URL(r.url).pathname === "/boolean-12",
    );
    if (omitted?.body.text !== "" || omitted._openapiIssues.length)
      throw Error("Optional impossible body not omitted");
    checks.push({
      version,
      name: "optional impossible body omitted",
      passed: true,
    });
    for (const [name, required, explicit] of [
      ["optional false parameter", false, false],
      ["required false parameter", true, false],
      ["explicit false parameter", false, true],
    ]) {
      const parameterDocument = structuredClone(document);
      Object.assign(parameterDocument.paths["/boolean-0"].post, {
        parameters: [
          {
            name: "forbidden",
            in: "query",
            required,
            schema: ref("False"),
            ...(explicit ? { example: "no" } : {}),
          },
        ],
      });
      const result = generateRequests(
        analyzeSpec({ contents: JSON.stringify(parameterDocument) }),
        "wrk_bool",
        "spc_bool",
      ).find((r) => r._type === "request");
      if (
        !result ||
        result.parameters.length ||
        !!result._openapiIssues.length !== !!(required || explicit)
      )
        throw Error(String(name) + " parameter omission/refusal mismatch");
      if (required || explicit) {
        const encoded = encodeGitResource(result),
          restored = decodeGitResource(encoded.path, encoded.content);
        if (!restored?._openapiSchemaIssues.length)
          throw Error("Parameter Git review lost");
      }
      checks.push({
        version,
        name,
        refusal: !!(required || explicit),
        passed: true,
      });
    }
    for (const [name, definition, files] of [
      [
        "attached false root",
        { $ref: "denied.json" },
        [{ name: "denied.json", contents: "false" }],
      ],
      [
        "dynamic pointer to false",
        { $dynamicRef: "#/components/schemas/False" },
        [],
      ],
    ]) {
      const forbidden = structuredClone(document);
      forbidden.paths["/boolean-0"].post.requestBody.content[
        "application/json"
      ].schema = /** @type {any} */ (definition);
      const source = { contents: JSON.stringify(forbidden), files },
        before = JSON.stringify(source);
      const current = analyzeSpec(source);
      if (!current.valid)
        throw Error(String(name) + JSON.stringify(current.diagnostics));
      const result = generateRequests(
        structuredClone(current),
        "wrk_bool",
        "spc_bool",
      ).find((r) => r._type === "request");
      if (!result?._openapiIssues.length || JSON.stringify(source) !== before)
        throw Error(String(name) + " lost refusal/source");
      checks.push({ version, name, refusal: true, passed: true });
    }
    for (const format of version.startsWith("3.2.")
      ? ["external", "serialized"]
      : ["external"]) {
      for (const valid of [true, false]) {
        const exampleDocument = structuredClone(document);
        const raw = valid ? ' { "allowed":true }\n' : ' { "forbidden":true }\n';
        exampleDocument.paths["/boolean-0"].post.requestBody.content[
          "application/json"
        ] = /** @type {any} */ ({
          schema: { type: "object", properties: { forbidden: false } },
          examples: {
            owned:
              format === "external"
                ? { externalValue: "raw.json" }
                : { serializedValue: raw },
          },
        });
        const source = {
            contents: JSON.stringify(exampleDocument),
            exampleFiles:
              format === "external"
                ? [{ name: "raw.json", base64: btoa(raw) }]
                : [],
          },
          before = JSON.stringify(source);
        const current = analyzeSpec(source);
        if (!current.valid)
          throw Error(
            "Raw example invalid document " +
              JSON.stringify(current.diagnostics),
          );
        const result = generateRequests(
          structuredClone(current),
          "wrk_bool",
          "spc_bool",
        ).find((r) => r._type === "request");
        if (
          !result ||
          !!result._openapiIssues.length === valid ||
          JSON.stringify(source) !== before
        )
          throw Error("Raw example boolean mismatch");
        const encoded = encodeGitResource(result),
          restored = decodeGitResource(encoded.path, encoded.content);
        if (!valid && !restored?._openapiSchemaIssues.length)
          throw Error("Raw example review lost through Git");
        if (
          valid &&
          (format === "external"
            ? result.body.base64 !== btoa(raw)
            : result.body.text !== raw)
        )
          throw Error("Raw example bytes changed");
        checks.push({
          version,
          name: format + " " + (valid ? "valid" : "invalid") + " JSON bytes",
          refusal: !valid,
          passed: true,
        });
      }
    }
  }
  for (const version of ["3.1.2", "3.2.0", "3.2.1"]) {
    for (const channel of [
      "inline",
      "external",
      "parameter",
      ...(version.startsWith("3.2.") ? ["serialized"] : []),
    ])
      for (const valid of [true, false]) {
        const raw = valid
          ? ' { "n": 9007199254740993 }\n'
          : ' { "n": "bad" }\n';
        const definition = {
          type: "object",
          properties: { n: { type: "number" } },
          required: ["n"],
        };
        const example =
          channel === "external"
            ? { externalValue: "ordinary.json" }
            : channel === "serialized"
              ? { serializedValue: raw }
              : { value: JSON.parse(raw) };
        const media = { schema: ref("Payload"), examples: { owned: example } };
        const operation = /** @type {Record<string,any>} */ ({
          responses: { 200: { description: "OK" } },
        });
        if (channel === "parameter")
          operation.parameters = [
            {
              name: "payload",
              in: "query",
              content: { "application/json": media },
            },
          ];
        else operation.requestBody = { content: { "application/json": media } };
        const document = {
          openapi: version,
          info: { title: "Ordinary schema", version: "1" },
          servers: [{ url: "http://127.0.0.1:55555" }],
          components: { schemas: { Payload: definition } },
          paths: { "/ordinary": { post: operation } },
        };
        const source = {
            contents: JSON.stringify(document),
            exampleFiles:
              channel === "external"
                ? [{ name: "ordinary.json", base64: btoa(raw) }]
                : [],
          },
          before = JSON.stringify(source),
          analysis = analyzeSpec(source);
        if (
          !analysis.valid ||
          !analysis.schemaEvaluation ||
          analysis.schemaEvaluation.booleans.size
        )
          throw Error(
            "Ordinary schema must have a graph without boolean nodes",
          );
        const resources = generateRequests(
            structuredClone(analysis),
            "wrk_bool",
            "spc_ordinary",
          ),
          request = resources.find((r) => r._type === "request");
        if (
          !request ||
          !!request._openapiIssues.length === valid ||
          JSON.stringify(source) !== before
        )
          throw Error(
            "Ordinary schema validation changed " + version + " " + channel,
          );
        const encoded = encodeGitResource(request),
          restored = decodeGitResource(encoded.path, encoded.content);
        if (
          !valid &&
          !restored?._openapiSchemaIssues?.some((/** @type {string} */ issue) =>
            issue.includes("Example does not satisfy the schema:"),
          )
        )
          throw Error("Ordinary schema review lost through Git");
        let refused = false,
          refusal = "";
        try {
          prepareRenderedRequest(
            { resources, settings: { timeout: 30000 } },
            request,
            "ordinary_contract",
          );
        } catch (error) {
          refused = true;
          refusal = String(error);
        }
        if (refused === valid)
          throw Error(
            "Ordinary schema preflight changed " +
              version +
              " " +
              channel +
              " " +
              valid +
              " " +
              refusal,
          );
        if (
          valid &&
          channel === "external" &&
          request.body.base64 !== btoa(raw)
        )
          throw Error("Ordinary external bytes rewritten");
        if (valid && channel === "serialized" && request.body.text !== raw)
          throw Error("Ordinary serialized bytes rewritten");
        checks.push({
          version,
          name: "ordinary " + channel + " " + (valid ? "valid" : "invalid"),
          refusal: !valid,
          passed: true,
        });
      }
    const sampleSchema = {
      type: "object",
      properties: {
        n: { type: "integer", minimum: 5 },
        serverOnly: { type: "string", readOnly: true },
      },
      required: ["n", "serverOnly"],
    };
    const operation = {
      requestBody: {
        content: { "application/json": { schema: sampleSchema } },
      },
      responses: { 200: { description: "OK" } },
    };
    const document = {
      openapi: version,
      info: { title: "Ordinary sample", version: "1" },
      servers: [{ url: "http://127.0.0.1:55555" }],
      paths: { "/sample": { post: operation } },
    };
    const a = analyzeSpec({ contents: JSON.stringify(document) }),
      request = generateRequests(a, "wrk_bool", "spc_sample").find(
        (r) => r._type === "request",
      );
    if (
      !a.valid ||
      !request ||
      request._openapiIssues.length ||
      JSON.parse(request.body.text).n < 5 ||
      Object.hasOwn(JSON.parse(request.body.text), "serverOnly")
    )
      throw Error("Ordinary sample/readOnly constraints changed");
    checks.push({
      version,
      name: "ordinary generated sample and readOnly",
      passed: true,
    });
  }
  for (const version of ["2.0", "3.0.3", "3.0.4"]) {
    /** @type {Record<string,any>[]} */
    const entries = [
      ...legacySchemaCases.filter((e) => version !== "2.0" || !e.nullable),
      ...[false, true].map((valid) => ({
        name: "query bound " + valid,
        schema: { type: "integer", minimum: 5, exclusiveMinimum: true },
        value: valid ? 6 : 5,
        refusal: !valid,
        query: true,
      })),
    ];
    if (version !== "2.0")
      for (const valid of [false, true])
        entries.push({
          name: "external bound " + valid,
          schema: { type: "number", minimum: 5, exclusiveMinimum: true },
          external: true,
          raw: valid ? " 6e+00\n" : " 5 \n",
          refusal: !valid,
        });
    for (const entry of entries) {
      const source = {
          contents: JSON.stringify(legacySchemaDocument(version, entry)),
          ...(entry.external
            ? { exampleFiles: [{ name: "raw.json", base64: btoa(entry.raw) }] }
            : {}),
        },
        before = JSON.stringify(source),
        analysis = analyzeSpec(source);
      if (!analysis.valid)
        throw Error(
          "Legacy document invalid " +
            version +
            " " +
            entry.name +
            JSON.stringify(analysis.diagnostics),
        );
      const resources = generateRequests(analysis, "wrk_bool", "spc_legacy"),
        request = resources.find((r) => r._type === "request");
      if (
        !request ||
        !!request._openapiIssues.length !== !!entry.refusal ||
        JSON.stringify(source) !== before
      )
        throw Error(
          "Legacy validation changed " +
            version +
            " " +
            entry.name +
            JSON.stringify(request?._openapiIssues),
        );
      const encoded = encodeGitResource({ ...request, _openapiIssues: [] }),
        restored = decodeGitResource(encoded.path, encoded.content);
      if (!restored) throw Error("Legacy Git request missing");
      let refused = false;
      try {
        prepareRenderedRequest(
          { resources, settings: { timeout: 30000 } },
          restored,
          "legacy_contract",
        );
      } catch (error) {
        refused = String(error).includes(
          "Example does not satisfy the schema:",
        );
      }
      if (refused !== !!entry.refusal)
        throw Error(
          "Legacy durable review changed " + version + " " + entry.name,
        );
      if (!entry.refusal && !entry.query) {
        if (entry.external) {
          if (request.body.base64 !== btoa(entry.raw))
            throw Error("Legacy external bytes rewritten");
        } else if (entry.generated) {
          if (!(JSON.parse(request.body.text) > 5))
            throw Error("Legacy generated exclusive bound changed");
        } else if (request.body.text !== JSON.stringify(entry.value, null, 2))
          throw Error("Legacy authored value changed");
      }
      checks.push({
        version,
        name: "legacy " + entry.name,
        refusal: !!entry.refusal,
        passed: true,
      });
    }
  }
  const fileDocument = {
    swagger: "2.0",
    info: { title: "Legacy file", version: "1" },
    host: "127.0.0.1:55555",
    schemes: ["http"],
    consumes: ["multipart/form-data"],
    paths: {
      "/file": {
        post: {
          parameters: [
            { name: "file", in: "formData", required: true, type: "file" },
          ],
          responses: { 200: { description: "OK" } },
        },
      },
    },
  };
  const fileAnalysis = analyzeSpec({ contents: JSON.stringify(fileDocument) }),
    fileRequest = generateRequests(fileAnalysis, "wrk_bool", "spc_file").find(
      (r) => r._type === "request",
    );
  if (
    !fileAnalysis.valid ||
    !fileRequest?.body.params.some(
      (/** @type {any} */ p) => p.name === "file" && p.type === "file",
    ) ||
    fileRequest._openapiSchemaIssues?.length
  )
    throw Error("Swagger file parameter treated as JSON instance");
  checks.push({
    version: "2.0",
    name: "legacy formData file control",
    passed: true,
  });
  return {
    passed: true,
    checks,
    scope:
      "Boolean schema samples/references, branches, properties/arrays, explicit examples, worker clone and durable Git/preflight refusal. No native acceptance or full schema/dialect compliance.",
  };
}
