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
  const locations = /** @type {WeakMap<object,{file:string,path:string[]}>} */ (
    new WeakMap()
  );
  for (const file of files) {
    const pending = [
      {
        node: file.specification,
        depth: 0,
        path: /** @type {string[]} */ ([]),
      },
    ];
    let count = 0;
    while (pending.length) {
      const current = pending.pop();
      if (!current || !current.node || typeof current.node !== "object")
        continue;
      if (++count > 200000 || current.depth > 100)
        throw Error("Specification structure exceeds the processing limit.");
      all.push(current.node);
      locations.set(current.node, { file: file.filename, path: current.path });
      for (const [key, value] of Object.entries(current.node)) {
        keys.add(key);
        if (value && typeof value === "object")
          pending.push({
            node: value,
            depth: current.depth + 1,
            path: [...current.path, key],
          });
      }
    }
  }
  let marker = "__insomnium_literal_ref__";
  while (keys.has(marker) || keys.has(marker + "_origin")) marker += "_";
  const origin = marker + "_origin";
  const allowed = new WeakSet();
  const references =
    /** @type {{node:Record<string,any>,base:string,kind:string,followed:boolean}[]} */ ([]);
  const errors = /** @type {string[]} */ ([]);
  const resources = new Map(documents);
  const anchors = /** @type {Map<string,Record<string,any>>} */ (new Map());
  const schemaBases = /** @type {WeakMap<object,string>} */ (new WeakMap());
  const dialects = /** @type {WeakMap<object,string>} */ (new WeakMap());
  const modern = /^3\.[12]\./.test(
    String(files[0].specification.openapi || ""),
  );
  const defaultDialect = "https://json-schema.org/draft/2020-12/schema";
  const fileDialects = new Map(
    files.map((file) => [
      file.filename,
      file.specification.swagger ||
      /^3\.0\./.test(String(file.specification.openapi || ""))
        ? "legacy"
        : String(
            file.specification.jsonSchemaDialect ||
              (modern ? defaultDialect : "legacy"),
          ),
    ]),
  );
  const supportedDialect = (/** @type {string} */ dialect) =>
    [
      defaultDialect,
      "https://spec.openapis.org/oas/3.1/dialect/base",
      "https://spec.openapis.org/oas/3.1/dialect/2024-10-25",
      "https://spec.openapis.org/oas/3.1/dialect/2024-11-10",
      "https://spec.openapis.org/oas/3.2/dialect/2025-09-17",
      "https://spec.openapis.org/oas/3.2/dialect/2026-02-26",
    ].includes(dialect.replace(/#$/, ""));
  const register = (
    /** @type {Map<string,Record<string,any>>} */ index,
    /** @type {string} */ uri,
    /** @type {Record<string,any>} */ node,
  ) => {
    if (index.has(uri) && index.get(uri) !== node)
      errors.push("Ambiguous schema resource identity: " + uri);
    else index.set(uri, node);
  };
  const lookup = (
    /** @type {string} */ reference,
    /** @type {string} */ base,
    /** @type {string} */ kind,
  ) => {
    const uri = new URL(reference, base);
    const fragment = decodeURIComponent(uri.hash.slice(1));
    uri.hash = "";
    let target =
      kind === "schema" ? resources.get(uri.href) : documents.get(uri.href);
    if (fragment && !fragment.startsWith("/"))
      return kind === "schema"
        ? anchors.get(uri.href + "#" + fragment)
        : undefined;
    for (const part of fragment ? fragment.slice(1).split("/") : []) {
      const key = part.replaceAll("~1", "/").replaceAll("~0", "~");
      target = target && Object.hasOwn(target, key) ? target[key] : undefined;
    }
    return target;
  };
  const seen = /** @type {WeakMap<object,Set<string>>} */ (new WeakMap());
  const pending = files.map((file) => ({
    node: file.specification,
    base: file.filename,
    dialect: fileDialects.get(file.filename) || defaultDialect,
    kind:
      file.specification.openapi || file.specification.swagger
        ? "openapi"
        : "schema",
  }));
  // Discover lexical resources first, then follow references to detached typed
  // fragments. Repeat only when a reference reveals another schema resource.
  let pass = 0;
  while (true) {
    if (++pass > 100)
      throw Error("Schema reference discovery exceeds 100 passes.");
    while (pending.length) {
      const current = pending.pop();
      if (!current) continue;
      const { node } = current;
      let { base, dialect } = current;
      let { kind } = current;
      if (!node || typeof node !== "object") continue;
      if (kind === "schemaOrArray")
        kind = Array.isArray(node) ? "array:schema" : "schema";
      const roles = seen.get(node) || new Set();
      if (roles.has(kind)) continue;
      roles.add(kind);
      seen.set(node, roles);
      if (kind.startsWith("array:")) {
        if (Array.isArray(node))
          for (const child of node)
            pending.push({ node: child, base, dialect, kind: kind.slice(6) });
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
          pending.push({ node: child, base, dialect, kind: childKind });
        }
        continue;
      }
      if (Array.isArray(node)) continue;
      allowed.add(node);
      if (kind === "schema" && dialect !== "legacy") {
        dialect = String(node.$schema || dialect);
        if (
          Object.hasOwn(node, "$id") ||
          Object.hasOwn(node, "$anchor") ||
          Object.hasOwn(node, "$dynamicAnchor")
        ) {
          if (!supportedDialect(dialect))
            errors.push("Schema resource dialect is not supported: " + dialect);
          else {
            if (Object.hasOwn(node, "$id")) {
              if (typeof node.$id !== "string")
                errors.push("Schema $id must be a URI-reference string.");
              else {
                const uri = new URL(node.$id, base);
                if (uri.hash)
                  errors.push(
                    "Schema $id must not contain a non-empty fragment: " +
                      node.$id,
                  );
                else {
                  uri.hash = "";
                  base = uri.href;
                  register(resources, base, node);
                }
              }
            }
            for (const keyword of ["$anchor", "$dynamicAnchor"])
              if (Object.hasOwn(node, keyword)) {
                if (
                  typeof node[keyword] !== "string" ||
                  !/^[A-Za-z_][-A-Za-z0-9._]*$/.test(node[keyword])
                )
                  errors.push(
                    "Schema " +
                      keyword +
                      " must be a valid plain-name identifier.",
                  );
                else register(anchors, base + "#" + node[keyword], node);
              }
          }
        }
        schemaBases.set(node, base);
        dialects.set(node, dialect);
        if (Object.hasOwn(node, "$dynamicRef"))
          errors.push(
            "Dynamic schema references require dynamic-scope evaluation and are not yet supported.",
          );
      }
      if (typeof node.$ref === "string") {
        references.push({ node, base, kind, followed: false });
      }
      for (const [key, childKind] of Object.entries(
        fields[/** @type {keyof typeof fields} */ (kind)] || {},
      ))
        if (node[key] && typeof node[key] === "object")
          pending.push({ node: node[key], base, dialect, kind: childKind });
    }
    for (const reference of references) {
      if (reference.followed) continue;
      const target = lookup(
        reference.node.$ref,
        reference.base,
        reference.kind,
      );
      if (!target || typeof target !== "object" || Array.isArray(target))
        continue;
      reference.followed = true;
      const location = locations.get(target);
      if (!location) continue;
      pending.push({
        node: target,
        base: schemaBases.get(target) || location.file,
        dialect:
          dialects.get(target) ||
          fileDialects.get(location.file) ||
          defaultDialect,
        kind: reference.kind,
      });
    }
    if (!pending.length) break;
  }
  // Resolve authored pointers before protecting literal property names.
  const targets = new Map(
    references.map((reference) => [
      reference,
      lookup(reference.node.$ref, reference.base, reference.kind),
    ]),
  );
  for (const node of all)
    if (!allowed.has(node) && Object.hasOwn(node, "$ref"))
      rename(node, "$ref", marker);
  for (const reference of references) {
    const { node, base } = reference;
    const uri = new URL(node.$ref, base);
    const original = uri.href;
    const resolved = targets.get(reference);
    if (!resolved || typeof resolved !== "object" || Array.isArray(resolved)) {
      errors.push(
        "Reference target is missing or is not an object schema/resource: " +
          original,
      );
      rename(node, "$ref", marker);
      continue;
    }
    const location = locations.get(resolved);
    if (location) {
      uri.href = location.file;
      let target = documents.get(location.file);
      const parts = [];
      for (const key of location.path) {
        const mapped =
          key === "$ref" && target && Object.hasOwn(target, marker)
            ? marker
            : key;
        parts.push(mapped.replaceAll("~", "~0").replaceAll("/", "~1"));
        target =
          target && Object.hasOwn(target, mapped) ? target[mapped] : undefined;
      }
      // Scalar requires an explicit empty fragment when selecting a file root.
      if (parts.length) uri.hash = "/" + parts.join("/");
      else uri.href = location.file + "#";
    }
    node.$ref = uri.href;
    if (uri.href !== original) node[origin] = original;
  }
  return { marker, origin, errors: [...new Set(errors)] };
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
