import { analyzeSpec, generateRequests } from "../../../src/lib/openapi.js";
import { prepareRenderedRequest } from "../../../src/lib/transport.js";
import { initialData } from "../../../src/lib/model.js";
import {
  encodeGitResource,
  decodeGitResource,
} from "../../../src/lib/git-resources.js";
import { serializedExampleCases } from "./openapi-serialized-example-cases.js";

export const namedBodyText = ' { "number":9007199254740993 }\n';
/** Git canonicalizes object member order; compare values recursively, preserving arrays.
 * @param {any} value @returns {any} */
function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, ordered(value[key])]),
    );
  return value;
}
/** @param {string} version @param {string} base */
export function namedExampleDocument(version, base) {
  /** @param {any} item */
  const value = (item) =>
    version.startsWith("3.2.") ? { dataValue: item } : { value: item };
  /** @param {any} first @param {any} second */
  const names = (first, second) => ({
    first: value(first),
    second: value(second),
  });
  const response = { 200: { description: "OK" } };
  return {
    openapi: version,
    info: { title: "Named examples", version: "1" },
    servers: [{ url: base }],
    components: {
      parameters: {
        Q: {
          name: "q",
          in: "query",
          schema: { type: "string" },
          examples: names("first", "selected"),
        },
      },
    },
    paths: {
      "/choice/{slug}": {
        parameters: [
          {
            name: "slug",
            in: "path",
            required: true,
            schema: { type: "string" },
            examples: names("first", "picked"),
          },
          { $ref: "#/components/parameters/Q" },
          {
            name: "x-mode",
            in: "header",
            schema: { type: "string" },
            examples: names("inherited", "wrong"),
          },
        ],
        get: {
          parameters: [
            {
              name: "X-Mode",
              in: "header",
              schema: { type: "string" },
              examples: names("first", "picked header"),
            },
            {
              name: "c",
              in: "cookie",
              schema: { type: "string" },
              examples: names("first", "kept"),
            },
          ],
          responses: response,
        },
      },
      "/isolate": {
        get: {
          parameters: [{ $ref: "#/components/parameters/Q" }],
          responses: response,
        },
      },
      "/body": {
        post: {
          requestBody: {
            content: {
              "application/json": {
                examples: {
                  first: value("first"),
                  second: { externalValue: "body.json" },
                },
              },
              "text/plain": {
                schema: { type: "string" },
                examples: Object.fromEntries([
                  ["first", value("first")],
                  ["second", value("plain second")],
                  ["", value("empty name")],
                  ["__proto__", value("prototype name")],
                  ["10", value("numeric name")],
                ]),
              },
            },
          },
          responses: response,
        },
      },
      "/content": {
        get: {
          parameters: [
            {
              name: "j",
              in: "query",
              ...(version.startsWith("3.2.")
                ? {
                    examples: {
                      first: { dataValue: false },
                      second: { dataValue: false },
                    },
                  }
                : {}),
              content: {
                "application/json": {
                  schema: { type: "boolean" },
                  examples: names(false, true),
                },
              },
            },
          ],
          responses: response,
        },
      },
    },
  };
}

/** Independent expected destinations/bytes; the native case separately uses UI/IPC.
 * @returns {{passed:boolean,checks:Record<string,any>[],controls:Record<string,any>[]}} */
export function namedExampleEvidence() {
  /** @type {Record<string,any>[]} */
  const checks = [];
  /** @type {Record<string,any>[]} */
  const controls = [];
  /** @param {string} name @param {any} actual @param {any} expected */
  const check = (name, actual, expected) => {
    if (JSON.stringify(ordered(actual)) !== JSON.stringify(ordered(expected)))
      throw Error(name + ": " + JSON.stringify({ actual, expected }));
    checks.push({ name, actual, expected, passed: true });
  };
  /** @param {string} name @param {()=>any} run @param {RegExp} [expected] */
  const refused = (name, run, expected = /Saved choice is unavailable/) => {
    let error = "";
    try {
      run();
    } catch (cause) {
      error = String(cause);
    }
    if (!error) throw Error("Expected refusal: " + name);
    if (!expected.test(error))
      throw Error("Unexpected refusal: " + name + ": " + error);
    controls.push({ name, error, passed: true });
  };
  for (const version of ["3.0.3", "3.1.0", "3.2.0", "3.2.1"]) {
    const document = namedExampleDocument(version, "http://127.0.0.1:55555");
    const spec = {
      _id: "spc_owned",
      _type: "api_spec",
      parentId: "wrk_owned",
      fileName: "api.yaml",
      contents: JSON.stringify(document),
      exampleFiles: [{ name: "body.json", base64: btoa(namedBodyText) }],
    };
    const original = JSON.stringify(spec);
    const analysis = analyzeSpec(spec);
    if (!analysis.valid) throw Error(JSON.stringify(analysis.diagnostics));
    const schemaBefore = JSON.stringify(analysis.schema);
    /** @param {string} path @param {string} method @param {string[]} location */
    const key = (path, method, ...location) =>
      JSON.stringify([path, method, false, ...location]);
    const bodyKey = key("/body", "post", "body");
    const selections = Object.fromEntries([
      ...[
        ["path", "slug"],
        ["query", "q"],
        ["header", "x-mode"],
        ["cookie", "c"],
      ].map(([location, name]) => [
        key("/choice/{slug}", "get", "parameter", location, name),
        { level: "parameter", name: "second" },
      ]),
      [bodyKey, { mediaType: "application/json", name: "second" }],
      [
        key("/content", "get", "parameter", "query", "j"),
        { level: "media", name: "second" },
      ],
    ]);
    const resources = generateRequests(
      analysis,
      spec.parentId,
      spec._id,
      "",
      selections,
    );
    const data = {
      ...initialData(),
      activeWorkspaceId: spec.parentId,
      resources: [
        {
          _id: spec.parentId,
          _type: "workspace",
          parentId: null,
          name: "Owned",
        },
        ...resources,
      ],
    };
    /** @param {string} path */
    const request = (path) => {
      const r = resources.find(
        (r) => r._type === "request" && r.sourceOperation.path === path,
      );
      if (!r) throw Error("Missing " + path);
      return r;
    };
    /** @param {string} path */
    const prepared = (path) =>
      prepareRenderedRequest(data, request(path), "run_named");
    const p = prepared("/choice/{slug}");
    check(
      version + " path/query",
      new URL(p.url).pathname + new URL(p.url).search,
      "/choice/picked?q=selected",
    );
    check(
      version + " header override",
      p.headers.find((h) => h[0].toLowerCase() === "x-mode")?.[1],
      "picked header",
    );
    check(
      version + " cookie",
      p.headers.find((h) => h[0].toLowerCase() === "cookie")?.[1],
      "c=kept",
    );
    check(
      version + " shared-ref isolation",
      new URL(prepared("/isolate").url).search,
      "?q=first",
    );
    check(
      version + " content",
      new URL(prepared("/content").url).search,
      "?j=true",
    );
    check(
      version + " external body",
      prepared("/body").bodyBase64,
      btoa(namedBodyText),
    );
    for (const [name, expected] of [
      ["second", "plain second"],
      ["", "empty name"],
      ["__proto__", "prototype name"],
      ["10", "numeric name"],
    ]) {
      const generated = generateRequests(
        analysis,
        spec.parentId,
        spec._id,
        "",
        { [bodyKey]: { mediaType: "text/plain", name } },
      );
      const body = generated.find(
        (r) => r._type === "request" && r.sourceOperation.path === "/body",
      );
      check(version + " body named " + name, body?.body.text, expected);
    }
    const encodedSpec = encodeGitResource({
      ...spec,
      exampleSelections: selections,
    });
    const restored = decodeGitResource(encodedSpec.path, encodedSpec.content);
    if (!restored) throw Error("Missing Git spec roundtrip");
    check(version + " choice Git", restored.exampleSelections, selections);
    const f = encodeGitResource(request("/body")),
      roundtrip = decodeGitResource(f.path, f.content);
    if (!roundtrip) throw Error("Missing Git request roundtrip");
    check(version + " request provenance", roundtrip.sourceExampleChoices, {
      [bodyKey]: selections[bodyKey],
    });
    check(
      version + " source immutable",
      [JSON.stringify(spec), JSON.stringify(analysis.schema)],
      [original, schemaBefore],
    );
    refused(version + " stale name", () =>
      generateRequests(analysis, spec.parentId, spec._id, "", {
        [bodyKey]: { mediaType: "application/json", name: "gone" },
      }),
    );
    refused(
      version + " stale operation",
      () =>
        generateRequests(analysis, spec.parentId, spec._id, "", {
          missing: { level: "parameter", name: "second" },
        }),
      /no longer matches this document/,
    );
    refused(version + " stale media", () =>
      generateRequests(analysis, spec.parentId, spec._id, "", {
        [bodyKey]: { mediaType: "application/xml", name: "second" },
      }),
    );
    refused(
      version + " malformed choices",
      () =>
        generateRequests(
          analysis,
          spec.parentId,
          spec._id,
          "",
          /** @type {any} */ ([]),
        ),
      /require an object/,
    );
    refused(version + " extra choice field", () =>
      generateRequests(analysis, spec.parentId, spec._id, "", {
        [bodyKey]: /** @type {any} */ ({
          mediaType: "application/json",
          name: "second",
          extra: true,
        }),
      }),
    );
    refused(
      version + " choice count bound",
      () =>
        generateRequests(
          analysis,
          spec.parentId,
          spec._id,
          "",
          Object.fromEntries(
            Array.from({ length: 10001 }, (_, i) => [
              String(i),
              { mediaType: "application/json", name: "second" },
            ]),
          ),
        ),
      /exceed 10000 entries or 1 MiB/,
    );
    refused(
      version + " choice byte bound",
      () =>
        generateRequests(analysis, spec.parentId, spec._id, "", {
          [bodyKey]: {
            mediaType: "application/json",
            name: "x".repeat(1024 * 1024),
          },
        }),
      /exceed 10000 entries or 1 MiB/,
    );
  }
  for (const version of ["3.2.0", "3.2.1"]) {
    for (const item of serializedExampleCases.slice(0, 12)) {
      const path = item.location === "path" ? "/path/{id}" : "/named";
      const examples = {
        first: { serializedValue: "first" },
        second: { serializedValue: item.text },
      };
      const parameter = {
        name: item.name,
        in: item.location,
        required: item.location === "path",
        ...(item.media
          ? {
              content: {
                [item.media]: {
                  ...(item.level === "media" ? { examples } : {}),
                },
              },
              ...(item.level !== "media" ? { examples } : {}),
            }
          : { schema: { type: "string" }, examples }),
      };
      const operation = {
        ...(item.location === "body"
          ? { requestBody: { content: { [item.media]: { examples } } } }
          : { parameters: [parameter] }),
        responses: { 200: { description: "OK" } },
      };
      const analysis = analyzeSpec({
        contents: JSON.stringify({
          openapi: version,
          info: { title: "Named serialized", version: "1" },
          servers: [{ url: "http://127.0.0.1:55555" }],
          paths: { [path]: { post: operation } },
        }),
      });
      if (!analysis.valid) throw Error(JSON.stringify(analysis.diagnostics));
      const key = JSON.stringify([
        path,
        "post",
        false,
        ...(item.location === "body"
          ? ["body"]
          : [
              "parameter",
              item.location,
              item.location === "header" ? item.name.toLowerCase() : item.name,
            ]),
      ]);
      const choices = {
        [key]: {
          name: "second",
          ...(item.location === "body"
            ? { mediaType: item.media }
            : { level: item.level === "media" ? "media" : "parameter" }),
        },
      };
      const resources = generateRequests(
        analysis,
        "wrk_owned",
        "spc_owned",
        "",
        choices,
      );
      const request = resources.find((r) => r._type === "request");
      if (!request) throw Error("Missing named serialized request");
      const prepared = prepareRenderedRequest(
        {
          ...initialData(),
          activeWorkspaceId: "wrk_owned",
          resources: [
            {
              _id: "wrk_owned",
              _type: "workspace",
              parentId: null,
              name: "Owned",
            },
            ...resources,
          ],
        },
        request,
        "run_named",
      );
      const actual =
        item.location === "body"
          ? prepared.body
          : item.location === "header"
            ? prepared.headers.find(
                (h) => h[0].toLowerCase() === item.name.toLowerCase(),
              )?.[1]
            : item.location === "cookie"
              ? prepared.headers.find(
                  (h) => h[0].toLowerCase() === "cookie",
                )?.[1]
              : item.location === "path"
                ? new URL(prepared.url).pathname
                : prepared.url.slice(prepared.url.indexOf("?"));
      check(version + " named serialized " + item.id, actual, item.expected);
    }
  }
  for (const version of ["3.2.0", "3.2.1"]) {
    const sharedParameter = {
      name: "q",
      in: "query",
      schema: { type: "string" },
      examples: {
        first: { dataValue: "first" },
        second: { dataValue: "second" },
      },
    };
    const operation = {
      parameters: [sharedParameter],
      responses: { 200: { description: "OK" } },
    };
    const analysis = analyzeSpec({
      contents: JSON.stringify({
        openapi: version,
        info: { title: "Named operation identity", version: "1" },
        servers: [{ url: "http://127.0.0.1:55555" }],
        paths: {
          "/identity": {
            get: operation,
            additionalOperations: {
              get: operation,
              "custom-METHOD": operation,
            },
          },
        },
      }),
    });
    if (!analysis.valid) throw Error(JSON.stringify(analysis.diagnostics));
    const before = JSON.stringify(analysis.schema);
    const choices = {
      [JSON.stringify(["/identity", "get", false, "parameter", "query", "q"])]:
        { level: "parameter", name: "second" },
      [JSON.stringify([
        "/identity",
        "custom-METHOD",
        true,
        "parameter",
        "query",
        "q",
      ])]: { level: "parameter", name: "second" },
    };
    const requests = generateRequests(
      analysis,
      "wrk_owned",
      "spc_owned",
      "",
      choices,
    ).filter((r) => r._type === "request");
    check(
      version + " operation methods",
      requests.map((r) => r.method),
      ["GET", "get", "custom-METHOD"],
    );
    check(
      version + " operation choices isolated",
      requests.map((r) => r.parameters[0].value),
      ["second", "first", "second"],
    );
    check(
      version + " additional operation provenance",
      requests.map((r) => r.sourceOperation.additional || false),
      [false, true, true],
    );
    check(
      version + " operation source immutable",
      JSON.stringify(analysis.schema),
      before,
    );
  }
  for (const version of ["3.2.0", "3.2.1"]) {
    const mediaText = ' { "n":9007199254740993 }\n';
    const mediaTarget = "?j=%20%7B%20%22n%22%3A9007199254740993%20%7D%0A";
    for (const kind of ["data", "serialized", "external"]) {
      const rootExample =
        kind === "data"
          ? { dataValue: false }
          : kind === "serialized"
            ? { serializedValue: "j=root%2f" }
            : { externalValue: "root.txt" };
      const mediaExample =
        kind === "data"
          ? { dataValue: true }
          : kind === "serialized"
            ? { serializedValue: mediaText }
            : { externalValue: "media.json" };
      const parameter = {
        name: "j",
        in: "query",
        examples: { same: { $ref: "#/components/examples/Root" } },
        content: {
          "application/json": {
            schema: { type: kind === "data" ? "boolean" : "object" },
            examples: { same: { $ref: "#/components/examples/Media" } },
          },
        },
      };
      const spec = {
        contents: JSON.stringify({
          openapi: version,
          info: { title: "Dual examples", version: "1" },
          servers: [{ url: "http://127.0.0.1:55555" }],
          components: { examples: { Root: rootExample, Media: mediaExample } },
          paths: {
            "/dual": {
              get: {
                parameters: [parameter],
                responses: { 200: { description: "OK" } },
              },
            },
          },
        }),
        exampleFiles: [
          { name: "root.txt", base64: btoa("j=root%2f") },
          { name: "media.json", base64: btoa(mediaText) },
        ],
      };
      const analysis = analyzeSpec(spec);
      if (!analysis.valid) throw Error(JSON.stringify(analysis.diagnostics));
      const before = [JSON.stringify(spec), JSON.stringify(analysis.schema)];
      for (const level of ["default", "parameter", "media"]) {
        const choices =
          level === "default"
            ? {}
            : {
                [JSON.stringify([
                  "/dual",
                  "get",
                  false,
                  "parameter",
                  "query",
                  "j",
                ])]: { level, name: "same" },
              };
        const resources = generateRequests(
          analysis,
          "wrk_owned",
          "spc_owned",
          "",
          choices,
        );
        const request = resources.find((r) => r._type === "request");
        if (!request) throw Error("Missing dual-level request");
        const prepared = prepareRenderedRequest(
          {
            ...initialData(),
            resources: [
              {
                _id: "wrk_owned",
                _type: "workspace",
                parentId: null,
                name: "Owned",
              },
              ...resources,
            ],
          },
          request,
          "run_dual",
        );
        const expected =
          kind === "data"
            ? level === "parameter"
              ? "?j=false"
              : "?j=true"
            : level === "media"
              ? mediaTarget
              : "?j=root%2f";
        check(
          version + " dual " + kind + " " + level,
          new URL(prepared.url).search,
          expected,
        );
      }
      check(
        version + " dual " + kind + " source",
        [JSON.stringify(spec), JSON.stringify(analysis.schema)],
        before,
      );
    }
  }
  return { passed: true, checks, controls };
}
