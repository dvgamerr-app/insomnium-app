import { analyzeSpec, generateRequests } from "../../../src/lib/openapi.js";
import { spectralRangeOffsets } from "../../../src/lib/spectral-sources.js";
import { prepareApiOrigins } from "../../../src/lib/openapi-origins.js";
import { dereference } from "@scalar/openapi-parser";
import {
  parseSpec,
  apiSourceLocation,
} from "../../../src/lib/openapi-document.js";
import {
  prepareApiReferences,
  restoreApiReferences,
} from "../../../src/lib/openapi-references.js";
import { validateApiDocument } from "../../../src/lib/openapi-validation.js";

/** Existing schema fixture extension; no resolver/network or mutable workspace.
 * @returns {{passed:boolean,checks:{name:string,passed:boolean}[],review:Record<string,any>}} */
export function sourceRangeEvidence() {
  /** @type {{name:string,passed:boolean}[]} */ const checks = [];
  const check = (/** @type {string} */ name, /** @type {boolean} */ passed) => {
    checks.push({ name, passed });
  };
  const root =
    "\uFEFFopenapi: 3.1.0\r\ninfo: {title: '😀', version: '1'}\r\npaths:\r\n  /a:\r\n    $ref: './a/shared.yaml'\r\n  /b:\r\n    $ref: './b/shared.yaml'\r\n";
  const a = "\uFEFFget:\r\n  $ref: '../nested/operation.yaml'\r\n",
    b =
      "get:\r\n  summary: Other😀\r\n  operationId: other\r\n  responses: { '200': {description: OK} }\r\n",
    nested =
      "\uFEFFoperationId: owned😀\r\nresponses:\r\n  '200':\r\n    description: OK\r\n";
  const spec = {
    fileName: "openapi.yaml",
    contents: root,
    files: [
      { name: "a/shared.yaml", contents: a },
      { name: "b/shared.yaml", contents: b },
      { name: "nested/operation.yaml", contents: nested },
    ],
  };
  const before = JSON.stringify(spec),
    analysis = analyzeSpec(spec),
    warning = analysis.diagnostics.find(
      (d) => d.message === "Operation has no summary.",
    );
  check(
    "nested operation exact lexical source",
    warning?.source === "memory:///nested/operation.yaml",
  );
  check(
    "full raw BOM CRLF astral range canonical LF",
    !!warning?.range &&
      (() => {
        const offsets = spectralRangeOffsets(nested, warning.range);
        return (
          nested
            .split(/\r\n?|\n/)
            .join("\n")
            .slice(offsets.start, offsets.end) ===
          "operationId: owned😀\nresponses:\n  '200':\n    description: OK\n"
        );
      })(),
  );
  check(
    "same-basename source is never confused",
    !analysis.diagnostics.some((d) => d.source === "memory:///b/shared.yaml"),
  );
  check("raw main and attachments unchanged", JSON.stringify(spec) === before);
  check(
    "attached browser fallback raw sources retained",
    analysis.sources.length === 4 &&
      analysis.sources.some(
        (s) =>
          s.uri === "memory:///nested/operation.yaml" &&
          s.contents === nested &&
          s.origin === "attached",
      ),
  );
  const main = analyzeSpec({
      fileName: "openapi.yaml",
      contents:
        "openapi: 3.1.0\ninfo: {title: Main😀, version: 7}\npaths: {}\n",
    }),
    invalid = main.diagnostics.find((d) => d.message === "must be string");
  check(
    "strict main scalar source",
    invalid?.source === "memory:///openapi.yaml",
  );
  check(
    "strict main complete scalar range",
    !!invalid?.range &&
      (() => {
        const source = main.sources[0].contents,
          offsets = spectralRangeOffsets(source, invalid.range);
        return source.slice(offsets.start, offsets.end) === "7";
      })(),
  );
  const missing = analyzeSpec({
      fileName: "openapi.yaml",
      contents: root,
      files: [
        {
          name: "a/shared.yaml",
          contents:
            "get:\n  parameters:\n    - $ref: ../absent.yaml\n  responses: {200: {description: OK}}\n",
        },
        { name: "b/shared.yaml", contents: b },
      ],
    }),
    refs = missing.diagnostics.filter((d) =>
      d.message.includes("Reference target is missing"),
    );
  check(
    "known typed foreign ref error site",
    refs.some(
      (d) =>
        d.source === "memory:///a/shared.yaml" &&
        d.sourcePath.join("/") === "get/parameters/0/$ref",
    ),
  );
  check(
    "known ref scalar full range",
    refs.some((d) => {
      if (!d.range || d.source !== "memory:///a/shared.yaml") return false;
      const source = missing.sources.find((s) => s.uri === d.source).contents,
        offsets = spectralRangeOffsets(source, d.range);
      return source.slice(offsets.start, offsets.end) === "../absent.yaml";
    }),
  );
  const captured = [
      {
        uri: "memory:///openapi.yaml",
        name: "openapi.yaml",
        origin: "main",
        contents: root,
      },
      {
        uri: "memory:///a/shared.yaml",
        name: "memory:///a/shared.yaml",
        origin: "repository",
        contents: a,
      },
      {
        uri: "memory:///b/shared.yaml",
        name: "memory:///b/shared.yaml",
        origin: "repository",
        contents: b,
      },
      {
        uri: "memory:///nested/operation.yaml",
        name: "memory:///nested/operation.yaml",
        origin: "repository",
        contents: nested,
      },
    ],
    external = analyzeSpec({ ...spec, files: [] }, captured);
  check(
    "captured repository origin and full range",
    external.diagnostics.some(
      (d) =>
        d.source === "memory:///nested/operation.yaml" &&
        JSON.stringify(d.range) === JSON.stringify(warning?.range),
    ) &&
      external.sources.find((s) => s.uri === "memory:///nested/operation.yaml")
        .origin === "repository",
  );
  const collision = {
    fileName: "openapi.yaml",
    contents: JSON.stringify({
      openapi: "3.1.0",
      info: { title: "Collision", version: "1" },
      paths: {
        "/own": {
          get: {
            responses: { 200: { description: "OK" } },
            __insomnium_source_origin__: "user",
            __insomnium_source_origin___: "another",
          },
        },
      },
      "x-user": { __insomnium_source_origin__: "string-value" },
    }),
  };
  const collided = analyzeSpec(collision);
  check(
    "user marker-like keys and values unchanged",
    collided.schema.paths["/own"].get.__insomnium_source_origin__ === "user" &&
      collided.schema["x-user"].__insomnium_source_origin__ === "string-value",
  );
  const generated = generateRequests(analysis, "workspace", "spec");
  check(
    "no synthetic markers in generated resources",
    !JSON.stringify(generated).includes("__insomnium_source_origin__"),
  );
  check(
    "no synthetic markers in diagnostics or raw catalog",
    !JSON.stringify({
      diagnostics: analysis.diagnostics,
      sources: analysis.sources,
    }).includes("__insomnium_source_origin__"),
  );
  const unknown = prepareApiOrigins([
    { filename: "memory:///known", specification: { own: true } },
  ]);
  check(
    "unknown unindexed origin unresolved",
    unknown.locate({ foreign: true }, ["foreign"]) === null,
  );
  const mergedFiles = [
      {
        filename: "memory:///known",
        specification: { own: true, $ref: "target" },
      },
      { filename: "memory:///other", specification: { foreign: true } },
    ],
    merged = prepareApiOrigins(mergedFiles),
    own = structuredClone(mergedFiles[0].specification),
    target = structuredClone(mergedFiles[1].specification);
  Object.assign(own, { foreign: true });
  merged.onDereference({ schema: own, resolved: target });
  check(
    "mixed missing container origin unresolved",
    merged.locate(own, ["missing"]) === null,
  );
  check(
    "own sibling lexical origin retained",
    merged.locate(own, ["own"])?.source === "memory:///known",
  );
  check(
    "inherited scalar lexical origin retained",
    merged.locate(own, ["foreign"])?.source === "memory:///other",
  );
  merged.strip(own);
  check(
    "provenance remains after complete stripping",
    !Object.hasOwn(own, merged.marker) &&
      merged.locate(own, ["foreign"])?.source === "memory:///other",
  );
  const arrays = prepareApiOrigins([
      {
        filename: "memory:///array",
        specification: { items: [{ value: "😀" }] },
      },
    ]),
    arrayRoot = { items: [] };
  check(
    "array unknown origin not fabricated",
    arrays.locate(arrayRoot, ["items", 0]) === null,
  );
  const arrayFiles = [
      {
        filename: "memory:///array",
        specification: { items: [{ value: "😀" }] },
      },
    ],
    arrayOrigin = prepareApiOrigins(arrayFiles),
    cloned = structuredClone(arrayFiles[0].specification);
  arrayOrigin.strip(cloned);
  check(
    "array indexed child origin survives clone and strip",
    JSON.stringify(arrayOrigin.locate(cloned, ["items", 0, "value"])) ===
      JSON.stringify({
        source: "memory:///array",
        path: ["items", "0", "value"],
      }),
  );
  let syntax = /** @type {any} */ (null);
  try {
    analyzeSpec({
      fileName: "openapi.yaml",
      contents: "\uFEFFopenapi: 3.1.0\r\ninfo: [😀\r\n",
    });
  } catch (error) {
    syntax = error;
  }
  check(
    "main parser error actual source and raw error range",
    syntax?.analysis?.diagnostics[0].source === "memory:///openapi.yaml" &&
      !!syntax.analysis.diagnostics[0].range &&
      syntax.analysis.valid === false,
  );
  let attachedSyntax = /** @type {any} */ (null);
  try {
    analyzeSpec({
      ...spec,
      files: [{ name: "a/shared.yaml", contents: "get: [😀\r\n" }],
    });
  } catch (error) {
    attachedSyntax = error;
  }
  check(
    "attached parser error exact readonly source",
    attachedSyntax?.analysis?.sources[0].uri === "memory:///a/shared.yaml" &&
      attachedSyntax.analysis.sources[0].origin === "attached" &&
      attachedSyntax.analysis.sources[0].contents === "get: [😀\r\n",
  );
  let declaredSyntax = /** @type {any} */ (null);
  try {
    analyzeSpec({
      fileName: "original.yaml",
      contents:
        "openapi: 3.2.0\n$self: memory:///design/main.yaml\ninfo: [😀\n",
    });
  } catch (error) {
    declaredSyntax = error;
  }
  check(
    "parser declaration identity matches actual AST self",
    declaredSyntax?.analysis?.diagnostics[0].source ===
      "memory:///design/main.yaml",
  );
  let duplicateIdentity = /** @type {any} */ (null);
  try {
    analyzeSpec({
      fileName: "openapi.yaml",
      contents:
        "openapi: 3.2.0\n$self: memory:///one.yaml\n$self: memory:///two.yaml\ninfo: [😀\n",
    });
  } catch (error) {
    duplicateIdentity = error;
  }
  check(
    "ambiguous parser identity cannot fabricate source/range",
    duplicateIdentity?.analysis?.sources.length === 0 &&
      duplicateIdentity.analysis.diagnostics.every(
        (/** @type {any} */ diagnostic) =>
          diagnostic.sourceUnavailable === true &&
          diagnostic.source === undefined &&
          diagnostic.range === undefined,
      ),
  );
  const aliasSpec = {
      fileName: "alias.yaml",
      contents:
        'openapi: 3.1.0\ninfo: {title: Alias, version: "1"}\npaths:\n  /a:\n    get: &operation\n      operationId: same\n      responses: {200: {description: OK}}\n  /b:\n    get: *operation\n',
    },
    aliased = analyzeSpec(aliasSpec),
    aliasWarnings = aliased.diagnostics.filter(
      (d) => d.message === "Operation has no summary.",
    );
  check(
    "known alias operation warnings use exact anchor definition",
    aliasWarnings.length === 2 &&
      JSON.stringify(aliasWarnings[0].range) ===
        JSON.stringify(aliasWarnings[1].range) &&
      aliasWarnings.every((d) => d.source === "memory:///alias.yaml"),
  );
  const aliasDuplicate = aliased.diagnostics.find(
    (d) => d.message === "Duplicate operationId: same",
  );
  check(
    "known alias scalar duplicate uses actual anchor range",
    !!aliasDuplicate?.range &&
      (() => {
        const offsets = spectralRangeOffsets(
          aliasSpec.contents,
          aliasDuplicate.range,
        );
        return aliasSpec.contents.slice(offsets.start, offsets.end) === "same";
      })(),
  );
  const wideSpec = {
      fileName: "wide.json",
      contents: JSON.stringify({
        openapi: "3.1.0",
        info: { title: "Wide", version: "1", "x-wide": Array(200000).fill(0) },
        paths: {},
      }),
    },
    wideParsed = parseSpec(wideSpec.contents),
    legacyFiles = [
      {
        filename: "memory:///wide.json",
        isEntrypoint: true,
        dir: "./",
        references: [],
        specification: JSON.parse(JSON.stringify(wideParsed.value)),
      },
    ],
    legacyProtection = prepareApiReferences(legacyFiles),
    legacy = dereference(legacyFiles);
  if (!legacy.schema) throw new Error("Original Scalar control has no schema");
  restoreApiReferences(legacy.schema, legacyProtection);
  check(
    "wide array original parser validator Scalar control accepts",
    wideSpec.contents.length < 2 * 1024 * 1024 &&
      validateApiDocument(wideParsed.value).valid &&
      !(legacy.errors || []).length,
  );
  let wideActual = /** @type {any} */ (null),
    wideError = "";
  try {
    wideActual = analyzeSpec(wideSpec);
  } catch (error) {
    wideError = String(error);
  }
  check(
    "wide array new analyzer equals accepted Scalar control",
    wideActual?.valid === true &&
      JSON.stringify(wideActual.schema) === JSON.stringify(legacy.schema),
  );
  const shared = { deep: { value: "shared" } },
    sharedFiles = [
      { filename: "memory:///shared", specification: { a: shared, b: shared } },
    ],
    sharedOrigins = prepareApiOrigins(sharedFiles),
    sharedClone = structuredClone(sharedFiles[0].specification);
  sharedOrigins.strip(sharedClone);
  check(
    "post-protection shared graph cannot choose last path",
    sharedOrigins.locate(sharedClone, ["a", "deep", "value"]) === null &&
      sharedOrigins.locate(sharedClone, ["b", "deep", "value"]) === null &&
      sharedOrigins.locate(sharedClone.a.deep, ["value"]) === null,
  );
  const objectWide = {
      wide: Object.fromEntries(
        Array.from({ length: 200000 }, (_, i) => [i.toString(36), 0]),
      ),
    },
    objectOrigin = prepareApiOrigins([
      { filename: "memory:///object", specification: objectWide },
    ]);
  objectOrigin.strip(objectWide);
  check(
    "broad object strip iterative in browser engine",
    Object.keys(objectWide.wide).length === 200000 &&
      !Object.hasOwn(objectWide.wide, objectOrigin.marker),
  );
  for (const value of [false, true]) {
    const boolFiles = [
        {
          filename: "memory:///bool-main",
          isEntrypoint: true,
          dir: "./",
          references: [],
          specification: {
            openapi: "3.1.0",
            info: { title: "Boolean", version: "1" },
            paths: {},
            components: {
              schemas: { Target: { $ref: "memory:///bool-target#" } },
            },
          },
        },
        {
          filename: "memory:///bool-target",
          isEntrypoint: false,
          dir: "./",
          references: [],
          specification: /** @type {any} */ (value),
        },
      ],
      protectedBool = prepareApiReferences(boolFiles),
      boolOrigins = prepareApiOrigins(boolFiles, [
        protectedBool.marker,
        protectedBool.origin,
        protectedBool.binding,
        protectedBool.booleanMarker,
      ]);
    let callbacks = 0;
    const resolvedBool = dereference(boolFiles, {
      onDereference: (event) => {
        callbacks++;
        boolOrigins.onDereference(event);
      },
    });
    if (!resolvedBool.schema)
      throw new Error("Boolean Scalar control has no schema");
    const boolSchema = /** @type {Record<string,any>} */ (resolvedBool.schema);
    boolOrigins.strip(boolSchema);
    for (const file of boolFiles) boolOrigins.strip(file.specification);
    restoreApiReferences(boolSchema, protectedBool);
    const located = boolOrigins.locate(boolSchema, [
      "components",
      "schemas",
      "Target",
    ]);
    const boolParsed = parseSpec(String(value), { allowBoolean: true }),
      boolAst = apiSourceLocation(boolParsed.document, located?.path || []);
    check(
      "Boolean " +
        value +
        " actual Scalar box restoration retains target origin",
      callbacks > 0 &&
        boolSchema.components.schemas.Target === value &&
        located?.source === "memory:///bool-target" &&
        located.path.length === 0 &&
        Array.isArray(boolAst?.node.range) &&
        boolAst.node.range[0] === 0 &&
        boolAst.node.range[1] === String(value).length &&
        String(value).slice(
          boolAst?.node.range?.[0],
          boolAst?.node.range?.[1],
        ) === String(value),
    );
  }
  return {
    passed: checks.every((row) => row.passed),
    checks,
    review: {
      aliasWarnings,
      aliasDuplicate,
      wideError,
      wideBytes: wideSpec.contents.length,
    },
  };
}
