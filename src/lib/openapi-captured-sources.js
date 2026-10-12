import { createSpectralSourceCatalog } from "./spectral-sources.js";
import { apiDocumentBaseUri, parseSpec } from "./openapi-document.js";

/** Validate an ephemeral accepted catalog against the original raw saved input.
 * No resolver, fetch or workspace mutation belongs in structural analysis.
 * @param {Record<string,any>} spec @param {Record<string,any>[]} sources */
export function capturedApiSources(spec, sources) {
  if (!Array.isArray(sources))
    throw new Error("Invalid captured specification sources.");
  const captured = {
    fileName: spec.fileName || "openapi.yaml",
    contents: spec.contents || "",
    files: (spec.files || []).map((/** @type {any} */ file) => ({
      name: file.name,
      contents: file.contents,
    })),
  };
  const metadata = sources.map((source) => {
    if (source?.origin === "main" || source?.origin === "attached") {
      const { contents, ...entry } = source;
      return entry;
    }
    return source;
  });
  const catalog = createSpectralSourceCatalog(captured, metadata);
  for (const source of sources)
    if (catalog.lookup(source.uri)?.contents !== source.contents)
      throw new Error("Captured specification source changed.");
  if (captured.files.length > 32)
    throw new Error("Attach at most 32 reference files.");
  const encoder = new TextEncoder();
  if (
    catalog.sources.reduce(
      (bytes, source) => bytes + encoder.encode(source.contents).byteLength,
      0,
    ) >
    8 * 1024 * 1024
  )
    throw new Error("Combined specification files exceed 8 MiB.");
  const main = catalog.lookup(catalog.mainUri);
  if (!main) throw new Error("Missing captured main source.");
  return [
    main,
    ...catalog.sources.filter((source) => source.uri !== catalog.mainUri),
  ];
}

/** @param {Record<string,any>} spec @param {Record<string,any>[]} sources */
export function capturedApiDocuments(spec, sources) {
  return capturedApiSources(spec, sources).map((source) => {
    const value = parseSpec(source.contents, {
      allowBoolean: source.origin !== "main",
    }).value;
    return { name: apiDocumentBaseUri(value, source.uri), value };
  });
}
