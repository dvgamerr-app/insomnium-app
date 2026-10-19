import {
  parseDocument,
  LineCounter,
  isMap,
  isSeq,
  isAlias,
  isScalar,
} from "yaml";

/** @param {any} node @param {import('yaml').Document} document */
function resolvedAlias(node, document) {
  const seen = new Set();
  while (isAlias(node)) {
    if (seen.has(node)) return null;
    seen.add(node);
    node = node.resolve(document);
  }
  return node;
}
/** Cache lexical AST positions, without following alias use-sites into anchors.
 * Resolution uses YAML's public Alias.resolve, not matching value text.
 * @type {WeakMap<object,WeakMap<object,(string|number)[]>>} */
const astPaths = new WeakMap();
/** @param {import('yaml').Document} document @param {(string|number)[]} path */
export function apiSourceLocation(document, path) {
  let positions = astPaths.get(document);
  if (!positions) {
    positions = new WeakMap();
    /** @type {{node:any,path:(string|number)[]}[]} */
    const pending = [
        {
          node: document.contents,
          path: /** @type {(string|number)[]} */ ([]),
        },
      ],
      seen = new WeakSet();
    while (pending.length) {
      const item = pending.pop();
      if (!item?.node || typeof item.node !== "object" || seen.has(item.node))
        continue;
      seen.add(item.node);
      positions.set(item.node, item.path);
      if (isMap(item.node))
        for (const pair of item.node.items) {
          const key = resolvedAlias(pair.key, document);
          if (isScalar(key))
            pending.push({
              node: pair.value,
              path: [...item.path, String(key.value)],
            });
        }
      else if (isSeq(item.node))
        item.node.items.forEach((node, index) =>
          pending.push({ node, path: [...item.path, index] }),
        );
    }
    astPaths.set(document, positions);
  }
  let node = /** @type {any} */ (document.contents);
  for (const part of path) {
    node = resolvedAlias(node, document);
    if (isMap(node)) {
      const matches = node.items.filter((pair) => {
        const key = resolvedAlias(pair.key, document);
        return isScalar(key) && String(key.value) === String(part);
      });
      if (matches.length !== 1) return null;
      node = matches[0].value;
    } else if (isSeq(node)) {
      const index = Number(part);
      if (!Number.isInteger(index) || index < 0 || index >= node.items.length)
        return null;
      node = node.items[index];
    } else return null;
  }
  node = resolvedAlias(node, document);
  const lexical = node && positions.get(node);
  return node && lexical ? { node, path: lexical } : null;
}

export const specLimit = 2 * 1024 * 1024;
export const methods = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
];
/** OpenAPI 3.2 description URIs use the declared document identity. API server
 * URLs have a separate retrieval-base rule and must not use this helper.
 * @param {Record<string,any>} document @param {string} retrievalUri */
export function apiDocumentBaseUri(document, retrievalUri) {
  const uri = new URL(
    String(document.openapi || "").startsWith("3.2.") &&
      typeof document.$self === "string"
      ? document.$self
      : retrievalUri,
    retrievalUri,
  );
  // The filesystem identifies complete resources; reference fragments select
  // targets within them and are resolved separately.
  uri.hash = "";
  return uri.href;
}
/** @param {string} text @param {{allowBoolean?:boolean,maxBytes?:number}} [options] */
export function parseSpec(text, options = {}) {
  if (new TextEncoder().encode(text).byteLength > (options.maxBytes ?? specLimit))
    throw new Error(options.maxBytes === undefined
      ? "Each specification file is limited to 2 MiB."
      : "JSON/YAML input exceeds its size limit.");
  const lines = new LineCounter();
  const document = parseDocument(text, {
    lineCounter: lines,
    uniqueKeys: true,
  });
  if (document.errors.length) {
    const error = new Error(
      document.errors.map((error) => error.message).join("\n"),
    );
    let identity = /** @type {any} */ (undefined),
      identityUnavailable = false;
    try {
      identity = document.toJS({ maxAliasCount: 100 });
    } catch {
      identityUnavailable = true;
    }
    if (isMap(document.contents))
      for (const name of ["openapi", "$self"])
        if (
          document.contents.items.filter(
            (pair) => /** @type {any} */ (pair.key)?.value === name,
          ).length > 1
        )
          identityUnavailable = true;
    Object.assign(error, {
      parseIdentity: {
        openapi: typeof identity?.openapi === "string" ? identity.openapi : "",
        $self: typeof identity?.$self === "string" ? identity.$self : undefined,
      },
      parseIdentityUnavailable: identityUnavailable,
      parseDiagnosticCount: document.errors.length,
      parseDiagnostics: document.errors.slice(0, 500).map((issue) => {
        const start = lines.linePos(issue.pos[0]),
          end = lines.linePos(issue.pos[1]);
        return {
          severity: "error",
          message: issue.message,
          path: "",
          line: start.line,
          column: start.col,
          range: {
            start: { line: start.line - 1, character: start.col - 1 },
            end: { line: end.line - 1, character: end.col - 1 },
          },
        };
      }),
    });
    throw error;
  }
  const value = document.toJS({ maxAliasCount: 100 });
  if (options.allowBoolean && typeof value === "boolean")
    return { value, document, lines };
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected a JSON/YAML object.");
  // YAML graph aliases may be cyclic; persisted specifications and OpenAPI documents must be JSON-compatible.
  JSON.stringify(value);
  return { value, document, lines };
}

/** @param {unknown} value */
export function previewJson(value) {
  const seen = new WeakSet();
  let nodes = 0;
  return JSON.stringify(
    value,
    (_, item) => {
      if (++nodes > 10000) return "[Preview truncated]";
      if (item && typeof item === "object") {
        if (seen.has(item)) return "[Shared reference]";
        seen.add(item);
      }
      return item;
    },
    2,
  );
}
