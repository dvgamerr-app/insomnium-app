/** Parse only data lookups; never evaluate operators, filters or function calls.
 * @param {string} expression @returns {string[]} */
export function templateVariablePath(expression) {
  let index = 0;
  const parts = /** @type {string[]} */ ([]);
  const fail = () => new Error("Unsupported environment variable path: " + expression);
  const whitespace = () => { while (/\s/.test(expression[index] || "") && index < expression.length) index++; };
  const word = () => {
    const match = /^[\w$]+/.exec(expression.slice(index));
    if (!match) throw fail();
    index += match[0].length;
    return match[0];
  };
  whitespace();parts.push(word());
  while (index < expression.length) {
    whitespace();
    if (index === expression.length) break;
    if (expression[index] === ".") { index++;whitespace();parts.push(word());continue; }
    if (expression[index++] !== "[") throw fail();
    whitespace();
    const quote = expression[index];
    let value = "";
    if (quote === "'" || quote === '"') {
      index++;
      while (index < expression.length && expression[index] !== quote) {
        let char = expression[index++];
        if (char === "\\") {
          if (index === expression.length) throw fail();
          char = expression[index++];
          char = ({n:"\n",r:"\r",t:"\t"})[char] ?? char;
        }
        value += char;
      }
      if (expression[index++] !== quote) throw fail();
    } else {
      const match = /^\d+/.exec(expression.slice(index));
      if (!match) throw fail();
      value = String(Number(match[0]));index += match[0].length;
    }
    whitespace();
    if (expression[index++] !== "]") throw fail();
    parts.push(value);
  }
  if (parts[0] === "_" && parts.length > 1) parts.shift();
  return parts;
}

/** Locate variables without treating quoted braces as delimiters.
 * @param {string} source */
export function templateVariableReferences(source) {
  /** @type {{start:number,end:number,key:string}[]} */ const references = [];
  for (let start = source.indexOf("{{"); start >= 0;) {
    let quote = "", end = start + 2;
    for (; end < source.length - 1; end++) {
      const char = source[end];
      if (quote) {
        if (char === "\\") end++;
        else if (char === quote) quote = "";
      } else if (char === "'" || char === '"') quote = char;
      else if (source.slice(end,end + 2) === "}}") break;
    }
    if (end >= source.length - 1) break;
    references.push({start,end:end + 2,key:source.slice(start + 2,end).trim()});
    start = source.indexOf("{{",end + 2);
  }
  return references;
}
