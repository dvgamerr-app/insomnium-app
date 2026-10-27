import {
  exampleAssetIndex,
  addExampleAssets,
  externalExampleText,
} from "../../../src/lib/openapi-example-assets.js";
import { analyzeSpec, generateRequests } from "../../../src/lib/openapi.js";
import { prepareRenderedRequest } from "../../../src/lib/transport.js";
import {
  encodeGitResource,
  decodeGitResource,
} from "../../../src/lib/git-resources.js";
import { initialData } from "../../../src/lib/model.js";

export const externalUtf8Vectors = [
  { name: "unicode", bytes: new TextEncoder().encode('"é😀"'), valid: true },
  {
    name: "replacement codepoint",
    bytes: new TextEncoder().encode('"�"'),
    valid: true,
  },
  {
    name: "leading BOM",
    bytes: Uint8Array.from([239, 187, 191, 34, 111, 107, 34]),
    valid: true,
  },
  {
    name: "numeric lexical bytes",
    bytes: new TextEncoder().encode(' { "n": 9007199254740993 }\n'),
    valid: true,
  },
  {
    name: "invalid byte",
    bytes: Uint8Array.from([34, 255, 34]),
    valid: false,
  },
  {
    name: "overlong",
    bytes: Uint8Array.from([34, 192, 175, 34]),
    valid: false,
  },
  {
    name: "encoded surrogate",
    bytes: Uint8Array.from([34, 237, 160, 128, 34]),
    valid: false,
  },
  {
    name: "above Unicode range",
    bytes: Uint8Array.from([34, 244, 144, 128, 128, 34]),
    valid: false,
  },
  {
    name: "truncated sequence",
    bytes: Uint8Array.from([34, 226, 130, 34]),
    valid: false,
  },
  {
    name: "JSON syntax",
    bytes: new TextEncoder().encode('{ "n": }'),
    valid: false,
  },
];

/** Browser contract evidence; no HTTP requests or native IPC.
 * The native scenario separately tests actual attachment/download/worker/wire. */
export function externalContractEvidence() {
  const controls = [];
  const checks = [];
  const spec = { fileName: "api.yaml", contents: "", exampleFiles: [] };
  const file = { name: "bytes.bin", base64: "AP+A" };
  const refuse = (
    /** @type {string} */ name,
    /** @type {()=>unknown} */ run,
  ) => {
    let error = "";
    try {
      run();
    } catch (cause) {
      error = String(cause);
    }
    controls.push({ name, refused: !!error, error });
    if (!error) throw new Error("Expected refusal: " + name);
  };
  refuse("missing name", () =>
    exampleAssetIndex({ ...spec, exampleFiles: [{ base64: "" }] }),
  );
  refuse("malformed base64", () =>
    exampleAssetIndex({ ...spec, exampleFiles: [{ ...file, base64: "!" }] }),
  );
  refuse("noncanonical base64", () =>
    exampleAssetIndex({ ...spec, exampleFiles: [{ ...file, base64: "AA" }] }),
  );
  refuse("URI alias duplicate", () =>
    exampleAssetIndex({
      ...spec,
      exampleFiles: [file, { ...file, name: "./bytes.bin" }],
    }),
  );
  refuse("fragment name", () =>
    exampleAssetIndex({
      ...spec,
      exampleFiles: [{ ...file, name: "bytes.bin#part" }],
    }),
  );
  refuse("33 files", () =>
    exampleAssetIndex({
      ...spec,
      exampleFiles: Array.from({ length: 33 }, (_, i) => ({
        ...file,
        name: i + ".bin",
      })),
    }),
  );
  refuse("2MiB file", () =>
    exampleAssetIndex({
      ...spec,
      exampleFiles: [
        { ...file, base64: btoa("x".repeat(2 * 1024 * 1024 + 1)) },
      ],
    }),
  );
  refuse("combined8MiB", () =>
    exampleAssetIndex({
      ...spec,
      contents: "x".repeat(8 * 1024 * 1024),
      exampleFiles: [file],
    }),
  );
  const refreshed = addExampleAssets({ ...spec, exampleFiles: [file] }, [
    { ...file, name: "./bytes.bin", base64: "YQ==" },
  ]);
  if (refreshed.length !== 1 || refreshed[0].base64 !== "YQ==")
    throw new Error("Refresh URI ownership failed");
  controls.push({ name: "URI refresh", passed: true });
  const workspace = {
    _id: "wrk_external_contract",
    _type: "workspace",
    parentId: null,
    name: "Owned",
  };
  const literalValue = {
    examples: { literal: { externalValue: "literal.txt" } },
  };
  const literalDocument = {
    openapi: "3.2.1",
    info: { title: "Literal", version: "1" },
    paths: {
      "/body": {
        post: {
          requestBody: {
            content: {
              "application/json": {
                examples: { owned: { dataValue: literalValue } },
              },
            },
          },
          responses: { 200: { description: "OK" } },
        },
      },
    },
  };
  const literal = generateRequests(
    analyzeSpec({ contents: JSON.stringify(literalDocument) }),
    workspace._id,
    "spc_literal",
  ).find((r) => r._type === "request");
  if (
    !literal ||
    JSON.stringify(JSON.parse(literal.body.text)) !==
      JSON.stringify(literalValue)
  )
    throw new Error(
      "Literal example data was treated as an external Example Object",
    );
  controls.push({ name: "literal data examples keys", passed: true });
  const literalPayload = {
    examples: { owned: { externalValue: "literal.txt" } },
  };
  const preserve = (
    /** @type {string} */ name,
    /** @type {Record<string,any>} */ document,
    /** @type {(schema:Record<string,any>)=>unknown} */ read,
    /** @type {unknown} */ expected,
    /** @type {Record<string,any>[]} */ files = [],
  ) => {
    const analysis = analyzeSpec({
      ...spec,
      contents: JSON.stringify(document),
      files,
    });
    if (!analysis.valid)
      throw new Error(name + ": " + JSON.stringify(analysis.diagnostics));
    if (JSON.stringify(read(analysis.schema)) !== JSON.stringify(expected))
      throw new Error(name + ": literal contents were rewritten");
    controls.push({ name, passed: true });
  };
  const componentExtension = {
    ...literalDocument,
    components: { "x-literal": { nested: literalPayload } },
  };
  preserve(
    "component extension is literal",
    componentExtension,
    (s) => s.components["x-literal"].nested,
    literalPayload,
  );
  preserve(
    "Paths extension is literal",
    {
      ...literalDocument,
      paths: { ...literalDocument.paths, "x-literal": literalPayload },
    },
    (s) => s.paths["x-literal"],
    literalPayload,
  );
  preserve(
    "Link requestBody is literal",
    {
      ...literalDocument,
      components: {
        links: { owned: { operationId: "owned", requestBody: literalPayload } },
      },
    },
    (s) => s.components.links.owned.requestBody,
    literalPayload,
  );
  const itemSchemaDocument = /** @type {Record<string,any>} */ (
    structuredClone(literalDocument)
  );
  itemSchemaDocument.paths["/body"].post.requestBody.content = {
    "application/jsonl": {
      itemSchema: { type: "string", custom: literalPayload },
    },
  };
  preserve(
    "itemSchema custom vocabulary is literal",
    itemSchemaDocument,
    (s) =>
      s.paths["/body"].post.requestBody.content["application/jsonl"].itemSchema
        .custom,
    literalPayload,
  );
  const schemaDocument = /** @type {Record<string,any>} */ (
    structuredClone(literalDocument)
  );
  schemaDocument.paths["/body"].post.requestBody.content[
    "application/json"
  ].schema = { $ref: "refs/schema.json" };
  preserve(
    "standalone Schema custom vocabulary is literal",
    schemaDocument,
    (s) =>
      s.paths["/body"].post.requestBody.content["application/json"].schema
        .externalValue,
    "literal.txt",
    [
      {
        name: "refs/schema.json",
        contents: JSON.stringify({
          type: "object",
          externalValue: "literal.txt",
        }),
      },
    ],
  );
  const persistedSpec = {
    _id: "spc_external_assets",
    _type: "api_spec",
    parentId: workspace._id,
    contents: JSON.stringify(literalDocument),
    exampleFiles: [file],
  };
  const encodedSpec = encodeGitResource(persistedSpec);
  const restoredSpec = decodeGitResource(encodedSpec.path, encodedSpec.content);
  if (
    restoredSpec?.exampleFiles?.length !== 1 ||
    JSON.stringify(Object.keys(restoredSpec.exampleFiles[0]).sort()) !==
      JSON.stringify(Object.keys(file).sort()) ||
    Object.entries(file).some(
      ([key, value]) => restoredSpec.exampleFiles[0][key] !== value,
    )
  )
    throw new Error("Specification example assets changed in Git");
  controls.push({ name: "Specification assets Git roundtrip", passed: true });
  refuse("non UTF8 parameter text", () => externalExampleText(file));
  const missingDocument = /** @type {Record<string,any>} */ (
    structuredClone(literalDocument)
  );
  missingDocument.servers = [{ url: "http://127.0.0.1:55555" }];
  missingDocument.paths["/body"].post.requestBody.content[
    "application/json"
  ].examples = { owned: { externalValue: "missing.bin" } };
  const missing = generateRequests(
    analyzeSpec({ contents: JSON.stringify(missingDocument) }),
    workspace._id,
    "spc_missing_external",
  ).find((r) => r._type === "request");
  if (
    !missing?._openapiIssues?.some((/** @type {string} */ issue) =>
      issue.includes("Load external example"),
    )
  )
    throw new Error("Missing selected external example was silently sampled");
  controls.push({ name: "Missing selected body is reviewed", passed: true });
  missingDocument.paths["/body"].post.requestBody = undefined;
  missingDocument.paths["/body"].post.responses[200].content = {
    "application/octet-stream": {
      examples: { owned: { externalValue: "unselected.bin" } },
    },
  };
  const unused = generateRequests(
    analyzeSpec({ contents: JSON.stringify(missingDocument) }),
    workspace._id,
    "spc_unused_external",
  ).find((r) => r._type === "request");
  if (!unused || unused._openapiIssues?.length)
    throw new Error("Unused response example blocked request generation");
  controls.push({ name: "Unused response asset need not load", passed: true });
  const namedBody = /** @type {Record<string,any>} */ (
    structuredClone(missingDocument)
  );
  namedBody.components = {
    requestBodies: {
      "x-owned": {
        content: {
          "application/octet-stream": {
            examples: { owned: { externalValue: "bytes.bin" } },
          },
        },
      },
    },
  };
  namedBody.paths["/body"].post.requestBody = {
    $ref: "#/components/requestBodies/x-owned",
  };
  const namedRequest = generateRequests(
    analyzeSpec({
      ...spec,
      contents: JSON.stringify(namedBody),
      exampleFiles: [file],
    }),
    workspace._id,
    "spc_named_body",
  ).find((r) => r._type === "request");
  if (
    namedRequest?.body.base64 !== file.base64 ||
    namedRequest._openapiIssues?.length
  )
    throw new Error(
      "A component name beginning x- was treated as a specification extension",
    );
  controls.push({
    name: "x- component name preserves external bytes",
    passed: true,
  });
  for (const kind of ["requestBody", "pathItem", "parameter"]) {
    const document = /** @type {Record<string,any>} */ (
      structuredClone(literalDocument)
    );
    document.servers = [{ url: "http://127.0.0.1:55555" }];
    const body = {
      content: {
        "application/octet-stream": {
          examples: { owned: { externalValue: "../bytes.bin" } },
        },
      },
    };
    const operation = {
      post: { requestBody: body, responses: { 200: { description: "OK" } } },
    };
    const parameter = {
      name: "owned",
      in: "query",
      schema: { type: "string" },
      examples: { owned: { externalValue: "../query.txt" } },
    };
    const reference = { $ref: "refs/objects.yaml#/value" };
    if (kind === "requestBody")
      document.paths["/body"].post.requestBody = reference;
    else if (kind === "pathItem") document.paths["/body"] = reference;
    else
      document.paths["/body"] = {
        get: {
          parameters: [reference],
          responses: { 200: { description: "OK" } },
        },
      };
    const value =
      kind === "requestBody"
        ? body
        : kind === "pathItem"
          ? operation
          : parameter;
    const analysis = analyzeSpec({
      ...spec,
      contents: JSON.stringify(document),
      files: [
        { name: "refs/objects.yaml", contents: JSON.stringify({ value }) },
      ],
      exampleFiles: [
        file,
        { name: "query.txt", base64: btoa("owned=hello%20world") },
      ],
    });
    if (!analysis.valid)
      throw new Error(kind + ": " + JSON.stringify(analysis.diagnostics));
    const request = generateRequests(
      analysis,
      workspace._id,
      "spc_object_ref",
    ).find((r) => r._type === "request");
    if (
      !request ||
      request._openapiIssues?.length ||
      (kind === "parameter"
        ? request.parameters[0]?.value !== "owned=hello%20world"
        : request.body.base64 !== file.base64)
    )
      throw new Error(
        kind + ": structural reference lost external asset binding",
      );
    controls.push({
      name: kind + " JSON Pointer reference binds assets",
      passed: true,
    });
  }
  for (const kind of ["response header", "nested encoding header"]) {
    const document = /** @type {Record<string,any>} */ (
      structuredClone(literalDocument)
    );
    const header = {
      schema: { type: "string" },
      examples: { owned: { externalValue: "bytes.bin" } },
    };
    if (kind === "response header")
      document.paths["/body"].post.responses[200].headers = {
        "x-owned": header,
      };
    else
      document.paths["/body"].post.requestBody.content = {
        "multipart/mixed": {
          schema: { type: "array" },
          prefixEncoding: [
            { itemEncoding: { headers: { "x-owned": header } } },
          ],
        },
      };
    const analysis = analyzeSpec({
      ...spec,
      contents: JSON.stringify(document),
      exampleFiles: [file],
    });
    if (!analysis.valid)
      throw new Error(kind + ": " + JSON.stringify(analysis.diagnostics));
    const resolved =
      kind === "response header"
        ? analysis.schema.paths["/body"].post.responses[200].headers["x-owned"]
        : analysis.schema.paths["/body"].post.requestBody.content[
            "multipart/mixed"
          ].prefixEncoding[0].itemEncoding.headers["x-owned"];
    if (
      resolved.examples.owned["x-insomnium-resolved-example"]?.base64 !==
      file.base64
    )
      throw new Error(kind + ": Header asset not bound");
    controls.push({ name: kind + " preserves x- name", passed: true });
  }
  for (const [name, reference, components, files] of [
    [
      "component named value",
      "#/components/examples/value",
      { examples: { value: { externalValue: "bytes.bin" } } },
      [],
    ],
    [
      "root example document",
      "refs/root.yaml",
      {},
      [
        {
          name: "refs/root.yaml",
          contents: JSON.stringify({ externalValue: "../bytes.bin" }),
        },
      ],
    ],
    [
      "example pointer named value",
      "refs/examples.yaml#/value",
      {},
      [
        {
          name: "refs/examples.yaml",
          contents: JSON.stringify({
            value: { externalValue: "../bytes.bin" },
          }),
        },
      ],
    ],
    [
      "escaped example pointer",
      "refs/examples.yaml#/a~1b~0c",
      {},
      [
        {
          name: "refs/examples.yaml",
          contents: JSON.stringify({
            "a/b~c": { externalValue: "../bytes.bin" },
          }),
        },
      ],
    ],
    [
      "chained example pointer",
      "#/components/examples/example",
      { examples: { example: { $ref: "refs/examples.yaml#/value" } } },
      [
        {
          name: "refs/examples.yaml",
          contents: JSON.stringify({
            value: { externalValue: "../bytes.bin" },
          }),
        },
      ],
    ],
  ]) {
    const document = /** @type {Record<string,any>} */ (
      structuredClone(literalDocument)
    );
    document.servers = [{ url: "http://127.0.0.1:55555" }];
    document.components = components;
    document.paths["/body"].post.requestBody.content = {
      "application/octet-stream": { examples: { owned: { $ref: reference } } },
    };
    const analysis = analyzeSpec({
      ...spec,
      contents: JSON.stringify(document),
      files,
      exampleFiles: [file],
    });
    if (!analysis.valid)
      throw new Error(name + ": " + JSON.stringify(analysis.diagnostics));
    const request = generateRequests(
      analysis,
      workspace._id,
      "spc_external_ref",
    ).find((r) => r._type === "request");
    if (
      !request ||
      request.body.base64 !== file.base64 ||
      request._openapiIssues?.length
    )
      throw new Error(
        name +
          ": referenced external bytes missing: " +
          JSON.stringify(request),
      );
    controls.push({ name, passed: true });
  }
  for (const version of ["3.0.3", "3.1.0", "3.2.0", "3.2.1"]) {
    for (const [mime, base64] of [
      ["application/json", btoa(' {"number":9007199254740993}\n')],
      ["application/octet-stream", "AP+A"],
    ]) {
      const document = {
        openapi: version,
        info: { title: "External", version: "1" },
        servers: [{ url: "http://127.0.0.1:55555" }],
        paths: {
          "/body": {
            post: {
              requestBody: {
                content: {
                  [mime]: {
                    examples: { owned: { externalValue: "bytes.bin" } },
                  },
                },
              },
              responses: { 200: { description: "OK" } },
            },
          },
        },
      };
      const source = {
        ...spec,
        contents: JSON.stringify(document),
        exampleFiles: [{ ...file, base64 }],
      };
      const analysis = analyzeSpec(source);
      if (!analysis.valid)
        throw new Error(JSON.stringify(analysis.diagnostics));
      const generated = generateRequests(
        analysis,
        workspace._id,
        "spc_external_contract",
      );
      const request = generated.find((r) => r._type === "request");
      if (!request) throw new Error("Generated request missing");
      const prepared = prepareRenderedRequest(
        { ...initialData(), resources: [workspace, ...generated] },
        request,
        "external_contract",
      );
      const encoded = encodeGitResource(request);
      const restored = decodeGitResource(encoded.path, encoded.content);
      if (!restored) throw new Error("Git request missing");
      if (prepared.bodyBase64 !== base64 || restored.body.base64 !== base64)
        throw new Error("External bytes changed");
      if (
        JSON.parse(source.contents).paths["/body"].post.requestBody.content[
          mime
        ].examples.owned.externalValue !== "bytes.bin"
      )
        throw new Error("Original source changed");
      checks.push({
        version,
        mime,
        base64,
        transport: prepared.bodyBase64,
        git: restored.body.base64,
        originalUnchanged: true,
      });
    }
  }
  for (const version of ["3.2.0", "3.2.1"]) {
    for (const mode of [
      "absolute",
      "relative",
      "referenced",
      "referenced-relative",
    ]) {
      const retrieval = "https://retrieval.example/root/api.yaml";
      const rootBase =
        mode === "relative"
          ? "https://retrieval.example/canonical/api.yaml"
          : "https://canonical.example/root/api.yaml";
      const childBase =
        mode === "referenced-relative"
          ? "https://canonical.example/shared/defs.yaml"
          : "https://components.example/docs/defs.yaml";
      const referenced = mode.startsWith("referenced");
      const body = {
        content: {
          "application/octet-stream": {
            examples: { owned: { externalValue: "bytes.bin" } },
          },
        },
      };
      const document = {
        openapi: version,
        $self: mode === "relative" ? "../canonical/api.yaml" : rootBase,
        info: { title: "Declared base", version: "1" },
        servers: [{ url: "http://127.0.0.1:55555" }],
        paths: {
          "/body": {
            post: {
              requestBody: referenced
                ? { $ref: childBase + "#/components/requestBodies/Body" }
                : body,
              responses: { 200: { description: "OK" } },
            },
          },
        },
      };
      const child = {
        openapi: version,
        $self:
          mode === "referenced-relative" ? "../shared/defs.yaml" : childBase,
        info: { title: "Referenced base", version: "1" },
        components: { requestBodies: { Body: body } },
      };
      const source = {
        fileName: retrieval,
        contents: JSON.stringify(document),
        files: referenced
          ? [{ name: "defs.yaml", contents: JSON.stringify(child) }]
          : [],
        exampleFiles: [
          {
            name: new URL("bytes.bin", referenced ? childBase : rootBase).href,
            base64: "AP+A",
          },
          { name: new URL("bytes.bin", retrieval).href, base64: "d3Jvbmc=" },
        ],
      };
      const original = JSON.stringify(source);
      const analysis = analyzeSpec(source);
      if (!analysis.valid)
        throw Error(mode + ": " + JSON.stringify(analysis.diagnostics));
      const generated = generateRequests(analysis, workspace._id, "spc_self");
      const request = generated.find((r) => r._type === "request");
      if (
        !request ||
        request.body.base64 !== "AP+A" ||
        request._openapiIssues?.length
      )
        throw Error(mode + ": canonical bytes missing");
      const encoded = encodeGitResource(request),
        restored = decodeGitResource(encoded.path, encoded.content);
      const prepared = prepareRenderedRequest(
        { ...initialData(), resources: [workspace, ...generated] },
        request,
        "self_contract",
      );
      if (
        restored?.body.base64 !== "AP+A" ||
        prepared.bodyBase64 !== "AP+A" ||
        JSON.stringify(source) !== original
      )
        throw Error(mode + ": source/Git/transport changed");
      controls.push({
        name: version + " self base " + mode,
        passed: true,
        base: rootBase,
        childBase: referenced ? childBase : null,
        base64: request.body.base64,
        sourceUnchanged: true,
      });
    }
    const collisionRoot = {
      openapi: version,
      $self: "https://canonical.example/api.yaml",
      info: { title: "Collision", version: "1" },
      paths: {},
    };
    refuse(version + " duplicate declared document identities", () =>
      analyzeSpec({
        contents: JSON.stringify(collisionRoot),
        files: [{ name: "defs.yaml", contents: JSON.stringify(collisionRoot) }],
      }),
    );
    const relativeSource = {
      contents: JSON.stringify({
        ...collisionRoot,
        $self: "https://canonical.example/docs/api.yaml",
      }),
      exampleFiles: [{ name: "bytes.bin", base64: "YQ==" }],
    };
    const updated = addExampleAssets(relativeSource, [
      { name: "https://canonical.example/docs/bytes.bin", base64: "Yg==" },
    ]);
    if (updated.length !== 1 || updated[0].base64 !== "Yg==")
      throw Error("Declared-base refresh duplicated asset");
    controls.push({ name: version + " self asset refresh", passed: true });
  }
  const incomplete = { fileName: "api.yaml", contents: "{", exampleFiles: [] };
  const attached = addExampleAssets(incomplete, [
    { name: "bytes.bin", base64: "AP+A" },
  ]);
  if (
    attached.length !== 1 ||
    attached[0].base64 !== "AP+A" ||
    incomplete.contents !== "{"
  )
    throw Error("Incomplete-source attachment changed");
  controls.push({ name: "attach while repairing source", passed: true });
  const literalSelf = exampleAssetIndex({
    fileName: "api.yaml",
    contents: JSON.stringify({ $self: "https://literal.example/" }),
    exampleFiles: [{ name: "bytes.bin", base64: "AP+A" }],
  });
  if (!literalSelf.has("memory:///bytes.bin"))
    throw Error("Non-OpenAPI self field changed asset identity");
  controls.push({ name: "literal self outside OpenAPI Object", passed: true });
  for (const version of ["3.0.3", "3.1.0", "3.2.0", "3.2.1"]) {
    const payload = Object.fromEntries([
      ["10", "numeric"],
      ["before", 1],
      ["$ref", "unattached.json#/literal"],
      ["after", { $ref: "#/components/schemas/Payload", falseValue: false }],
      ["__proto__", { $ref: 44 }],
      ["__insomnium_literal_ref__", "authored marker name"],
    ]);
    const declared = {
      type: "object",
      properties: {
        $ref: { type: "string", default: "named property" },
        keep: { type: "boolean", default: false },
      },
    };
    for (const mode of ["example", "default", "schema-ref", "property-ref"]) {
      const media =
        mode === "example"
          ? {
              examples: {
                owned: version.startsWith("3.2.")
                  ? { dataValue: payload }
                  : { value: payload },
              },
            }
          : mode === "default"
            ? { schema: { type: "object", default: payload } }
            : {
                schema: {
                  $ref:
                    mode === "schema-ref"
                      ? "#/components/schemas/Payload"
                      : "#/components/schemas/Payload/properties/$ref",
                },
              };
      const document = {
        openapi: version,
        info: { title: "Literal reference roles", version: "1" },
        servers: [{ url: "http://127.0.0.1:55555" }],
        components: { schemas: { Payload: declared }, "x-literal": payload },
        paths: {
          "/body": {
            post: {
              requestBody: { content: { "application/json": media } },
              responses: { 200: { description: "OK" } },
            },
          },
          "x-literal": payload,
        },
      };
      const source = { contents: JSON.stringify(document) };
      const original = JSON.stringify(source);
      const analysis = analyzeSpec(source);
      if (!analysis.valid)
        throw Error(
          mode + " " + version + ": " + JSON.stringify(analysis.diagnostics),
        );
      const generated = generateRequests(
        analysis,
        workspace._id,
        "spc_literal_ref",
      );
      const request = generated.find((r) => r._type === "request");
      const expected =
        mode === "schema-ref"
          ? { $ref: "named property", keep: false }
          : mode === "property-ref"
            ? "named property"
            : payload;
      if (!request || request.body.text !== JSON.stringify(expected, null, 2))
        throw Error(
          mode +
            " literal/member order changed: " +
            JSON.stringify(request?.body),
        );
      if (
        JSON.stringify(analysis.schema.components["x-literal"]) !==
          JSON.stringify(payload) ||
        JSON.stringify(analysis.schema.paths["x-literal"]) !==
          JSON.stringify(payload) ||
        JSON.stringify(source) !== original
      )
        throw Error("Literal extensions/source changed");
      const file = encodeGitResource(request),
        restored = decodeGitResource(file.path, file.content);
      if (restored?.body.text !== request.body.text)
        throw Error("Literal reference Git body changed");
      controls.push({
        name: version + " literal reference " + mode,
        passed: true,
        text: request.body.text,
        sourceUnchanged: true,
      });
    }
  }
  for (const version of ["3.0.3", "3.1.0", "3.2.0", "3.2.1"]) {
    const text = [
      "openapi: " + version,
      "info: {title: Alias roles, version: '1'}",
      "servers: [{url: 'http://127.0.0.1:55555'}]",
      "components:",
      "  schemas:",
      "    Actual: {type: object, properties: {x: {type: string, default: resolved}}}",
      "    Template: &target",
      "      $ref: '#/components/schemas/Actual'",
      "paths:",
      "  /body:",
      "    post:",
      "      requestBody:",
      "        content:",
      "          application/json:",
      "            examples:",
      "              owned:",
      "                " +
        (version.startsWith("3.2.") ? "dataValue" : "value") +
        ": *target",
      "      responses: {'200': {description: OK}}",
      "  /real:",
      "    post:",
      "      requestBody:",
      "        content:",
      "          application/json:",
      "            schema: {$ref: '#/components/schemas/Template'}",
      "      responses: {'200': {description: OK}}",
    ].join("\n");
    const source = { contents: text };
    const analysis = analyzeSpec(source);
    if (!analysis.valid)
      throw Error(
        version + " alias roles: " + JSON.stringify(analysis.diagnostics),
      );
    const requests = generateRequests(
      analysis,
      workspace._id,
      "spc_alias",
    ).filter((r) => r._type === "request");
    const literal = requests.find((r) => r.sourceOperation.path === "/body"),
      real = requests.find((r) => r.sourceOperation.path === "/real");
    if (
      literal?.body.text !==
        JSON.stringify({ $ref: "#/components/schemas/Actual" }, null, 2) ||
      real?.body.text !== JSON.stringify({ x: "resolved" }, null, 2) ||
      source.contents !== text
    )
      throw Error("YAML literal/Schema alias roles mixed");
    controls.push({
      name: version + " YAML alias reference roles",
      passed: true,
      literal: literal.body.text,
      real: real.body.text,
      sourceUnchanged: true,
    });
  }
  for (const version of ["3.0.3", "3.1.0", "3.2.0", "3.2.1"]) {
    const document = {
      openapi: version,
      info: { title: "Missing reference target", version: "1" },
      components: {
        schemas: {
          Payload: { type: "object", properties: { $ref: { type: "string" } } },
        },
      },
      paths: {
        "/body": {
          post: {
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Payload/properties/$ref/absent",
                  },
                },
              },
            },
            responses: { 200: { description: "OK" } },
          },
        },
      },
    };
    const analysis = analyzeSpec({ contents: JSON.stringify(document) });
    const errors = analysis.diagnostics.filter((d) => d.severity === "error");
    if (
      analysis.valid ||
      !errors.length ||
      errors.some((d) => d.message.includes("__insomnium_literal_ref__"))
    )
      throw Error("Missing target/private marker diagnostic changed");
    controls.push({
      name: version + " missing target behind ref-named property",
      passed: true,
      errors,
    });
  }
  for (const version of ["3.0.3", "3.0.4", "3.1.2", "3.2.0", "3.2.1"]) {
    const operation = (
      /** @type {string} */ name,
      /** @type {string} */ externalValue,
    ) => ({
      operationId: name,
      requestBody: {
        content: {
          "application/octet-stream": {
            examples: { owned: { externalValue } },
          },
        },
      },
      responses: { 200: { description: "OK" } },
    });
    const pathItem = {
      $ref: "refs/item.yaml#/value",
      put: operation("fromSibling", "main.bin"),
    };
    const document = {
      openapi: version,
      info: { title: "Owned sibling references", version: "1" },
      servers: [{ url: "http://127.0.0.1:55555" }],
      paths: { "/owned": pathItem },
    };
    const source = {
      fileName: "api.yaml",
      contents: JSON.stringify(document),
      files: [
        {
          name: "refs/item.yaml",
          contents: JSON.stringify({
            value: { post: operation("fromRef", "../ref.bin") },
          }),
        },
      ],
      exampleFiles: [
        { name: "main.bin", base64: btoa("from-main") },
        { name: "ref.bin", base64: btoa("from-ref") },
      ],
    };
    for (const location of version.startsWith("3.0.")
      ? ["paths"]
      : ["paths", "components"]) {
      const candidate = /** @type {Record<string,any>} */ (
        structuredClone(document)
      );
      if (location === "components") {
        candidate.components = {
          pathItems: { Owned: candidate.paths["/owned"] },
        };
        candidate.paths["/owned"] = { $ref: "#/components/pathItems/Owned" };
      }
      const input = { ...source, contents: JSON.stringify(candidate) };
      const analysis = analyzeSpec(input);
      if (!analysis.valid)
        throw Error(
          version + " " + location + JSON.stringify(analysis.diagnostics),
        );
      const generated = generateRequests(
        analysis,
        workspace._id,
        "spc_pathitem_sibling",
      );
      const requests = generated.filter((r) => r._type === "request");
      if (requests.length !== 2)
        throw Error("Disjoint Path Item operations were lost");
      for (const [name, text] of [
        ["fromSibling", "from-main"],
        ["fromRef", "from-ref"],
      ]) {
        const request = requests.find((r) => r.name === name);
        if (
          !request ||
          request._openapiIssues?.length ||
          request.body.base64 !== btoa(text)
        )
          throw Error("Path Item asset base changed: " + name);
        const prepared = prepareRenderedRequest(
          { ...initialData(), resources: [workspace, ...generated] },
          request,
          "pathitem_contract",
        );
        if (prepared.bodyBase64 !== btoa(text))
          throw Error("Prepared Path Item bytes changed: " + name);
      }
      if (input.contents !== JSON.stringify(candidate))
        throw Error("Source document mutated");
      controls.push({
        name:
          version +
          " " +
          location +
          " disjoint Path Item siblings preserve lexical assets",
        passed: true,
      });
    }
    for (const invalid of [
      "ref type",
      "unknown field",
      "operation type",
      "reference object",
    ]) {
      const candidate = /** @type {Record<string,any>} */ (
        structuredClone(document)
      );
      const item = candidate.paths["/owned"];
      if (invalid === "ref type") item.$ref = 42;
      if (invalid === "unknown field") item.unknownOwnedField = true;
      if (invalid === "operation type") item.put.parameters = 42;
      if (invalid === "reference object")
        item.put.requestBody = {
          $ref: "#/components/requestBodies/Body",
          put: operation("notPathItem", "main.bin"),
        };
      const analysis = analyzeSpec({
        ...source,
        contents: JSON.stringify(candidate),
      });
      if (
        analysis.valid ||
        !analysis.diagnostics.some((d) => d.severity === "error")
      )
        throw Error(
          "Path Item compatibility weakened " + invalid + " " + version,
        );
      controls.push({
        name: version + " Path Item retains guard: " + invalid,
        passed: true,
      });
    }
    const missing = analyzeSpec({
      ...source,
      exampleFiles: source.exampleFiles.filter((f) => f.name !== "main.bin"),
    });
    if (!missing.valid)
      throw Error("Missing asset should stay a request review gate");
    const request = generateRequests(
      missing,
      workspace._id,
      "spc_pathitem_missing",
    ).find((r) => r._type === "request" && r.name === "fromSibling");
    if (
      !request?._openapiIssues?.length ||
      request.body.base64 === btoa("from-ref")
    )
      throw Error("Missing local asset inherited reference bytes");
    controls.push({
      name: version + " missing sibling asset stays review-only",
      passed: true,
    });
  }

  for (const version of ["3.0.3", "3.1.2", "3.2.1"]) {
    for (const declared of [false, true])
      for (const entry of externalUtf8Vectors) {
        const base64 = btoa(String.fromCharCode(...entry.bytes));
        const media = {
          ...(declared ? { schema: {} } : {}),
          examples: { owned: { externalValue: "raw.json" } },
        };
        const document = {
          openapi: version,
          info: { title: "External JSON bytes", version: "1" },
          servers: [{ url: "http://127.0.0.1:55555" }],
          paths: {
            "/json": {
              post: {
                requestBody: { content: { "application/json": media } },
                responses: { 200: { description: "OK" } },
              },
            },
          },
        };
        const source = {
            contents: JSON.stringify(document),
            exampleFiles: [{ name: "raw.json", base64 }],
          },
          before = JSON.stringify(source),
          analysis = analyzeSpec(source);
        if (!analysis.valid)
          throw Error(
            "UTF8 source invalid " + JSON.stringify(analysis.diagnostics),
          );
        const generated = generateRequests(analysis, workspace._id, "spc_utf8"),
          request = generated.find((r) => r._type === "request");
        if (!request || JSON.stringify(source) !== before)
          throw Error("UTF8 source mutated");
        if (entry.valid) {
          if (request._openapiIssues.length || request.body.base64 !== base64)
            throw Error("Valid external UTF8 bytes changed: " + entry.name);
          const prepared = prepareRenderedRequest(
            { ...initialData(), resources: [workspace, ...generated] },
            request,
            "utf8_contract",
          );
          if (prepared.bodyBase64 !== base64)
            throw Error("Valid external UTF8 composer changed");
        } else {
          if (
            !request._openapiSchemaIssues?.some((/** @type {string} */ i) =>
              i.includes("External JSON example requires valid UTF-8 JSON:"),
            )
          )
            throw Error("Malformed external JSON has no durable review");
          const encoded = encodeGitResource({ ...request, _openapiIssues: [] }),
            restored = decodeGitResource(encoded.path, encoded.content);
          if (!restored) throw Error("UTF8 Git request missing");
          let refused = false;
          try {
            prepareRenderedRequest(
              { ...initialData(), resources: [workspace, ...generated] },
              restored,
              "utf8_contract",
            );
          } catch (error) {
            refused = String(error).includes(
              "External JSON example requires valid UTF-8 JSON:",
            );
          }
          if (!refused)
            throw Error("Malformed external JSON became sendable through Git");
        }
        controls.push({
          name:
            version +
            " " +
            (declared ? "schema" : "no schema") +
            " external JSON " +
            entry.name,
          passed: true,
        });
      }
    const base64 = btoa(String.fromCharCode(34, 255, 34));
    const document = {
      openapi: version,
      info: { title: "Binary byte control", version: "1" },
      servers: [{ url: "http://127.0.0.1:55555" }],
      paths: {
        "/binary": {
          post: {
            requestBody: {
              content: {
                "application/octet-stream": {
                  examples: { owned: { externalValue: "raw.bin" } },
                },
              },
            },
            responses: { 200: { description: "OK" } },
          },
        },
      },
    };
    const analysis = analyzeSpec({
        contents: JSON.stringify(document),
        exampleFiles: [{ name: "raw.bin", base64 }],
      }),
      request = generateRequests(
        analysis,
        workspace._id,
        "spc_utf8_binary",
      ).find((r) => r._type === "request");
    if (
      !analysis.valid ||
      !request ||
      request._openapiIssues.length ||
      request.body.base64 !== base64
    )
      throw Error("Opaque binary bytes were decoded as JSON");
    controls.push({
      name: version + " opaque binary preserves invalid UTF8 bytes",
      passed: true,
    });
  }
  for (const version of ["2.0", "3.0.3", "3.0.4", "3.1.2", "3.2.0", "3.2.1"]) {
    const swagger = version === "2.0",
      modern = /^3\.[12]\./.test(version);
    const document = referenceObjectDocument(version);
    const contents = JSON.stringify(document),
      analysis = analyzeSpec({ contents });
    if (!analysis.valid)
      throw Error(
        version + " reference roles: " + JSON.stringify(analysis.diagnostics),
      );
    if (
      JSON.stringify(analysis.original) !== contents ||
      JSON.stringify(analysis.schema).includes("__insomnium_literal_ref__")
    )
      throw Error("Reference roles changed source or leaked private fields");
    const resolved = swagger ? analysis.schema : analysis.schema.components;
    const ownedParameter = analysis.schema.paths["/owned"].post.parameters[0];
    const ownedResponse = analysis.schema.paths["/owned"].post.responses[200];
    const desc = modern ? "local" : "base";
    for (const [name, passed] of [
      [
        "parameter",
        ownedParameter.name === "owned" &&
          ownedParameter.description === desc &&
          !Object.hasOwn(ownedParameter, "summary"),
      ],
      [
        "response",
        ownedResponse.description === desc &&
          !Object.hasOwn(ownedResponse, "summary") &&
          !Object.hasOwn(ownedResponse.headers || {}, "broken"),
      ],
      ...(!swagger
        ? [
            [
              "header",
              resolved.headers.Owned.schema.type === "integer" &&
                resolved.headers.Owned.description === desc &&
                !Object.hasOwn(resolved.headers.Owned, "summary"),
            ],
            [
              "request body",
              Object.hasOwn(
                resolved.requestBodies.Owned.content,
                "application/json",
              ) &&
                !Object.hasOwn(
                  resolved.requestBodies.Owned.content,
                  "text/plain",
                ) &&
                resolved.requestBodies.Owned.description === desc,
            ],
            [
              "example",
              resolved.examples.Owned.value.source === "owned" &&
                !Object.hasOwn(resolved.examples.Owned, "externalValue") &&
                resolved.examples.Owned.summary === desc &&
                resolved.examples.Owned.description === desc,
            ],
            [
              "link",
              resolved.links.Owned.operationId === "owned" &&
                !Object.hasOwn(resolved.links.Owned, "requestBody") &&
                !Object.hasOwn(resolved.links.Owned, "summary") &&
                resolved.links.Owned.description === desc,
            ],
            [
              "security scheme",
              resolved.securitySchemes.Owned.type === "apiKey" &&
                resolved.securitySchemes.Owned.name === "X-Owned" &&
                !Object.hasOwn(resolved.securitySchemes.Owned, "scheme") &&
                resolved.securitySchemes.Owned.description === desc,
            ],
            [
              "callback",
              Object.keys(resolved.callbacks.Owned).length === 1 &&
                Object.hasOwn(
                  resolved.callbacks.Owned,
                  "{$request.query.callback}",
                ),
            ],
          ]
        : []),
    ]) {
      if (!passed)
        throw Error(version + " Reference Object role changed: " + name);
      controls.push({
        name: version + " reference role " + name,
        passed: true,
      });
    }
    if (modern) {
      for (const [group, field] of [
        ["parameters", "description"],
        ["examples", "summary"],
        ["parameters", "$ref"],
      ]) {
        const invalid = referenceObjectDocument(version);
        invalid.components[group].Owned[field] = 7;
        const rejected = analyzeSpec({ contents: JSON.stringify(invalid) });
        if (
          rejected.valid ||
          !rejected.diagnostics.some(
            (d) => d.severity === "error" && d.path.includes(group + "/Owned"),
          )
        )
          throw Error(
            "Malformed Reference Object fixed field accepted: " +
              group +
              "/" +
              field,
          );
        controls.push({
          name: version + " reference fixed-field type " + group + "/" + field,
          passed: true,
        });
      }
    }
    for (const [transport, current] of [
      ["direct", analysis],
      ["worker-clone", structuredClone(analysis)],
    ]) {
      const requests = generateRequests(
        /** @type {ReturnType<typeof analyzeSpec>} */ (current),
        workspace._id,
        "spc_reference_roles",
      );
      const request = requests.find(
        (r) => r._type === "request" && r.name === "owned",
      );
      const detached = requests.find(
        (r) => r._type === "request" && r.name === "detached",
      );
      if (
        !request ||
        request.parameters[0].name !== "owned" ||
        request.parameters[0].value !== "correct" ||
        request._openapiSchemaIssues?.length ||
        (!swagger &&
          request.body.text !== JSON.stringify({ source: "owned" }, null, 2))
      )
        throw Error(
          "Ignored Reference Object fields changed generated request",
        );
      if (
        !detached ||
        detached.parameters[0].name !== "nested" ||
        detached.parameters[0].value !== "nestedvalue"
      )
        throw Error("Pointer into ignored Reference Object field lost target");
      controls.push({
        name: version + " reference roles generation/pointer " + transport,
        passed: true,
      });
    }
  }
  return { passed: true, checks, controls };
}

/** Shared source/producer/native Reference Object contract. @param {string} version */
export function referenceObjectDocument(version) {
  const swagger = version === "2.0";
  const nested = swagger
    ? { name: "nested", in: "query", type: "string", default: "nestedvalue" }
    : {
        name: "nested",
        in: "query",
        schema: { $ref: "#/components/schemas/Detached" },
      };
  const parameter = swagger
    ? {
        name: "owned",
        in: "query",
        type: "string",
        default: "correct",
        description: "base",
      }
    : {
        name: "owned",
        in: "query",
        schema: { type: "string", default: "correct" },
        description: "base",
      };
  const prefix = swagger ? "#/" : "#/components/";
  const reference = (
    /** @type {string} */ group,
    /** @type {string} */ name,
  ) => ({ $ref: prefix + group + "/" + name });
  const parameters = {
    Base: parameter,
    Owned: {
      ...reference("parameters", "Base"),
      name: "wrong",
      description: "local",
      summary: "unsupported",
      schema: { $ref: "missing.json#/No", "x-detached": nested },
    },
  };
  const operation = /** @type {Record<string,any>} */ ({
    operationId: "owned",
    parameters: [reference("parameters", "Owned")],
    responses: { 200: reference("responses", "Owned") },
  });
  const document = /** @type {Record<string,any>} */ ({
    info: { title: "Reference roles", version: "1" },
    paths: {
      "/owned": { post: operation },
      "/detached": {
        get: {
          operationId: "detached",
          parameters: [{ $ref: prefix + "parameters/Owned/schema/x-detached" }],
          responses: { 200: { description: "OK" } },
        },
      },
    },
    ...(swagger
      ? {
          swagger: version,
          host: "127.0.0.1:55555",
          schemes: ["http"],
          parameters,
        }
      : {
          openapi: version,
          servers: [{ url: "http://127.0.0.1:55555" }],
          components: { parameters },
        }),
  });
  const responses = {
    Base: { description: "base" },
    Owned: {
      ...reference("responses", "Base"),
      description: "local",
      summary: "unsupported",
      headers: { broken: { schema: { $ref: "missing.json#/No" } } },
    },
  };
  if (swagger) {
    // Swagger's reusable maps contain concrete Objects; references occupy
    // operation positions, unlike OAS 3 Components maps.
    document.parameters = { Base: parameter };
    document.responses = { Base: responses.Base };
    operation.parameters = [parameters.Owned];
    operation.responses[200] = responses.Owned;
    document.paths["/detached"].get.parameters[0].$ref =
      "#/paths/~1owned/post/parameters/0/schema/x-detached";
  } else {
    const components = document.components;
    Object.assign(components, {
      schemas: { Detached: { type: "string", default: "nestedvalue" } },
      responses,
      headers: {
        Base: {
          schema: { type: "integer", default: 9 },
          description: "base",
        },
        Owned: {
          ...reference("headers", "Base"),
          schema: { $ref: "missing.json#/No" },
          description: "local",
          summary: "unsupported",
        },
      },
      examples: {
        Base: {
          value: { source: "owned" },
          summary: "base",
          description: "base",
        },
        Owned: {
          ...reference("examples", "Base"),
          value: { source: "wrong" },
          externalValue: "missing.json",
          summary: "local",
          description: "local",
        },
      },
      requestBodies: {
        Base: {
          description: "base",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { source: { type: "string" } },
                required: ["source"],
              },
              examples: { owned: reference("examples", "Owned") },
            },
          },
        },
        Owned: {
          ...reference("requestBodies", "Base"),
          description: "local",
          summary: "unsupported",
          content: { "text/plain": { schema: { $ref: "missing.json#/No" } } },
        },
      },
      links: {
        Base: { operationId: "owned", description: "base" },
        Owned: {
          ...reference("links", "Base"),
          operationId: "wrong",
          requestBody: { $ref: "missing.json#/No" },
          description: "local",
          summary: "unsupported",
        },
      },
      securitySchemes: {
        Base: {
          type: "apiKey",
          name: "X-Owned",
          in: "header",
          description: "base",
        },
        Owned: {
          ...reference("securitySchemes", "Base"),
          type: "http",
          scheme: "basic",
          description: "local",
          summary: "unsupported",
        },
      },
      callbacks: {
        Base: {
          "{$request.query.callback}": {
            post: { responses: { 200: { description: "OK" } } },
          },
        },
        Owned: {
          ...reference("callbacks", "Base"),
          summary: "unsupported",
          description: "unsupported",
          post: {
            requestBody: {
              content: {
                "application/json": { schema: { $ref: "missing.json#/No" } },
              },
            },
          },
        },
      },
    });
    components.responses.Base.headers = {
      owned: reference("headers", "Owned"),
    };
    components.responses.Base.links = { owned: reference("links", "Owned") };
    operation.requestBody = reference("requestBodies", "Owned");
    operation.callbacks = { owned: reference("callbacks", "Owned") };
    operation.security = [{ Owned: [] }];
  }
  return document;
}
