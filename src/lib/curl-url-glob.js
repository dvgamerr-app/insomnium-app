// Expand curl URL arguments as data, without filesystem globbing or shell execution.
const limit = 1000;
const sizeLimit = 8 * 1024 * 1024;
const tooLarge = () => new Error("cURL import exceeds 1,000 expanded URLs.");
const tooLong = () => new Error("cURL expanded URLs exceed 8 Mi characters.");
const invalid = () =>
  new Error("Invalid cURL URL glob. Use --globoff for a literal URL.");

/** @param {string} url @returns {string[]} */
export function expandCurlUrl(url) {
  if (!/[{}\[\]]/.test(url)) return [url];
  let urls = [""],
    literal = "";
  const flush = () => {
    if (
      urls.reduce((sum, prefix) => sum + prefix.length + literal.length, 0) >
      sizeLimit
    )
      throw tooLong();
    if (literal) urls = urls.map((prefix) => prefix + literal);
    literal = "";
  };
  /** @param {string[]} choices */
  const append = (choices) => {
    if (urls.length * choices.length > limit) throw tooLarge();
    flush();
    if (
      urls.reduce((sum, prefix) => sum + prefix.length, 0) * choices.length +
        choices.reduce((sum, choice) => sum + choice.length, 0) * urls.length >
      sizeLimit
    )
      throw tooLong();
    urls = urls.flatMap((prefix) => choices.map((choice) => prefix + choice));
  };
  for (let i = 0; i < url.length; i++) {
    const char = url[i];
    if (char === "\\" && "{}[]".includes(url[i + 1] || "\0")) {
      literal += url[++i];
      continue;
    }
    if (char === "}" || char === "]") throw invalid();
    if (char === "{") {
      if (/^<[^>]{1,64}>/.test(url.slice(i + 1)))
        throw new Error(
          "Named cURL URL globs are not supported. Use an unnamed set or --globoff.",
        );
      const choices = [];
      let value = "",
        closed = false;
      for (i++; i < url.length; i++) {
        const item = url[i];
        if (item === "\\" && i + 1 < url.length) value += url[++i];
        else if (item === "{" || item === "[" || item === "]") throw invalid();
        else if (item === "," || item === "}") {
          // curl permits empty entries before a comma, but not before the close.
          if (item === "}" && !value) throw invalid();
          choices.push(value);
          if (choices.length > limit) throw tooLarge();
          value = "";
          if (item === "}") {
            closed = true;
            break;
          }
        } else value += item;
      }
      if (!closed) throw invalid();
      append(choices);
    } else if (char === "[") {
      const end = url.indexOf("]", i + 1);
      if (end < 0) throw invalid();
      const expression = url.slice(i + 1, end);
      let ipv6 = false;
      if (expression.includes(":")) {
        try {
          ipv6 = new URL("http://[" + expression + "]/").hostname.startsWith(
            "[",
          );
        } catch {
          /* A non-address must be a range. */
        }
      }
      if (!expression || ipv6) literal += url.slice(i, end + 1);
      else {
        const numeric = /^(\d+)-[ \t]*(\d+)(?::(\d+))?$/.exec(expression);
        const alpha = /^([a-zA-Z])-([a-zA-Z])(?::(\d+))?$/.exec(expression);
        if (!numeric && !alpha) throw invalid();
        const match = numeric || /** @type {RegExpExecArray} */ (alpha);
        const first = numeric
          ? BigInt(match[1])
          : BigInt(match[1].charCodeAt(0));
        const last = numeric
          ? BigInt(match[2])
          : BigInt(match[2].charCodeAt(0));
        const step = BigInt(match[3] || "1");
        const max = 9223372036854775807n;
        if (
          step < 1n ||
          first > last ||
          (first === last ? step !== 1n : step > last - first) ||
          (alpha && last - first > 25n) ||
          (numeric && (last > max || step > max - last))
        )
          throw invalid();
        const count = (last - first) / step + 1n;
        if (count > BigInt(Math.floor(limit / urls.length))) throw tooLarge();
        const width = numeric && match[1].startsWith("0") ? match[1].length : 0;
        if (width * Number(count) > sizeLimit) throw tooLong();
        const choices = [];
        for (let value = first; value <= last; value += step)
          choices.push(
            numeric
              ? String(value).padStart(width, "0")
              : String.fromCharCode(Number(value)),
          );
        append(choices);
      }
      i = end;
    } else literal += char;
  }
  flush();
  return urls;
}
