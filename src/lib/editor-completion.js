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

/** Canonical literal lookup tokens, including an unfinished final key.
 * No expressions are evaluated. Escapes follow Nunjucks' string lexer.
 * @param {string} source @param {boolean} partial */
function lookupKey(source, partial) {
  let index = source.startsWith("_[") ? 1 : 0, result = "";
  while (index < source.length) {
    if (source[index] === ".") {
      index++;
      if (index === source.length) return partial ? result + '["' : null;
    }
    let value = "", complete = true;
    if (source[index] === "[") {
      const numeric = /^\d+/.exec(source.slice(index + 1));
      if (numeric) {
        index += numeric[0].length + 1;
        complete = source[index] === "]";
        if (complete) index++;
        else if (!partial || index !== source.length) return null;
        // Nunjucks parses decimal integer literals before property lookup.
        // Keep this data-only; computed keys and expressions are not evaluated.
        value = String(parseInt(numeric[0], 10));
      } else {
        const quote = source[++index];
        if (quote !== "'" && quote !== '"') return null;
        index++;
        let closed = false;
        while (index < source.length) {
          let char = source[index++];
          if (char === quote) { closed = true; break; }
          if (char === "\\") {
            if (index === source.length) return null;
            char = source[index++];
            char = char === "n" ? "\n" : char === "r" ? "\r" : char === "t" ? "\t" : char;
          }
          value += char;
        }
        if (closed) {
          if (source[index++] !== "]") return null;
        } else {
          if (!partial) return null;
          complete = false;
        }
      }
    } else {
      const word = /^[\w$]+/.exec(source.slice(index));
      if (!word) return null;
      value = word[0]; index += value.length;
      complete = !partial || index < source.length;
    }
    const encoded = JSON.stringify(value.toLowerCase());
    result += "[" + (complete ? encoded + "]" : encoded.slice(0, -1));
    if (index < source.length && source[index] !== "." && source[index] !== "[")
      return null;
  }
  return result;
}

/** @param {string} line @param {number} cursor @param {string[]} paths @param {boolean} force */
export function environmentHints(line, cursor, paths, force = false) {
  const before = line.slice(0, cursor);
  const variable = /{{\s*((?:[\w$.]|\[(?:\d+|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")\])*(?:\[(?:\d+|'(?:\\.|[^'\\])*|"(?:\\.|[^"\\])*)?)?)$/.exec(before);
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
  const queryLower = query.toLowerCase();
  const lookup = lookupKey(query, true);
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
    .filter((path) => path.toLowerCase().startsWith(queryLower) ||
      (lookup !== null && lookupKey(path, false)?.startsWith(lookup)))
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
