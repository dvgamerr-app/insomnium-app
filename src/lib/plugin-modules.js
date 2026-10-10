/** Resolve modules using only the admitted text snapshot; never host filesystem.
 * @param {Record<string,string>} files @param {string} request @param {string} parent */
export function resolvePluginModule(files, request, parent) {
  const own = (/** @type {string} */ path) => Object.hasOwn(files, path);
  const normalize = (/** @type {string} */ path) => {
    const parts = [];
    for (const part of path.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") {
        if (!parts.length) throw Error("Module path escapes the package");
        parts.pop();
      } else parts.push(part);
    }
    return parts.join("/");
  };
  const file = (/** @type {string} */ path) =>
    [path, path + ".js", path + ".json", path + ".node"].find(own);
  const index = (/** @type {string} */ path) =>
    ["js", "json", "node"]
      .map((suffix) => (path ? path + "/" : "") + "index." + suffix)
      .find(own);
  const lookup = (/** @type {string} */ path) => {
    const direct = file(path);
    if (direct) return direct;
    const manifestPath = (path ? path + "/" : "") + "package.json";
    if (own(manifestPath)) {
      const manifest = JSON.parse(files[manifestPath]);
      if (manifest.main) {
        if (
          typeof manifest.main !== "string" ||
          /[:\\]|^\//.test(manifest.main)
        )
          throw Error("Invalid module main path");
        const main = normalize((path ? path + "/" : "") + manifest.main);
        const found = file(main) || index(main);
        if (found) return found;
      }
    }
    return index(path);
  };
  if (
    typeof request !== "string" ||
    !request ||
    request.length > 8192 ||
    /[:\\]|^\//.test(request)
  )
    throw Error("Unsupported module identifier");
  const directory = parent.split("/").slice(0, -1).join("/");
  if (request.startsWith(".")) {
    const found = lookup(
      normalize((directory ? directory + "/" : "") + request),
    );
    if (found) return found;
  } else {
    if (
      !/^(?:@[a-zA-Z0-9_.-]+\/)?[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(
        request,
      )
    )
      throw Error("Unsupported dependency identifier");
    const parts = directory ? directory.split("/") : [];
    for (;;) {
      const found = lookup(
        (parts.length ? parts.join("/") + "/" : "") + "node_modules/" + request,
      );
      if (found) return found;
      if (!parts.length) break;
      parts.pop();
    }
  }
  throw Error("Module is unavailable in the package snapshot: " + request);
}

/** @param {Record<string,string>} files @param {string} path */
export function pluginModuleFormat(files, path) {
  if (path.endsWith(".mjs")) return "module";
  if (path.endsWith(".cjs")) return "commonjs";
  if (path.endsWith(".json")) return "json";
  if (!path.endsWith(".js")) throw Error("Unsupported module source: " + path);
  const parts = path.split("/").slice(0, -1);
  for (;;) {
    if (parts.at(-1) === "node_modules") return "commonjs";
    const manifest =
      (parts.length ? parts.join("/") + "/" : "") + "package.json";
    if (Object.hasOwn(files, manifest))
      return JSON.parse(files[manifest]).type === "module"
        ? "module"
        : "commonjs";
    if (!parts.length) return "commonjs";
    parts.pop();
  }
}
