/** Names only: completion must not render or expose environment values.
 * @param {Record<string, any>} environment
 */
export function environmentPaths(environment) {
  /** @type {string[]} */ const paths = [];
  const ancestors = new Set();
  /** @param {any} value @param {string} prefix @param {number} depth */
  function visit(value, prefix, depth) {
    if (
      !value ||
      typeof value !== "object" ||
      depth > 12 ||
      ancestors.has(value)
    )
      return;
    ancestors.add(value);
    for (const name of Object.keys(value)) {
      if (paths.length >= 2000) break;
      // Bracket/quoted paths need the pending template-runtime migration.
      if (!/^(?:[A-Za-z_$][\w$]*|\d+)$/.test(name)) continue;
      const path = prefix ? `${prefix}.${name}` : name;
      paths.push(path);
      const property = Object.getOwnPropertyDescriptor(value, name);
      if (property && "value" in property)
        visit(property.value, path, depth + 1);
    }
    ancestors.delete(value);
  }
  visit(environment, "", 0);
  return paths.sort();
}

/** @param {string} line @param {number} cursor @param {string[]} paths @param {boolean} force */
export function environmentHints(line, cursor, paths, force = false) {
  const before = line.slice(0, cursor);
  const variable = /{{\s*([\w$.]*)$/.exec(before);
  if (!variable && !force) return null;
  // Do not offer variables inside an unsupported tag or expression.
  if (
    !variable &&
    (before.lastIndexOf("{%") > before.lastIndexOf("%}") ||
      before.lastIndexOf("{{") > before.lastIndexOf("}}"))
  )
    return null;
  const word = variable ? variable[1] : /[\w$.]*$/.exec(before)?.[0] || "";
  const alias = word.startsWith("_.") ? "_." : "";
  const query = alias ? word.slice(2) : word;
  const suffix = /^[\w$.]*/.exec(line.slice(cursor))?.[0] || "";
  let to = cursor + suffix.length;
  if (variable) to += /^\s*}}/.exec(line.slice(to))?.[0].length || 0;
  const list = paths
    .filter((path) => path.toLowerCase().startsWith(query.toLowerCase()))
    .slice(0, 100)
    .map((path) => ({
      text: variable ? `${alias}${path} }}` : `{{ ${alias}${path} }}`,
      displayText: `${alias}${path}`,
    }));
  return { list, from: cursor - word.length, to };
}
