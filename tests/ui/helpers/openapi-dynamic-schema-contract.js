import { analyzeSpec, generateRequests } from "../../../src/lib/openapi.js";
import {
  encodeGitResource,
  decodeGitResource,
} from "../../../src/lib/git-resources.js";

const base = "https://schemas.example.test/";
const ref = (/** @type {string} */ uri) => ({ $ref: uri });
const text = (/** @type {string} */ value) => ({
  type: "string",
  default: value,
});

/** Reusable authored contexts, not pre-resolved expected graphs.
 * @param {string} version */
export function dynamicSchemaDocument(version) {
  const schemas = {
    Value: { $id: base + "value", $dynamicAnchor: "owned", ...text("base") },
    Static: { $id: base + "static", $anchor: "owned", ...text("static") },
    Reader: {
      $id: base + "reader",
      type: "object",
      properties: {
        owned: { $dynamicRef: base + "value#owned" },
        static: { $dynamicRef: base + "static#owned" },
        pointer: { $dynamicRef: base + "value#/" + "$defs/plain" },
        root: { $dynamicRef: base + "value" },
      },
    },
    A: {
      $id: base + "a",
      $dynamicAnchor: "owned",
      ...text("A"),
      $defs: { reader: ref(base + "reader") },
    },
    B: {
      $id: base + "b",
      $dynamicAnchor: "owned",
      ...text("B"),
      $defs: { reader: ref(base + "reader") },
    },
    Outer: {
      $id: base + "outer",
      $dynamicAnchor: "owned",
      ...text("outer"),
      $defs: { reader: ref(base + "a#/$defs/reader") },
    },
    Branch: {
      $id: base + "branch",
      type: "object",
      properties: {
        a: ref(base + "a#/$defs/reader"),
        b: ref(base + "b#/$defs/reader"),
        plain: ref(base + "reader"),
      },
    },
    Literal: {
      $id: base + "literal",
      type: "object",
      default: { $dynamicRef: "missing.json#literal", $ref: "literal" },
    },
  };
  Object.assign(schemas.Value, { $defs: { plain: text("pointer") } });
  const targets = [
    "a#/$defs/reader",
    "b#/$defs/reader",
    "reader",
    "outer#/$defs/reader",
    "branch",
    "literal",
  ];
  const paths = Object.fromEntries(
    targets.map((target, index) => [
      "/case-" + index,
      {
        post: {
          summary: target,
          operationId: "dynamic_" + index,
          requestBody: {
            content: { "application/json": { schema: ref(base + target) } },
          },
          responses: { 200: { description: "OK" } },
        },
      },
    ]),
  );
  return {
    openapi: version,
    info: { title: "Dynamic resource scope", version: "1" },
    servers: [{ url: "http://127.0.0.1:55555" }],
    components: { schemas },
    paths,
  };
}

export function dynamicSchemaEvidence() {
  const checks = /** @type {Record<string,any>[]} */ ([]);
  const expectedReader = (/** @type {string} */ owned) => ({
    owned,
    static: "static",
    pointer: "pointer",
    root: "base",
  });
  for (const version of ["3.1.0", "3.2.0", "3.2.1"]) {
    const document = dynamicSchemaDocument(version);
    const source = { fileName: "api.json", contents: JSON.stringify(document) };
    const original = JSON.stringify(source);
    const analysis = analyzeSpec(source);
    if (!analysis.valid) throw Error(JSON.stringify(analysis.diagnostics));
    const expected = [
      expectedReader("A"),
      expectedReader("B"),
      expectedReader("base"),
      expectedReader("outer"),
      {
        a: expectedReader("A"),
        b: expectedReader("B"),
        plain: expectedReader("base"),
      },
      { $dynamicRef: "missing.json#literal", $ref: "literal" },
    ];
    // Repeated generation and worker-style cloning must not share a selected scope.
    for (const [transport, current] of [
      ["direct", analysis],
      ["worker-clone", structuredClone(analysis)],
      ["repeat", analysis],
    ]) {
      const requests = generateRequests(
        /** @type {ReturnType<typeof analyzeSpec>} */ (current),
        "wrk_dynamic",
        "spc_dynamic",
      ).filter((r) => r._type === "request");
      if (requests.length !== expected.length)
        throw Error("Dynamic request count changed");
      for (const [index, request] of requests.entries()) {
        const wanted = JSON.stringify(expected[index], null, 2);
        if (request.body.text !== wanted || request._openapiIssues.length)
          throw Error(
            version +
              " " +
              transport +
              " " +
              index +
              ": " +
              JSON.stringify(request),
          );
        const encoded = encodeGitResource(request);
        if (
          decodeGitResource(encoded.path, encoded.content)?.body.text !== wanted
        )
          throw Error("Dynamic sample Git roundtrip changed");
        if (encoded.content.includes("__insomnium_literal_ref__"))
          throw Error("Private marker persisted");
        checks.push({
          version,
          transport,
          index,
          text: request.body.text,
          expected: wanted,
          passed: true,
        });
      }
    }
    if (
      JSON.stringify(source) !== original ||
      JSON.stringify(analysis.original) !== source.contents
    )
      throw Error("Authored dynamic schema changed");
    checks.push({ version, name: "source preserved", passed: true });
    const extra = structuredClone(document);
    Object.assign(extra.components.schemas, {
      Lexical: {
        $id: base + "lexical",
        $dynamicAnchor: "owned",
        ...text("lexical"),
        $defs: {
          Nested: { $id: base + "nested", ...ref(base + "reader") },
        },
      },
      Tree: {
        $id: base + "tree",
        $dynamicAnchor: "node",
        type: "object",
        properties: {
          kind: text("base"),
          children: {
            type: "array",
            maxItems: 1,
            items: { $dynamicRef: "#node" },
          },
        },
      },
      Extended: {
        $id: base + "extended",
        $dynamicAnchor: "node",
        ...ref(base + "tree"),
        properties: { kind: text("extended") },
      },
    });
    const media =
      extra.paths["/case-0"].post.requestBody.content["application/json"];
    for (const [name, target, expectedValue, files] of [
      ["lexical parent excluded", base + "nested", expectedReader("base"), []],
      [
        "recursive sibling extension",
        base + "extended",
        { kind: "extended", children: [{ kind: "extended", children: [] }] },
        [],
      ],
      [
        "attached schema scope",
        "attached.json",
        { owned: "attached" },
        [
          {
            name: "attached.json",
            contents: JSON.stringify({
              $id: base + "attached",
              $defs: {
                Value: { $dynamicAnchor: "owned", ...text("attached") },
                Reader: {
                  type: "object",
                  properties: { owned: { $dynamicRef: base + "value#owned" } },
                },
              },
              $ref: "#/$defs/Reader",
            }),
          },
        ],
      ],
    ]) {
      media.schema = ref(String(target));
      const current = analyzeSpec({ contents: JSON.stringify(extra), files });
      if (!current.valid)
        throw Error(String(name) + JSON.stringify(current.diagnostics));
      const request = generateRequests(
        structuredClone(current),
        "wrk_dynamic",
        "spc_dynamic",
      ).find((r) => r._type === "request");
      const wanted = JSON.stringify(expectedValue, null, 2);
      if (request?.body.text !== wanted || request._openapiIssues.length)
        throw Error(
          String(name) + " sample mismatch: " + JSON.stringify(request),
        );
      checks.push({
        version,
        name,
        text: request.body.text,
        expected: wanted,
        passed: true,
      });
    }
    for (const [name, value, message] of [
      ["missing", { $dynamicRef: "#missing" }, "Reference target is missing"],
      ["nonstring", { $dynamicRef: 42 }, "URI-reference string"],
      [
        "unknown dialect",
        {
          $schema: "https://schemas.example.test/unknown",
          $dynamicRef: "#missing",
        },
        "dialect is not supported",
      ],
    ]) {
      const invalid = structuredClone(document);
      invalid.paths["/case-0"].post.requestBody.content[
        "application/json"
      ].schema = /** @type {any} */ (value);
      const result = analyzeSpec({ contents: JSON.stringify(invalid) });
      if (
        result.valid ||
        !result.diagnostics.some((d) => d.message.includes(String(message)))
      )
        throw Error("Missing dynamic refusal: " + name);
      checks.push({ version, name, passed: true });
    }
  }
  return {
    passed: true,
    scope:
      "Authored dynamic reference targets, static fallbacks, outermost/branch/lexical scopes, recursion/siblings, attached resources, worker-style clone and source/Git preservation; no native acceptance or full instance validation.",
    checks,
  };
}
