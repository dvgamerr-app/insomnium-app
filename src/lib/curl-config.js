/** Read explicitly supplied curl config contents as literal argv. Never read paths.
 * @param {string} text @param {(option:string)=>boolean} takesValue @returns {string[]} */
export function curlConfigWords(text, takesValue) {
  if (text.length > 1024 * 1024 || text.includes("\0"))
    throw new Error("cURL config exceeds 1 MiB or contains NUL.");
  const words = ["curl"];
  const append = (/** @type {string} */ value) => {
    words.push(value);
    if (words.length > 20000)
      throw new Error("Too many cURL config arguments.");
  };
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trimStart();
    if (!line || line.startsWith("#")) continue;
    const fail = () =>
      new Error(
        `Invalid cURL config at line ${index + 1}. Use one option per line.`,
      );
    const match = /^(-:|[^\s:=]+)([ \t]*)([:=]?)([ \t]*)(.*)$/.exec(line);
    if (!match) throw fail();
    const [, name, spacing, separator, , tail] = match;
    if (
      !/^(?:--?[A-Za-z0-9:.-]+|[A-Za-z][A-Za-z0-9.-]*)$/.test(name) ||
      (name.startsWith("-") && separator)
    )
      throw fail();
    const option = name.startsWith("-") ? name : "--" + name;
    const required = takesValue(option);
    append(option);
    let value = tail.trimEnd();
    if (!spacing && !separator && value) throw fail();
    if (!value) {
      if (separator || required) throw fail();
      continue;
    }
    if (!required) throw fail();
    if (value.startsWith('"')) {
      let decoded = "",
        closed = false;
      for (let i = 1; i < value.length; i++) {
        const char = value[i];
        if (char === '"') {
          if (value.slice(i + 1).trim()) throw fail();
          closed = true;
          break;
        }
        if (char === "\\") {
          const next = value[++i];
          if (next === undefined) throw fail();
          decoded += { n: "\n", r: "\r", t: "\t", v: "\v" }[next] ?? next;
        } else decoded += char;
      }
      if (!closed) throw fail();
      value = decoded;
    } else if (/\s/.test(value) || /^[=:]/.test(value)) throw fail();
    append(value);
  }
  return words;
}
