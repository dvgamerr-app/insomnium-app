// curl -v style text for the response Timeline tab. The desktop app builds its
// own log natively; this covers browser preview and responses saved before the
// log existed. Credential headers are masked, as in the native log.
const SECRET_HEADERS = ["authorization", "proxy-authorization", "cookie"];

/** @param {string} name @param {string} value */
function masked(name, value) {
  if (!SECRET_HEADERS.includes(name.toLowerCase())) return value;
  const scheme = name.toLowerCase() !== "cookie" && value.split(" ")[0];
  return scheme && value.includes(" ") ? `${scheme} ***` : "***";
}

/**
 * @param {{method?:string,url:string,requestHeaders?:string[][],status?:number,statusText?:string,headers?:string[][],size?:number,headersMs?:number,elapsedMs?:number,note?:string}} entry
 * @returns {string[]}
 */
export function buildNetworkLog(entry) {
  let target;
  try {
    target = new URL(entry.url);
  } catch {
    target = null;
  }
  const lines = [`* ${entry.method || "GET"} ${entry.url}`];
  if (entry.note) lines.push(`* ${entry.note}`);
  if (target) {
    lines.push(
      target.protocol === "https:"
        ? "* Connection is encrypted (https); certificate details are not available here"
        : "* Connection is not encrypted (http)",
    );
    lines.push(
      `> ${entry.method || "GET"} ${target.pathname}${target.search}`,
      `> host: ${target.host}`,
    );
  }
  for (const [name, value] of entry.requestHeaders || [])
    lines.push(`> ${name}: ${masked(name, value)}`);
  lines.push(">");
  lines.push(
    `< ${entry.status ?? ""} ${entry.statusText ?? ""}`.trimEnd() +
      (entry.headersMs != null
        ? `    [${entry.headersMs} ms to response headers]`
        : ""),
  );
  for (const [name, value] of entry.headers || [])
    lines.push(`< ${name}: ${value}`);
  lines.push("<");
  lines.push(`* Received ${entry.size ?? 0} bytes`);
  if (entry.elapsedMs != null)
    lines.push(`* Finished in ${entry.elapsedMs} ms`);
  return lines;
}

/** @param {Record<string, any>} response */
export function responseNetworkLog(response) {
  if (response.error)
    return response.networkLog?.length
      ? response.networkLog
      : [`* Request failed before it was sent: ${response.error}`];
  return (
    response.networkLog ||
    buildNetworkLog({
      ...response,
      url: response.url || "",
      note: "Saved response: no connection details were recorded for it",
    })
  );
}

/**
 * @typedef {{t:string,k:string,m?:string}} Token
 * Kinds: marker, plain, meta, key, value, secret, method, path, version,
 * status-<class>, url, num, ok, off, bad, step.
 */

/** @param {string} text @returns {Token[]} */
function inline(text) {
  /** @type {Token[]} */ const out = [];
  const pattern =
    /(https?:\/\/[^\s,)]+)|(\*\*\*)|(\[NOT CURRENTLY VALID\])|(\b\d+(?:\.\d+){0,3}\b)/g;
  let last = 0;
  for (let m; (m = pattern.exec(text));) {
    if (m.index > last) out.push({ t: text.slice(last, m.index), k: "plain" });
    out.push({
      t: m[0],
      k: m[1] ? "url" : m[2] ? "secret" : m[3] ? "bad" : "num",
    });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last), k: "plain" });
  return out;
}

/** @param {string} name @param {string} value @returns {Token[]} */
function header(name, value) {
  return [
    { t: name, k: "key" },
    { t: ": ", k: "meta" },
    ...(/\*\*\*/.test(value)
      ? inline(value).map((x) => (x.k === "plain" ? { ...x, k: "value" } : x))
      : [{ t: value, k: "value" }]),
  ];
}

/** @param {string} line @returns {Token[]} */
export function tokenizeLine(line) {
  const marker = line[0];
  if (!["*", ">", "<"].includes(marker)) return inline(line);
  const rest = line.slice(1);
  /** @type {Token[]} */ const out = [{ t: marker, k: "marker", m: marker }];
  if (!rest.trim()) return out;
  const body = rest.replace(/^ /, "");
  out.push({ t: " ", k: "plain" });
  let m;
  if (marker === ">") {
    if ((m = body.match(/^([A-Za-z]+) (\S+)(?: (HTTP\/[\d.]+))?$/))) {
      out.push({ t: m[1], k: "method", m: m[1].toUpperCase() });
      out.push({ t: " ", k: "plain" }, { t: m[2], k: "path" });
      if (m[3]) out.push({ t: " ", k: "plain" }, { t: m[3], k: "version" });
      return out;
    }
  } else if (marker === "<") {
    if ((m = body.match(/^(?:(HTTP\/[\d.]+) )?(\d{3})(.*?)(\s+\[.*\])?$/))) {
      const cls = "status-" + m[2][0];
      if (m[1]) out.push({ t: m[1], k: "version" }, { t: " ", k: "plain" });
      out.push({ t: m[2] + m[3], k: cls });
      if (m[4]) out.push({ t: m[4], k: "meta" });
      return out;
    }
  }
  if (marker !== "*" && (m = body.match(/^([^\s:]+): ?(.*)$/)))
    return [...out, ...header(m[1], m[2])];
  // Informational lines.
  if (/^-{4} .* -{4}$/.test(body)) return [...out, { t: body, k: "step" }];
  if ((m = body.match(/^Settings: (.*)$/))) {
    out.push({ t: "Settings:", k: "key" }, { t: " ", k: "plain" });
    m[1].split(", ").forEach((item, i, all) => {
      const cut = item.lastIndexOf(" ");
      const state = item.slice(cut + 1);
      out.push(
        { t: item.slice(0, cut + 1), k: "meta" },
        {
          t: state,
          k: state === "on" ? "ok" : state === "off" ? "off" : "value",
        },
      );
      if (i < all.length - 1) out.push({ t: ", ", k: "meta" });
    });
    return out;
  }
  if (
    (m = body.match(/^(\s+)(subject|issuer|valid|SAN|verification):(\s+)(.*)$/))
  ) {
    const bad = /skipped|NOT CURRENTLY VALID/.test(m[4]);
    return [
      ...out.slice(0, 1),
      { t: " " + m[1] + " ", k: "plain" },
      { t: m[2], k: "key" },
      { t: ":" + m[3], k: "meta" },
      ...(m[2] === "valid"
        ? m[4]
            .split(/(\s+\[NOT CURRENTLY VALID\])/)
            .filter(Boolean)
            .map((part) => ({
              t: part,
              k: /NOT CURRENTLY/.test(part) ? "bad" : "num",
            }))
        : [{ t: m[4], k: bad ? "bad" : "value" }]),
    ];
  }
  const tone =
    /not encrypted|not exposed|not available|no connection|failed|timed out/i.test(
      body,
    )
      ? "bad"
      : "meta";
  return [
    ...out,
    ...inline(body).map((t) => (t.k === "plain" ? { ...t, k: tone } : t)),
  ];
}

/** An HTTP send failure that keeps the partial connection log. */
export class NetworkError extends Error {
  /** @param {string} message @param {string[]} networkLog */
  constructor(message, networkLog) {
    super(message);
    this.networkLog = networkLog;
  }
  toString() {
    return this.message;
  }
}

/**
 * Log for a failed browser-preview send.
 * @param {Record<string, any>} request
 * @param {string} message
 */
export function failureLog(request, message) {
  const lines = [`* ${request.method || "GET"} ${request.url}`];
  /** @type {URL|null} */ let target = null;
  try {
    target = new URL(request.url);
  } catch {
    // The URL itself is the failure.
  }
  if (target) {
    lines.push(
      `> ${request.method || "GET"} ${target.pathname}${target.search}`,
      `> host: ${target.host}`,
    );
    for (const [name, value] of request.headers || [])
      lines.push(`> ${name}: ${masked(name, value)}`);
    lines.push(">");
  }
  lines.push(`* Request failed: ${message}`);
  return lines;
}
