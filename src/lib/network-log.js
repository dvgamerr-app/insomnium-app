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
  return (
    response.networkLog ||
    buildNetworkLog({
      ...response,
      url: response.url || "",
      note: "Saved response: no connection details were recorded for it",
    })
  );
}
