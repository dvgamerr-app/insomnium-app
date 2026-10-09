import { apiDocumentBaseUri, parseSpec } from "./openapi-document.js";

export const exampleAssetLimit = 2 * 1024 * 1024;
const totalLimit = 8 * 1024 * 1024;

/** Attachments may be prepared while the author is repairing incomplete source.
 * Analysis still parses and validates the document before generation.
 * @param {Record<string,any>} spec */
function assetDocument(spec) {
  try {
    return spec.contents ? parseSpec(spec.contents).value : {};
  } catch {
    return {};
  }
}

/** Validate persisted example bytes independently of JSON/YAML reference files.
 * @param {Record<string,any>} spec @param {Record<string,any>} [document] */
export function exampleAssetIndex(spec, document = assetDocument(spec)) {
  const files = spec.exampleFiles || [];
  if (!Array.isArray(files) || files.length > 32)
    throw new Error("Attach at most 32 example files.");
  if (
    files.length &&
    new TextEncoder().encode(
      JSON.stringify({
        contents: spec.contents || "",
        files: spec.files || [],
        exampleFiles: files,
      }),
    ).byteLength > totalLimit
  )
    throw new Error(
      "Combined specification, references and examples exceed 8 MiB.",
    );
  const base = apiDocumentBaseUri(
    document,
    new URL(spec.fileName || "openapi.yaml", "memory:///").href,
  );
  const index = new Map();
  for (const file of files) {
    if (
      !file ||
      typeof file.name !== "string" ||
      !file.name.trim() ||
      typeof file.base64 !== "string"
    )
      throw new Error("Example files require a name and base64 bytes.");
    const uri = new URL(file.name, base);
    if (uri.hash)
      throw new Error("Example file names must not contain fragments.");
    if (index.has(uri.href))
      throw new Error("Example file names must be unique.");
    let binary;
    try {
      binary = atob(file.base64);
    } catch {
      throw new Error(`Invalid base64 for example ${file.name}.`);
    }
    if (btoa(binary) !== file.base64)
      throw new Error(`Noncanonical base64 for example ${file.name}.`);
    if (binary.length > exampleAssetLimit)
      throw new Error(`${file.name} exceeds 2 MiB.`);
    index.set(uri.href, {
      ...file,
      bytes: Uint8Array.from(binary, (c) => c.charCodeAt(0)),
    });
  }
  return index;
}

/** Add/refresh explicitly loaded examples without changing the source document.
 * @param {Record<string,any>} spec @param {Record<string,any>[]} additions */
export function addExampleAssets(spec, additions) {
  const document = assetDocument(spec);
  const base = apiDocumentBaseUri(
    document,
    new URL(spec.fileName || "openapi.yaml", "memory:///").href,
  );
  const next = [...(spec.exampleFiles || [])];
  for (const file of additions) {
    const uri = new URL(file.name, base).href;
    const at = next.findIndex((item) => new URL(item.name, base).href === uri);
    if (at < 0) next.push(file);
    else next[at] = file;
  }
  exampleAssetIndex({ ...spec, exampleFiles: next }, document);
  return next;
}

/** Bind external assets only along OpenAPI Object fields and typed references.
 * Literal examples, schemas, links and extensions are never traversed.
 * @param {Record<string,any>} document @param {string} base
 * @param {ReturnType<typeof exampleAssetIndex>} assets
 * @param {Map<string,Record<string,any>>} [documents] */
export function applyExampleAssets(
  document,
  base,
  assets,
  documents = new Map(),
) {
  /** @type {Record<string,Record<string,string>>} */
  const fields = {
    openapi: {
      paths: "paths",
      webhooks: "map:pathItem",
      components: "components",
    },
    components: {
      examples: "map:example",
      parameters: "map:parameter",
      headers: "map:header",
      requestBodies: "map:requestBody",
      responses: "map:response",
      callbacks: "map:callback",
      pathItems: "map:pathItem",
    },
    pathItem: {
      parameters: "array:parameter",
      get: "operation",
      put: "operation",
      post: "operation",
      delete: "operation",
      options: "operation",
      head: "operation",
      patch: "operation",
      trace: "operation",
      query: "operation",
      additionalOperations: "map:operation",
    },
    operation: {
      parameters: "array:parameter",
      requestBody: "requestBody",
      responses: "responses",
      callbacks: "map:callback",
    },
    parameter: { examples: "map:example", content: "map:media" },
    header: { examples: "map:example", content: "map:media" },
    requestBody: { content: "map:media" },
    response: { content: "map:media", headers: "map:header" },
    media: {
      examples: "map:example",
      encoding: "map:encoding",
      prefixEncoding: "array:encoding",
      itemEncoding: "encoding",
    },
    encoding: {
      headers: "map:header",
      encoding: "map:encoding",
      prefixEncoding: "array:encoding",
      itemEncoding: "encoding",
    },
  };
  const stack = [{ node: document, kind: "openapi", base }];
  /** @type {WeakMap<object,Set<string>>} */
  const seen = new WeakMap();
  let count = 0;
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    const { node, kind, base: containingBase } = current;
    if (!node || typeof node !== "object") continue;
    const roles = seen.get(node) || new Set();
    if (roles.has(kind)) continue;
    roles.add(kind);
    seen.set(node, roles);
    if (++count > 200000)
      throw new Error("Specification structure exceeds the processing limit.");
    if (kind.startsWith("array:")) {
      if (Array.isArray(node))
        for (const value of node)
          stack.push({
            node: value,
            kind: kind.slice(6),
            base: containingBase,
          });
      continue;
    }
    // References are followed in their source Object role, not by target key names.
    if (
      !kind.startsWith("map:") &&
      kind !== "paths" &&
      kind !== "responses" &&
      typeof node.$ref === "string"
    ) {
      const reference = new URL(node.$ref, containingBase);
      const fragment = decodeURIComponent(reference.hash.slice(1));
      reference.hash = "";
      if (fragment && !fragment.startsWith("/")) continue;
      let target = documents.get(reference.href);
      for (const part of fragment ? fragment.slice(1).split("/") : []) {
        const key = part.replaceAll("~1", "/").replaceAll("~0", "~");
        target = target && Object.hasOwn(target, key) ? target[key] : undefined;
      }
      if (target) stack.push({ node: target, kind, base: reference.href });
      continue;
    }
    if (
      kind.startsWith("map:") ||
      ["paths", "responses", "callback"].includes(kind)
    ) {
      const childKind = kind.startsWith("map:")
        ? kind.slice(4)
        : kind === "responses"
          ? "response"
          : "pathItem";
      for (const [key, value] of Object.entries(node)) {
        // These patterned Objects explicitly allow extensions. Named maps can
        // legitimately contain component/header/example names beginning x-.
        if (!kind.startsWith("map:") && key.startsWith("x-")) continue;
        stack.push({ node: value, kind: childKind, base: containingBase });
      }
      continue;
    }
    if (kind === "example") {
      if (typeof node.externalValue !== "string") continue;
      const uri = new URL(node.externalValue, containingBase).href;
      const file = assets.get(uri);
      node.externalValue = uri;
      delete node["x-insomnium-resolved-example"];
      if (file)
        node["x-insomnium-resolved-example"] = {
          name: file.name,
          base64: file.base64,
        };
      continue;
    }
    for (const [key, childKind] of Object.entries(fields[kind] || {}))
      if (node[key] && typeof node[key] === "object")
        stack.push({ node: node[key], kind: childKind, base: containingBase });
  }
}

/** @param {Record<string,any>|undefined} node */
export function selectedExternalExample(node) {
  const first = Object.values(node?.examples || {})[0];
  if (
    !first ||
    typeof first !== "object" ||
    typeof first.externalValue !== "string"
  )
    return null;
  if (!first["x-insomnium-resolved-example"])
    throw new Error(
      `Load external example ${first.externalValue} before generating requests.`,
    );
  return first["x-insomnium-resolved-example"];
}

/** Parameter serializers operate on Unicode text; body examples retain bytes.
 * @param {{name:string,base64:string}} file */
export function externalExampleText(file) {
  const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    throw new Error(
      `External parameter example ${file.name} requires valid UTF-8 text.`,
    );
  }
}
