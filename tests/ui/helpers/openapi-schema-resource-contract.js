import { analyzeSpec, generateRequests } from "../../../src/lib/openapi.js";
import {
  encodeGitResource,
  decodeGitResource,
} from "../../../src/lib/git-resources.js";

const base = "https://schemas.example.test";
const value = (text = "resolved") => ({ type: "string", default: text });
const ref = (/** @type {string} */ uri) => ({ $ref: uri });
const response = { 200: { description: "OK" } };

/** Shared authored static-resource fixture for saved browser/native scenarios.
 * @param {string} version @param {string} server */
export function schemaResourceDocument(version, server) {
  return {
    openapi: version,
    jsonSchemaDialect: version.startsWith("3.2.")
      ? "https://spec.openapis.org/oas/3.2/dialect/2026-02-26"
      : "https://spec.openapis.org/oas/3.1/dialect/2024-11-10",
    info: { title: "Owned schema resources", version: "1" },
    servers: [{ url: server }],
    components: {
      schemas: {
        Payload: {
          $id: "https://schemas.example.test/owned/root",
          type: "object",
          properties: {
            owned: ref("#value"),
            child: ref("child#value"),
            escaped: ref("#/$defs/a~1b"),
            named: ref("#/properties/$ref"),
            $ref: value("named property"),
          },
          $defs: {
            Value: { $anchor: "value", ...value() },
            Child: { $id: "child", $anchor: "value", ...value("nested") },
            "a/b": value("escaped"),
          },
        },
      },
    },
    paths: {
      "/schema": {
        post: {
          requestBody: {
            content: {
              "application/json": {
                schema: ref("https://schemas.example.test/owned/root"),
              },
            },
          },
          responses: response,
        },
      },
    },
  };
}

/** Actual browser module contract; no native IPC or remote schema fetching. */
export function schemaResourceEvidence() {
  const checks = /** @type {Record<string,any>[]} */ ([]);
  /** @param {string} version @param {Record<string,any>} schema @param {Record<string,any>} [components] @returns {Record<string,any>} */
  const make = (version, schema, components = {}) => ({
    openapi: version,
    info: { title: "Schema resources", version: "1" },
    servers: [{ url: "http://127.0.0.1:55555" }],
    components: { schemas: components },
    paths: {
      "/body": {
        post: {
          requestBody: { content: { "application/json": { schema } } },
          responses: response,
        },
      },
    },
  });
  /** @param {string} name @param {Record<string,any>} document @param {unknown} expected @param {{name:string,contents:string}[]} [files] */
  const verify = (name, document, expected, files = []) => {
    const source = {
      fileName: base + "/api.yaml",
      contents: JSON.stringify(document),
      files,
    };
    const before = JSON.stringify(source);
    const analysis = analyzeSpec(source);
    if (!analysis.valid)
      throw Error(name + ": " + JSON.stringify(analysis.diagnostics));
    const request = generateRequests(analysis, "wrk_owned", "spc_owned").find(
      (r) => r._type === "request",
    );
    const text = JSON.stringify(expected, null, 2);
    if (!request || request.body.text !== text)
      throw Error(name + " sample mismatch: " + request?.body.text);
    if (JSON.stringify(source) !== before)
      throw Error("Schema resource source changed");
    const encoded = encodeGitResource(request),
      restored = decodeGitResource(encoded.path, encoded.content);
    if (restored?.body.text !== text)
      throw Error("Schema resource Git text changed");
    checks.push({
      name,
      passed: true,
      text,
      sourceUnchanged: true,
      gitPreserved: true,
    });
  };
  /** @param {string} name @param {Record<string,any>} document @param {string} message */
  const refuse = (name, document, message) => {
    const source = {
        fileName: base + "/api.yaml",
        contents: JSON.stringify(document),
      },
      before = source.contents;
    const analysis = analyzeSpec(source),
      errors = analysis.diagnostics.filter((d) => d.severity === "error");
    if (
      analysis.valid ||
      !errors.some((d) => d.message.includes(message)) ||
      source.contents !== before
    )
      throw Error(name + " refusal mismatch: " + JSON.stringify(errors));
    checks.push({ name, passed: true, errors, sourceUnchanged: true });
  };
  for (const version of ["3.1.0", "3.2.0", "3.2.1"]) {
    const name = (/** @type {string} */ text) => version + " " + text;
    const declared = make(version, ref(base + "/root"), {
      Root: { $id: base + "/root", ...value("dialect") },
    });
    declared.jsonSchemaDialect = version.startsWith("3.2.")
      ? "https://spec.openapis.org/oas/3.2/dialect/2026-02-26"
      : "https://spec.openapis.org/oas/3.1/dialect/2024-11-10";
    verify(name("declared OAS dialect"), declared, "dialect");
    verify(
      name("declared JSON Schema dialect"),
      make(version, {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        $id: base + "/root",
        ...value("json-schema"),
      }),
      "json-schema",
    );
    verify(
      name("canonical resource"),
      make(version, ref(base + "/root"), {
        Root: { $id: base + "/root", ...value() },
      }),
      "resolved",
    );
    verify(
      name("document anchor"),
      make(version, ref("#owned"), { Value: { $anchor: "owned", ...value() } }),
      "resolved",
    );
    verify(
      name("nested relative resource"),
      make(version, ref(base + "/schemas/child#owned"), {
        Root: {
          $id: "schemas/root",
          $defs: {
            Child: { $id: "child", $anchor: "owned", ...value("nested") },
          },
        },
      }),
      "nested",
    );
    const external = {
      $id: base + "/attached",
      type: "object",
      properties: { owned: ref("#owned") },
      $defs: { Value: { $anchor: "owned", ...value("attached") } },
    };
    const files = [
      { name: "attached.json", contents: JSON.stringify(external) },
    ];
    verify(
      name("attached canonical resource"),
      make(version, ref(base + "/attached")),
      { owned: "attached" },
      files,
    );
    verify(
      name("attached retrieval alias"),
      make(version, ref("attached.json")),
      { owned: "attached" },
      files,
    );
    verify(
      name("recursive standalone resource"),
      make(version, ref(base + "/tree")),
      { owned: "recursive", next: { owned: "recursive", next: {} } },
      [
        {
          name: "tree.json",
          contents: JSON.stringify({
            $id: base + "/tree",
            type: "object",
            properties: { owned: value("recursive"), next: ref("#") },
          }),
        },
      ],
    );
    verify(
      name("relative inherited reference"),
      make(version, ref(base + "/schemas/root"), {
        Root: {
          $id: "schemas/root",
          type: "object",
          properties: { owned: ref("child#owned") },
          $defs: {
            Child: { $id: "child", $anchor: "owned", ...value("inherited") },
          },
        },
      }),
      { owned: "inherited" },
    );
    verify(
      name("percent encoded anchor"),
      make(version, ref(base + "/root#%6fwned"), {
        Root: {
          $id: base + "/root",
          $defs: { Value: { $anchor: "owned", ...value("percent") } },
        },
      }),
      "percent",
    );
    verify(
      name("escaped resource pointer"),
      make(version, ref(base + "/root#/$defs/a~1b"), {
        Root: { $id: base + "/root", $defs: { "a/b": value("escaped") } },
      }),
      "escaped",
    );
    verify(
      name("ref named property pointer"),
      make(version, ref(base + "/root#/properties/$ref"), {
        Root: {
          $id: base + "/root",
          type: "object",
          properties: { $ref: value("named") },
        },
      }),
      "named",
    );
    verify(
      name("resource scoped anchors"),
      make(
        version,
        {
          type: "object",
          properties: { a: ref(base + "/a#owned"), b: ref(base + "/b#owned") },
        },
        {
          A: { $id: base + "/a", $anchor: "owned", ...value("a") },
          B: { $id: base + "/b", $anchor: "owned", ...value("b") },
        },
      ),
      { a: "a", b: "b" },
    );
    verify(
      name("static dynamic anchor"),
      make(version, ref(base + "/root#owned"), {
        Root: {
          $id: base + "/root",
          $dynamicAnchor: "owned",
          ...value("static"),
        },
      }),
      "static",
    );
    const literal = {
      $id: base + "/root",
      $anchor: "owned",
      $ref: "literal.json",
    };
    const document = make(
      version,
      {},
      { Root: { $id: base + "/root", ...value() } },
    );
    document.paths["/body"].post.requestBody.content["application/json"] = {
      examples: {
        owned: version.startsWith("3.2.")
          ? { dataValue: literal }
          : { value: literal },
      },
    };
    verify(name("literal identifiers ignored"), document, literal);
    refuse(
      name("duplicate identifiers"),
      make(
        version,
        {},
        { A: { $id: base + "/same" }, B: { $id: base + "/same" } },
      ),
      "Ambiguous schema resource identity",
    );
    refuse(
      name("duplicate anchors"),
      make(version, {}, { A: { $anchor: "same" }, B: { $anchor: "same" } }),
      "Ambiguous schema resource identity",
    );
    refuse(
      name("nonempty id fragment"),
      make(version, { $id: base + "/root#bad" }),
      "non-empty fragment",
    );
    refuse(
      name("nonstring anchor"),
      make(version, { $anchor: 7 }),
      "valid plain-name",
    );
    refuse(
      name("invalid anchor name"),
      make(version, { $anchor: "7owned" }),
      "valid plain-name",
    );
    refuse(
      name("missing anchor"),
      make(version, ref("#absent")),
      "Reference target is missing",
    );
    refuse(
      name("inherited pointer"),
      make(version, ref("#/components/schemas/constructor")),
      "Reference target is missing",
    );
    refuse(
      name("missing dynamic target"),
      make(version, { $dynamicRef: "#owned" }),
      "Reference target is missing",
    );
    const booleanBody = make(version, {}, { False: false });
    booleanBody.paths["/body"].post.requestBody = ref(
      "#/components/schemas/False",
    );
    refuse(
      name("boolean target outside Schema Object"),
      booleanBody,
      "Reference target is missing",
    );
    refuse(
      name("unknown resource dialect"),
      make(version, {
        $schema: "https://unknown.example.test/dialect",
        $id: base + "/root",
      }),
      "dialect is not supported",
    );
    refuse(
      name("nonstring identifier"),
      make(version, { $id: 7 }),
      "URI-reference string",
    );
    refuse(
      name("document resource collision"),
      make(version, { $id: base + "/api.yaml" }),
      "Ambiguous schema resource identity",
    );
  }
  verify(
    "3.0.3 authored constructor property",
    make("3.0.3", ref("#/components/schemas/constructor"), {
      constructor: value("authored"),
    }),
    "authored",
  );
  refuse(
    "3.0.3 inherited pointer",
    make("3.0.3", ref("#/components/schemas/constructor")),
    "Reference target is missing",
  );
  return { passed: true, checks };
}
