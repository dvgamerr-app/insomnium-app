import {
  jsonStringContext,
  serializeTemplateArgument,
} from "./template-authoring.js";

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
      const identifier = /^[A-Za-z_$][\w$]*$/.test(name) &&
        !["true","false","none","null"].includes(name);
      const path = identifier ? (prefix ? `${prefix}.${name}` : name)
        : `${prefix || "_"}[${serializeTemplateArgument({type:"string",value:name})}]`;
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
  const variable = /{{\s*((?:[\w$.]|\[(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")\])*(?:\[(?:'(?:\\.|[^'\\])*|"(?:\\.|[^"\\])*)?)?)$/.exec(before);
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
  const from = cursor - word.length;
  let to = from, quote = "";
  for (; to < line.length; to++) {
    const char = line[to];
    if (quote) {
      if (line.slice(to,to + 2) === "}}" && !line.slice(to + 2).includes(quote)) break;
      if (char === "\\") to++;
      else if (char === quote) quote = "";
    } else if ((char === "'" || char === '"') && line[to - 1] === "[") quote = char;
    else if (!/[\w$.\[\]]/.test(char)) break;
  }
  const closing = variable ? /^\s*}}/.exec(line.slice(to))?.[0] : null;
  const expressionContinues = variable && /^\s*(?:\||[+*/%~<>!=?-]|\b(?:and|or|if|in|is)\b)/.test(line.slice(to));
  if (closing) to += closing.length;
  const list = paths
    .filter((path) => path.toLowerCase().startsWith(query.toLowerCase()))
    .slice(0, 100)
    .map((path) => ({
      text: variable ? `${path.startsWith("_[") ? "" : alias}${path}${expressionContinues ? "" : " }}"}` : `{{ ${path.startsWith("_[") ? "" : alias}${path} }}`,
      displayText: `${path.startsWith("_[") ? "" : alias}${path}`,
    }));
  return { list, from, to };
}

/** Match decoded template expressions while replacing only their JSON source.
 * @param {string} line @param {number} cursor @param {string[]} paths @param {boolean} force
 * @param {ReturnType<typeof jsonStringContext>} [context] */
export function jsonEnvironmentHints(line, cursor, paths, force = false,
  context = jsonStringContext(line, cursor, cursor)) {
  // A cursor in the middle of an escape has no decoded character boundary.
  if (!context || context.offsets[context.start] !== cursor) return null;
  const hints = environmentHints(context.value, context.start, paths, force);
  if (!hints) return null;
  return {
    from: context.offsets[hints.from],
    to: context.offsets[hints.to],
    list: hints.list.map(hint => ({
      ...hint,
      text: JSON.stringify(hint.text).slice(1, -1),
    })),
  };
}
