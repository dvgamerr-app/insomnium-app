import { parseDocument } from "yaml";
import { apiDocumentBaseUri } from "./openapi-document.js";

const schemes = new Set(["memory:", "file:", "http:", "https:"]);
const fail = (/** @type {string} */ message) => {
  throw new TypeError("Invalid Spectral sources: " + message);
};
const text = (/** @type {unknown} */ value) =>
  typeof value === "string" && value.length > 0;

/** Document identity only; never fetches or opens the URI.
 * @param {string} name @param {string} [base] */
export function canonicalSpectralUri(name, base = "memory:///") {
  if (!text(name)) return fail("URI");
  let uri;
  try {
    uri = new URL(name, base);
  } catch {
    return fail("URI");
  }
  if (!schemes.has(uri.protocol)) return fail("URI scheme");
  uri.hash = "";
  return uri.href;
}

/** Match the host's OpenAPI 3.2 $self policy on captured JSON/YAML.
 * @param {string} contents @param {string} name @param {string} base */
function documentUri(contents, name, base) {
  const retrieval = canonicalSpectralUri(name, base);
  // Parser findings must still be displayable. The document AST can retain
  // top-level identity fields even when another part contains a syntax error.
  const document = parseDocument(contents, { merge: true, uniqueKeys: true });
  let value;
  try {
    value = document.toJS({ maxAliasCount: 100 });
  } catch {
    return fail("document identity could not be established");
  }
  return canonicalSpectralUri(
    value && typeof value === "object" && !Array.isArray(value)
      ? apiDocumentBaseUri(value, retrieval)
      : retrieval,
  );
}

/** @param {unknown} value @param {string[]} keys */
function exact(value, keys) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    !keys.every((key) => Object.hasOwn(value, key))
  )
    fail("catalog shape");
}

/** Detached immutable JSON-frame data; does not freeze the caller's objects.
 * @template T @param {T} value @returns {T} */
function detached(value) {
  const clone = structuredClone(value),
    pending = [clone],
    seen = new Set();
  while (pending.length) {
    const item = pending.pop();
    if (!item || typeof item !== "object" || seen.has(item)) continue;
    seen.add(item);
    pending.push(...Object.values(item));
    Object.freeze(item);
  }
  return clone;
}

/** Validate full raw range without changing its coordinates.
 * @param {any} range */
function validRange(range) {
  const start = range?.start,
    end = range?.end;
  return (
    start &&
    end &&
    [start.line, start.character, end.line, end.character].every(
      (n) => Number.isInteger(n) && n >= 0,
    ) &&
    (start.line < end.line ||
      (start.line === end.line && start.character <= end.character))
  );
}

/** UTF16 offsets for CodeMirror's default canonical LF document. Raw source is
 * untouched; invalid/reversed ranges refuse, oversized positions clamp.
 * @param {string} rawSource @param {{start:{line:number,character:number},end:{line:number,character:number}}} range */
export function spectralRangeOffsets(rawSource, range) {
  if (typeof rawSource !== "string" || !validRange(range)) return fail("range");
  const lines = rawSource.split(/\r\n?|\n/),
    starts = [0];
  for (let i = 0; i < lines.length - 1; i++)
    starts.push(starts[i] + lines[i].length + 1);
  const offset = (/** @type {{line:number,character:number}} */ position) => {
    const line = Math.min(position.line, lines.length - 1);
    return starts[line] + Math.min(position.character, lines[line].length);
  };
  const start = offset(range.start),
    end = offset(range.end);
  if (start > end) return fail("clamped range reversed");
  return Object.freeze({ start, end });
}

/** Hydrate ONLY the accepted captured source and returned host catalog.
 * Unknown diagnostic sources remain unresolved; they never fall back to main.
 * @param {{fileName:string,contents:string,files:{name:string,contents:string}[]}} captured
 * @param {any[]} hostSources @param {Record<string,any>[]} [rawDiagnostics] */
export function createSpectralSourceCatalog(
  captured,
  hostSources,
  rawDiagnostics = [],
) {
  exact(captured, ["fileName", "contents", "files"]);
  if (
    !text(captured.fileName) ||
    typeof captured.contents !== "string" ||
    !Array.isArray(captured.files) ||
    !Array.isArray(hostSources) ||
    !Array.isArray(rawDiagnostics)
  )
    return fail("input");
  const mainUri = documentUri(
      captured.contents,
      captured.fileName,
      "memory:///",
    ),
    expected = new Map();
  expected.set(mainUri, {
    uri: mainUri,
    name: captured.fileName,
    contents: captured.contents,
    origin: "main",
  });
  for (const file of captured.files) {
    exact(file, ["name", "contents"]);
    if (!text(file.name) || typeof file.contents !== "string")
      return fail("attached source");
    const uri = documentUri(file.contents, file.name, mainUri);
    if (expected.has(uri)) return fail("duplicate captured URI");
    expected.set(uri, {
      uri,
      name: file.name,
      contents: file.contents,
      origin: "attached",
    });
  }
  const byUri = new Map();
  for (const entry of hostSources) {
    const local = entry?.origin === "main" || entry?.origin === "attached";
    exact(
      entry,
      local ? ["uri", "name", "origin"] : ["uri", "name", "origin", "contents"],
    );
    if (!text(entry.uri) || !text(entry.name)) return fail("catalog identity");
    const uri = canonicalSpectralUri(entry.uri);
    if (uri !== entry.uri || byUri.has(uri))
      return fail("noncanonical or duplicate catalog URI");
    const capturedSource = expected.get(uri);
    if (local) {
      if (
        !capturedSource ||
        entry.name !== capturedSource.name ||
        entry.origin !== capturedSource.origin
      )
        return fail("captured catalog mismatch");
      byUri.set(uri, detached(capturedSource));
    } else {
      const protocol = new URL(uri).protocol;
      if (
        capturedSource ||
        entry.name !== uri ||
        typeof entry.contents !== "string" ||
        !(
          (entry.origin === "remote" &&
            ["http:", "https:"].includes(protocol)) ||
          (entry.origin === "repository" &&
            ["memory:", "file:"].includes(protocol))
        )
      )
        return fail("external catalog mismatch");
      byUri.set(uri, detached(entry));
    }
  }
  for (const uri of expected.keys())
    if (!byUri.has(uri)) return fail("missing captured catalog entry");
  const diagnostics = detached(rawDiagnostics);
  for (const diagnostic of diagnostics) {
    if (
      !diagnostic ||
      !Number.isInteger(diagnostic.severity) ||
      diagnostic.severity < 0 ||
      diagnostic.severity > 3 ||
      typeof diagnostic.message !== "string" ||
      !validRange(diagnostic.range) ||
      (diagnostic.code !== undefined &&
        !(
          typeof diagnostic.code === "string" ||
          (typeof diagnostic.code === "number" &&
            Number.isFinite(diagnostic.code))
        )) ||
      (diagnostic.source !== undefined && typeof diagnostic.source !== "string")
    )
      return fail("diagnostic");
  }
  const identity = (/** @type {unknown} */ source) => {
    if (!text(source)) return null;
    try {
      return canonicalSpectralUri(/** @type {string} */ (source), mainUri);
    } catch {
      return null;
    }
  };
  const unresolvedDiagnostics = Object.freeze(
    diagnostics.filter((diagnostic) => !byUri.has(identity(diagnostic.source))),
  );
  return Object.freeze({
    mainUri,
    sources: Object.freeze([...byUri.values()]),
    diagnostics,
    unresolvedDiagnostics,
    lookup(/** @type {string} */ uri) {
      return byUri.get(identity(uri)) || null;
    },
    diagnosticsFor(/** @type {string} */ uri) {
      const target = identity(uri);
      return Object.freeze(
        byUri.has(target)
          ? diagnostics.filter(
              (diagnostic) => identity(diagnostic.source) === target,
            )
          : [],
      );
    },
  });
}
