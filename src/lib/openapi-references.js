/** Fields containing OpenAPI Objects or Schema Objects, rather than payload data. */
const fields = {
  openapi: {
    paths: "paths",
    webhooks: "map:pathItem",
    components: "components",
    definitions: "map:schema",
    parameters: "map:parameter",
    responses: "map:response",
    securityDefinitions: "map:securityScheme",
  },
  components: {
    schemas: "map:schema",
    examples: "map:example",
    parameters: "map:parameter",
    headers: "map:header",
    requestBodies: "map:requestBody",
    responses: "map:response",
    callbacks: "map:callback",
    pathItems: "map:pathItem",
    links: "map:link",
    securitySchemes: "map:securityScheme",
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
  parameter: {
    schema: "schema",
    items: "schemaOrArray",
    examples: "map:example",
    content: "map:media",
  },
  header: {
    schema: "schema",
    items: "schemaOrArray",
    examples: "map:example",
    content: "map:media",
  },
  requestBody: { content: "map:media" },
  response: {
    schema: "schema",
    content: "map:media",
    headers: "map:header",
    links: "map:link",
  },
  media: {
    schema: "schema",
    itemSchema: "schema",
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
  schema: {
    properties: "map:schema",
    patternProperties: "map:schema",
    definitions: "map:schema",
    $defs: "map:schema",
    dependentSchemas: "map:schema",
    dependencies: "map:schema",
    items: "schemaOrArray",
    prefixItems: "array:schema",
    additionalItems: "schema",
    contains: "schema",
    unevaluatedItems: "schema",
    additionalProperties: "schema",
    unevaluatedProperties: "schema",
    propertyNames: "schema",
    allOf: "array:schema",
    anyOf: "array:schema",
    oneOf: "array:schema",
    not: "schema",
    if: "schema",
    then: "schema",
    else: "schema",
    contentSchema: "schema",
  },
};

/** Rename in place without changing JSON member order or invoking __proto__ setters.
 * @param {Record<string,any>} node @param {string} from @param {string} to */
function rename(node, from, to) {
  const entries = Object.entries(node);
  for (const [key] of entries) delete node[key];
  for (const [key, value] of entries)
    Object.defineProperty(node, key === from ? to : key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
}

/** The installed parser visits every $ref, including arbitrary literal objects.
 * Protect non-reference fields before using its documented filesystem API.
 * @param {{filename:string,specification:Record<string,any>}[]} files */
export function prepareApiReferences(files) {
  const documents = new Map(
    files.map((file) => [file.filename, file.specification]),
  );
  const all = /** @type {Record<string,any>[]} */ ([]);
  const keys = new Set();
  for (const file of files) {
    const pending = [{ node: file.specification, depth: 0 }];
    let count = 0;
    while (pending.length) {
      const current = pending.pop();
      if (!current || !current.node || typeof current.node !== "object")
        continue;
      if (++count > 200000 || current.depth > 100)
        throw Error("Specification structure exceeds the processing limit.");
      all.push(current.node);
      for (const [key, value] of Object.entries(current.node)) {
        keys.add(key);
        if (value && typeof value === "object")
          pending.push({ node: value, depth: current.depth + 1 });
      }
    }
  }
  let marker = "__insomnium_literal_ref__";
  while (keys.has(marker) || keys.has(marker + "_origin")) marker += "_";
  const origin = marker + "_origin";
  const allowed = new WeakSet();
  const references =
    /** @type {{node:Record<string,any>,base:string}[]} */ ([]);
  const seen = /** @type {WeakMap<object,Set<string>>} */ (new WeakMap());
  const pending = files.map((file) => ({
    node: file.specification,
    base: file.filename,
    kind:
      file.specification.openapi || file.specification.swagger
        ? "openapi"
        : "schema",
  }));
  while (pending.length) {
    const current = pending.pop();
    if (!current) continue;
    const { node, base } = current;
    let { kind } = current;
    if (!node || typeof node !== "object") continue;
    const roles = seen.get(node) || new Set();
    if (roles.has(kind)) continue;
    roles.add(kind);
    seen.set(node, roles);
    if (kind === "schemaOrArray")
      kind = Array.isArray(node) ? "array:schema" : "schema";
    if (kind.startsWith("array:")) {
      if (Array.isArray(node))
        for (const child of node)
          pending.push({ node: child, base, kind: kind.slice(6) });
      continue;
    }
    if (
      kind.startsWith("map:") ||
      ["paths", "responses"].includes(kind) ||
      (kind === "callback" && !Object.hasOwn(node, "$ref"))
    ) {
      const childKind = kind.startsWith("map:")
        ? kind.slice(4)
        : kind === "responses"
          ? "response"
          : "pathItem";
      for (const [key, child] of Object.entries(node)) {
        if (!kind.startsWith("map:") && key.startsWith("x-")) continue;
        pending.push({ node: child, base, kind: childKind });
      }
      continue;
    }
    if (Array.isArray(node)) continue;
    allowed.add(node);
    if (typeof node.$ref === "string") {
      references.push({ node, base });
      const uri = new URL(node.$ref, base);
      const fragment = decodeURIComponent(uri.hash.slice(1));
      uri.hash = "";
      let target = documents.get(uri.href);
      if (!fragment || fragment.startsWith("/")) {
        for (const part of fragment ? fragment.slice(1).split("/") : []) {
          const key = part.replaceAll("~1", "/").replaceAll("~0", "~");
          target =
            target && Object.hasOwn(target, key) ? target[key] : undefined;
        }
        if (target && typeof target === "object")
          pending.push({ node: target, base: uri.href, kind });
      }
    }
    for (const [key, childKind] of Object.entries(
      fields[/** @type {keyof typeof fields} */ (kind)] || {},
    ))
      if (node[key] && typeof node[key] === "object")
        pending.push({ node: node[key], base, kind: childKind });
  }
  for (const node of all)
    if (!allowed.has(node) && Object.hasOwn(node, "$ref"))
      rename(node, "$ref", marker);
  for (const { node, base } of references) {
    const uri = new URL(node.$ref, base);
    const original = uri.href;
    const fragment = decodeURIComponent(uri.hash.slice(1));
    if (fragment.startsWith("/")) {
      const resource = new URL(uri);
      resource.hash = "";
      let target = documents.get(resource.href);
      const parts = [];
      for (const part of fragment.slice(1).split("/")) {
        const key = part.replaceAll("~1", "/").replaceAll("~0", "~");
        const mapped =
          key === "$ref" && target && Object.hasOwn(target, marker)
            ? marker
            : key;
        parts.push(mapped.replaceAll("~", "~0").replaceAll("/", "~1"));
        target =
          target && Object.hasOwn(target, mapped) ? target[mapped] : undefined;
      }
      uri.hash = "/" + parts.join("/");
    }
    node.$ref = uri.href;
    if (uri.href !== original) node[origin] = original;
  }
  return { marker, origin };
}

/** Restore payload members after parser cloning/resolution, including cyclic schemas.
 * @param {Record<string,any>} root @param {{marker:string,origin:string}} protection */
export function restoreApiReferences(root, { marker, origin }) {
  const pending = [root],
    seen = new WeakSet();
  while (pending.length) {
    const node = pending.pop();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    if (Object.hasOwn(node, marker)) rename(node, marker, "$ref");
    if (Object.hasOwn(node, origin)) {
      if (Object.hasOwn(node, "$ref")) node.$ref = node[origin];
      delete node[origin];
    }
    for (const child of Object.values(node))
      if (child && typeof child === "object") pending.push(child);
  }
}
