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

export function booleanSchemaEvidence() {
  const checks = /** @type {Record<string,any>[]} */ ([]);
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
  return {
    passed: true,
    checks,
    scope:
      "Boolean schema samples/references, branches, properties/arrays, explicit examples, worker clone and durable Git/preflight refusal. No native acceptance or full schema/dialect compliance.",
  };
}
