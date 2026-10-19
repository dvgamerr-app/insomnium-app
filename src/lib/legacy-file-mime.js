import database from "mime-db/db.json";

// Match the archived mime-types 2.1.35 database and conflict preferences,
// using browser-safe JSON rather than the package's Node path dependency.
const preference = ["nginx", "apache", undefined, "iana"];
/** @type {Record<string,{type:string,score:number}>} */
const extensions = Object.create(null);
for (const [type, definition] of Object.entries(database)) {
  const source = /** @type {{source?:string,extensions?:string[]}} */ (
    definition
  );
  const score =
    type === "application/octet-stream"
      ? Number.NEGATIVE_INFINITY
      : preference.indexOf(source.source) * 2 +
        (type.startsWith("application/") ? 1 : 0);
  for (const extension of source.extensions || []) {
    const previous = extensions[extension];
    if (
      !previous ||
      score > previous.score ||
      (score === previous.score && !previous.type.startsWith("application/"))
    )
      extensions[extension] = { type, score };
  }
}

/** Legacy lookup accepts a path or bare extension. @param {string} path */
export function lookupLegacyFileMime(path) {
  const name = ("x." + path).split(/[\\/]/).at(-1) || "";
  const dot = name.lastIndexOf(".");
  const extension =
    dot > 0 && name !== ".." ? name.slice(dot + 1).toLowerCase() : "";
  return extensions[extension]?.type || "application/octet-stream";
}

/** Match mime-types 2.1.35 extension(type), including MIME parameters.
 * @param {string} type @returns {string|false} */
export function legacyMimeExtension(type) {
  const match = /^\s*([^;\s]*)(?:;|\s|$)/.exec(type);
  const entry = match && database[/** @type {keyof typeof database} */ (match[1].toLowerCase())];
  return /** @type {{extensions?:string[]}|undefined} */ (entry || undefined)?.extensions?.[0] || false;
}
