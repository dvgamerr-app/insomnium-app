import { parseCurlForm } from "./curl-form.js";
import { expandCurlUrl } from "./curl-url-glob.js";
import { curlConfigWords } from "./curl-config.js";
import { curlProxyUrl } from "./request-proxy.js";
import { curlTimeout } from "./request-timeouts.js";
import { curlHeader, curlOptionHeader } from "./curl-headers.js";
import { id, newRequest } from "./model.js";

// Parse pasted text only. Never run curl, a shell, expansions, or file reads.
const MAX_INPUT = 1024 * 1024;
const MAX_WORDS = 20000;

/**
 * Convert Windows cmd (caret escapes) and PowerShell (backtick continuation)
 * pastes into the Bash quoting the parser understands. Text only; nothing runs.
 * @param {string} text
 */
function normalizeShell(text) {
  if (text.length > MAX_INPUT)
    throw new Error("cURL import exceeds 1 MiB of text.");
  // cmd: ^ escapes the next character and ^<newline> continues the line.
  if (/\^"|\^[ \t]*\r?\n/.test(text))
    return text.replace(/\^\r?\n/g, " ").replace(/\^([\s\S])/g, "$1");
  // PowerShell: a trailing backtick continues the line.
  return text.replace(/\x60[ \t]*\r?\n/g, " ");
}

/** @param {string} text */
function commands(text) {
  text = normalizeShell(text);
  if (text.length > MAX_INPUT)
    throw new Error("cURL import exceeds 1 MiB of text.");
  if (text.includes("\0")) throw new Error("cURL commands cannot contain NUL.");
  /** @type {string[][]} */
  const result = [];
  /** @type {string[]} */
  let words = [];
  let word = "",
    started = false,
    quote = "",
    count = 0;
  /** @type {number[]|null} */
  let wordBytes = null;
  const utf8 = new TextEncoder();
  const appendWordBytes = () => {
    if (wordBytes === null) wordBytes = [];
    for (const byte of utf8.encode(word)) wordBytes.push(byte);
    word = "";
    return wordBytes;
  };
  const flush = () => {
    if (!started) return;
    if (++count > MAX_WORDS) throw new Error("Too many cURL arguments.");
    if (wordBytes !== null) {
      appendWordBytes();
      try {
        // Decode the entire argument, including adjacent quoted segments.
        // Keep a leading BOM as data; never replace invalid shell bytes.
        word = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
          new Uint8Array(wordBytes),
        );
      } catch {
        throw new Error(
          "cURL byte escapes must form valid UTF-8. Select a binary file for other bytes.",
        );
      }
      wordBytes = null;
    }
    words.push(word);
    word = "";
    started = false;
  };
  const finish = () => {
    flush();
    if (words.length) result.push(words);
    words = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote === "'") {
      if (c === "'") quote = "";
      else word += c;
      continue;
    }
    if (quote === "ansi") {
      if (c === "'") {
        quote = "";
        continue;
      }
      if (c !== "\\") {
        word += c;
        continue;
      }
      const next = text[++i];
      const escapes = {
        a: "\x07",
        b: "\b",
        e: "\x1b",
        E: "\x1b",
        f: "\f",
        n: "\n",
        r: "\r",
        t: "\t",
        v: "\v",
        "\\": "\\",
        "'": "'",
        '"': '"',
        "?": "?",
      };
      if (Object.hasOwn(escapes, next))
        word += escapes[/** @type {keyof typeof escapes} */ (next)];
      else if (/[0-7xuU]/.test(next || "")) {
        const octal = /[0-7]/.test(next);
        const length = octal ? 3 : next === "x" ? 2 : next === "u" ? 4 : 8;
        const start = octal ? i : i + 1;
        const digits = text
          .slice(start, start + length)
          .match(octal ? /^[0-7]+/ : /^[\da-fA-F]+/)?.[0];
        if (!digits) throw new Error("Invalid ANSI-C escape in cURL command.");
        const byteEscape = octal || next === "x";
        const code = byteEscape
          ? parseInt(digits, octal ? 8 : 16) & 255
          : parseInt(digits, 16);
        if (!code || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff))
          throw new Error("Invalid Unicode or NUL escape in cURL command.");
        if (byteEscape) {
          appendWordBytes().push(code);
        } else word += String.fromCodePoint(code);
        i = start + digits.length - 1;
      } else throw new Error("Unsupported ANSI-C escape in cURL command.");
      continue;
    }
    if (c === "\\") {
      const next = text[i + 1];
      if (next === "\n") {
        i++;
        continue;
      }
      if (next === "\r" && text[i + 2] === "\n") {
        i += 2;
        continue;
      }
      if (next === undefined)
        throw new Error("Unfinished escape in cURL command.");
      if (quote === '"' && !["$", "\x60", '"', "\\"].includes(next))
        word += "\\";
      else {
        word += next;
        i++;
      }
      started = true;
      continue;
    }
    if (quote === '"' && c === '"') {
      quote = "";
      continue;
    }
    if (c === "$" && !quote && text[i + 1] === "'") {
      started = true;
      quote = "ansi";
      i++;
      continue;
    }
    if (
      c === "\x60" ||
      (c === "$" && /[\w{('"?@*#$!0-9-]/.test(text[i + 1] || ""))
    )
      throw new Error(
        "Shell expansion is not supported. Paste a cURL command with literal values.",
      );
    if (quote === '"') {
      word += c;
      continue;
    }
    if (c === "'" || c === '"') {
      started = true;
      quote = c;
      continue;
    }
    if (c === "#" && !started) {
      while (i < text.length && text[i] !== "\n") i++;
      finish();
      continue;
    }
    if (c === ";" || c === "\n" || c === "\r") {
      finish();
      continue;
    }
    if (/\s/.test(c)) {
      flush();
      continue;
    }
    if ("|&<>()".includes(c))
      throw new Error(
        "Shell operators are not supported. Quote literal URLs and values.",
      );
    word += c;
    started = true;
  }
  if (quote) throw new Error("Unclosed quote in cURL command.");
  finish();
  if (!result.length) throw new Error("Paste a cURL command.");
  return result;
}

const aliases = /** @type {Record<string, string>} */ ({
  ":": "next",
  X: "request",
  H: "header",
  u: "user",
  b: "cookie",
  d: "data",
  F: "form",
  G: "get",
  I: "head",
  L: "location",
  A: "user-agent",
  e: "referer",
  g: "globoff",
  s: "silent",
  S: "show-error",
  v: "verbose",
  i: "include",
  N: "no-buffer",
  k: "insecure",
  x: "proxy",
  U: "proxy-user",
  m: "max-time",
  T: "upload-file",
});
const values = new Set([
  "upload-file",
  "max-time",
  "connect-timeout",
  "proxy",
  "proxy-user",
  "aws-sigv4",
  "oauth2-bearer",
  "url",
  "request",
  "header",
  "user",
  "cookie",
  "data",
  "data-raw",
  "data-ascii",
  "data-binary",
  "data-urlencode",
  "form",
  "form-string",
  "user-agent",
  "referer",
  "json",
  "url-query",
]);
const flags = new Set([
  "proxy-basic",
  "proxy-digest",
  "proxy-ntlm",
  "compressed",
  "no-compressed",
  "insecure",
  "no-insecure",
  "ntlm",
  "next",
  "get",
  "head",
  "location",
  "no-location",
  "globoff",
  "silent",
  "show-error",
  "verbose",
  "include",
  "no-buffer",
  "basic",
  "digest",
]);

/** @param {string[]} words */
function options(words) {
  if (!/^curl(?:\.exe)?$/i.test(words[0]))
    throw new Error("Every imported command must start with curl or curl.exe.");
  /** @type {{name: string, value: string}[]} */
  const entries = [];
  let positional = false;
  for (let i = 1; i < words.length; i++) {
    const token = words[i];
    if (!positional && token === "--") {
      positional = true;
      continue;
    }
    if (positional || !token.startsWith("-")) {
      entries.push({ name: "url", value: token });
      continue;
    }
    const long = token.startsWith("--");
    const equal = long ? token.indexOf("=") : -1;
    const names = long
      ? [token.slice(2, equal < 0 ? undefined : equal)]
      : token.slice(1).split("");
    if (!names.length) throw new Error("Invalid cURL option.");
    for (let j = 0; j < names.length; j++) {
      const name = long ? names[j] : aliases[names[j]];
      if (!name || (!values.has(name) && !flags.has(name)))
        throw new Error(
          "Unsupported cURL option: " +
            (long ? "--" + names[j] : "-" + names[j]),
        );
      if (flags.has(name)) {
        if (equal >= 0)
          throw new Error("cURL flag does not take a value: --" + name);
        entries.push({ name, value: "" });
        continue;
      }
      let value;
      if (equal >= 0) value = token.slice(equal + 1);
      else if (!long && j + 1 < names.length)
        value = names.slice(j + 1).join("");
      else value = words[++i];
      if (value === undefined)
        throw new Error("Missing value for cURL option --" + name);
      entries.push({ name, value });
      break;
    }
  }
  return entries;
}

/** @param {string} value */
function encodedData(value) {
  const equal = value.indexOf("=");
  if (equal < 0 && value.includes("@"))
    throw new Error(
      "cURL --data-urlencode file inputs must be replaced with literal contents.",
    );
  const content = equal < 0 ? value : value.slice(equal + 1);
  const encoded = encodeURIComponent(content).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
  const formEncoded = encoded.replaceAll("%20", "+");
  return equal > 0 ? value.slice(0, equal) + "=" + formEncoded : formEncoded;
}

/** @param {string} url @param {string} query */
function appendQuery(url, query) {
  query = query.replace(/%[\da-fA-F]{2}/g, (value) => value.toUpperCase());
  const hash = url.indexOf("#");
  const head = hash < 0 ? url : url.slice(0, hash);
  return (
    head +
    (head.includes("?") ? (/[?&]$/.test(head) ? "" : "&") : "?") +
    query +
    (hash < 0 ? "" : url.slice(hash))
  );
}

/** @param {string[]} words @param {string} workspaceId @param {{name:string,value:string}[]} entries
 * @param {(string|undefined)[]} [uploadFiles] */
function requestsFor(words, workspaceId, entries, uploadFiles = []) {
  const all = (/** @type {string} */ name) =>
    entries.filter((e) => e.name === name).map((e) => e.value);
  const has = (/** @type {string} */ name) =>
    entries.some((e) => e.name === name);
  const last = (/** @type {string} */ name) => all(name).at(-1);
  const urls = all("url");
  const requestTimeout = curlTimeout(last("max-time"), 0);
  const connectTimeout = curlTimeout(last("connect-timeout"), 300000) || 300000;
  const proxy = last("proxy");
  const proxyUser = last("proxy-user");
  const proxyAuth = ["basic", "digest", "ntlm"].filter(mode => has("proxy-" + mode));
  if (proxyAuth.length > 1)
    throw new Error("Combined cURL proxy authentication modes are not supported.");
  if (proxyAuth.length && !proxy)
    throw new Error("cURL proxy authentication requires an explicit nonempty --proxy.");
  const proxyUrl = curlProxyUrl(proxy ?? "", proxyUser);
  if (proxyAuth.some(mode => mode !== "basic") && !/^https?:/i.test(proxyUrl))
    throw new Error("Digest and NTLM proxy authentication require an HTTP(S) proxy.");
  if (!urls.length) throw new Error("cURL command has no URL.");
  /** @type {Record<string, any>[]} */
  const headers = [];
  for (const value of all("header")) {
    if (value.startsWith("@")) {
      const file = value.slice(1);
      if (!file || file === "-" || file.length > 8192 || /[\0\r\n]/.test(file))
        throw new Error("cURL header files require a named path of at most 8192 characters. Header stdin is not supported.");
      headers.push({ name: "", value: "", disabled: false, _curlHeaderFile: file });
    } else headers.push(curlHeader(value));
  }
  const optionHeader = headers.some(header => header._curlHeaderFile) ? curlOptionHeader
    : (/** @type {Record<string,any>} */row) => row;
  const autoReferer=Boolean(last('referer')?.endsWith(';auto'))&&!headers.some(h=>h.name.toLowerCase()==='referer');
  for (const [option, header] of [
    ["user-agent", "User-Agent"],
    ["referer", "Referer"],
  ]) {
    const value = last(option);
    if (
      value !== undefined &&
      !headers.some((h) => h.name.toLowerCase() === header.toLowerCase())
    ) {
      const content=option==='referer'&&value.endsWith(';auto')?value.slice(0,-5):value;
      if(option==='referer'&&!content)continue;
      headers.push(optionHeader({
        name: header,
        value:content,
        disabled: option === "user-agent" && !value,
      }));
    }
  }
  const cookies = all("cookie");
  if (cookies.some((c) => !c.includes("=")))
    throw new Error(
      "cURL cookie files are not supported. Paste name=value cookies.",
    );
  if (cookies.length) {
    const existing = headers.find((h) => h.name.toLowerCase() === "cookie");
    // An explicit Cookie header overrides --cookie regardless of option order.
    if (!existing) headers.push(optionHeader({ name: "Cookie", value: cookies.join("; ") }));
  }
  /** @type {Record<string, any>} */
  let authentication = {};
  const user = last("user");
  if (user !== undefined) {
    const colon = user.indexOf(":");
    if (colon < 0)
      throw new Error(
        "cURL interactive passwords are not supported. Include user:password.",
      );
    const authType =
      entries.filter((e) => ["basic", "digest", "ntlm"].includes(e.name)).at(-1)
        ?.name || "basic";
    authentication = {
      type: authType,
      username: user.slice(0, colon),
      password: user.slice(colon + 1),
    };
  } else if (has("digest"))
    throw new Error("cURL --digest requires --user user:password.");
  if (has("ntlm")) {
    if (has("basic") || has("digest") || has("oauth2-bearer"))
      throw new Error(
        "Combined cURL NTLM authentication negotiation is not supported. Import one authentication method.",
      );
    if (user === undefined || !authentication.username)
      throw new Error(
        "cURL NTLM requires explicit --user username:password; automatic OS sign-in is not supported.",
      );
    authentication = {
      ...authentication,
      type: "ntlm",
      domain: "",
      workstation: "",
    };
  }
  const bearer = last("oauth2-bearer");
  if (bearer !== undefined) {
    if (!bearer || /[\r\n\0]/.test(bearer))
      throw new Error(
        "cURL Bearer token must be nonempty and contain no line breaks.",
      );
    if (has("basic") || has("digest"))
      throw new Error(
        "Combining cURL Bearer with explicit Basic/Digest negotiation is not supported. Import one authentication method.",
      );
    authentication = { type: "bearer", token: bearer, prefix: "Bearer" };
  }
  const awsSigv4 = last("aws-sigv4");
  if (awsSigv4 !== undefined) {
    if (headers.some(header => header._curlHeaderFile))
      throw new Error("Resolve cURL AWS signing headers explicitly before importing a header file.");
    if (["basic", "digest", "ntlm", "oauth2-bearer"].some(has))
      throw new Error("Import cURL AWS signing with one authentication method.");
    const [provider, headerProvider, region = "", service = "", ...extra] =
      awsSigv4.split(":");
    if (provider !== "aws" || headerProvider !== "amz" || extra.length ||
        !/^[a-z0-9-]*$/.test(region) || !/^[a-z0-9-]*$/.test(service))
      throw new Error("cURL AWS signing supports aws:amz[:region[:service]].");
    if (user === undefined || !authentication.username || !authentication.password)
      throw new Error("cURL AWS signing requires --user accessKey:secretKey.");
    // curl respects these overrides; the native signer regenerates them.
    if (headers.some((header) =>
      ["authorization", "x-amz-date", "x-amz-content-sha256", "date"]
        .includes(header.name.toLowerCase())))
      throw new Error("cURL AWS signing with manual authorization, date or payload-hash headers is not supported.");
    const tokens = headers.filter((header) =>
      header.name.toLowerCase() === "x-amz-security-token");
    if (tokens.length > 1)
      throw new Error("cURL AWS signing supports one session-token header.");
    authentication = {
      type: "iam",
      accessKeyId: authentication.username,
      secretAccessKey: authentication.password,
      sessionToken: tokens[0]?.value || "",
      region,
      service,
      addAuthDataToQuery: false,
    };
  }
  const data = entries.filter((e) =>
    [
      "data",
      "data-raw",
      "data-ascii",
      "data-binary",
      "data-urlencode",
      "json",
    ].includes(e.name),
  );
  const forms = entries.filter((e) => ["form", "form-string"].includes(e.name));
  if (
    (forms.length && (data.length || has("get") || has("head"))) ||
    (data.length && has("head") && !has("get"))
  )
    throw new Error("Conflicting cURL body/method options.");
  if (has("json") && data.some((e) => e.name !== "json"))
    throw new Error(
      "Mixing --json with other cURL data options is not supported.",
    );
  const fileInputs = data.filter((e) =>
    e.name === "data-urlencode"
      ? !e.value.includes("=") && e.value.includes("@")
      : e.name !== "data-raw" && e.value.startsWith("@"),
  );
  let fileBody = null;
  if (fileInputs.length) {
    if (data.length > 1 || has("get")) {
      fileBody = {
        mimeType: "application/octet-stream",
        text: "",
        params: [],
        curlJoin: has("json") ? "json" : "form",
        curlQuery: has("get"),
        curlSegments: data.map((entry) => {
          if (!fileInputs.includes(entry))
            return {
              id: id("part"),
              type: "literal",
              value:
                entry.name === "data-urlencode"
                  ? encodedData(entry.value)
                  : entry.value,
            };
          const at = entry.value.indexOf("@"),
            fileName = entry.value.slice(at + 1);
          if (!fileName) throw new Error("Choose a nonempty cURL body file reference.");
          return {
            id: id("part"),
            type: "file",
            fileName,
            ...(fileName === "-" ? { curlStdin: true } : {}),
            curlFileMode: entry.name,
            curlFilePrefix:
              entry.name === "data-urlencode" && at > 0
                ? entry.value.slice(0, at) + "="
                : "",
          };
        }),
      };
    } else {
      const entry = fileInputs[0];
      const at = entry.value.indexOf("@");
      const fileName = entry.value.slice(at + 1);
      if (!fileName) throw new Error("Choose a nonempty cURL body file reference.");
      fileBody = {
        mimeType: "application/octet-stream",
        text: "",
        params: [],
        fileName,
        ...(fileName === "-" ? { curlStdin: true } : {}),
        curlFileMode: entry.name,
        curlFilePrefix:
          entry.name === "data-urlencode" && at > 0
            ? entry.value.slice(0, at) + "="
            : "",
      };
    }
  }
  const chunks = fileBody
    ? []
    : data.map((e) => {
        if (e.name === "data-urlencode") return encodedData(e.value);
        if (e.name !== "data-raw" && e.value.startsWith("@"))
          throw new Error(
            "cURL data files/stdin are not supported. Paste literal contents or select a file in the request editor.",
          );
        return e.value;
      });
  const text = chunks.reduce(
    (text, chunk) => text + (text && !has("json") ? "&" : "") + chunk,
    "",
  );
  /** @type {Record<string, any>} */
  let body = { mimeType: "", text: "", params: [] };
  if (data.length && !has("get")) {
    const contentType = headers.find(
      (h) => h.name.toLowerCase() === "content-type",
    );
    const mime =
      contentType?.value.split(";")[0].trim() ||
      (has("json") ? "application/json" : "application/x-www-form-urlencoded");
    if (!contentType) headers.push(optionHeader({ name: "Content-Type", value: mime }));
    // Keep exact wire text; the form editor would decode/re-encode %, + and bare fields.
    body = {
      mimeType: [
        "application/x-www-form-urlencoded",
        "application/octet-stream",
        "multipart/form-data",
        "application/graphql",
      ].includes(mime)
        ? "text/plain"
        : mime,
      text,
      params: [],
    };
  }
  if (fileBody) body = fileBody;
  if (
    has("json") &&
    !headers.some((h) => h.name.toLowerCase() === "content-type")
  )
    headers.push(optionHeader({ name: "Content-Type", value: "application/json" }));
  if (has("json") && !headers.some((h) => h.name.toLowerCase() === "accept"))
    headers.push(optionHeader({ name: "Accept", value: "application/json" }));
  if (forms.length) {
    const params = forms.map(({ name, value }) =>
      parseCurlForm(value, name === "form-string"),
    );
    body = { mimeType: "multipart/form-data", text: "", params };
  }
  if (uploadFiles.some(file => file !== undefined) && (data.length || forms.length || has("head") || has("get")))
    throw new Error("cURL file uploads cannot be combined with data, form, head or get options.");
  const method =
    last("request") ??
    (has("head")
      ? "HEAD"
      : has("get")
        ? "GET"
        : data.length || forms.length
          ? "POST"
          : "GET");
  if (!/^[!#$%&'*+\-.^_\x60|~\da-zA-Z]+$/.test(method))
    throw new Error("Invalid cURL HTTP method.");
  if (has("head") && method !== "HEAD")
    throw new Error(
      "cURL --head combined with a different --request method is not supported.",
    );
  if (awsSigv4 !== undefined && (forms.length || fileBody || uploadFiles.some(file => file !== undefined) ||
      (data.length && !has("get") && method !== "POST")))
    throw new Error("cURL AWS signing currently supports buffered POST data or requests without a body.");
  const location =
    entries.filter((e) => ["location", "no-location"].includes(e.name)).at(-1)
      ?.name === "location";
  return urls.map((url, index) => {
    if (!/^https?:\/\//i.test(url))
      throw new Error(
        "cURL import requires an explicit http:// or https:// URL.",
      );
    try {
      new URL(url);
    } catch {
      throw new Error("Invalid cURL URL.");
    }
    if (has("get") && data.length && !fileBody) url = appendQuery(url, text);
    // curl replaces the accumulated --url-query when --get has data, even empty.
    for (const query of has("get") && data.length ? [] : all("url-query"))
      url = appendQuery(
        url,
        query.startsWith("+") ? query.slice(1) : encodedData(query),
      );
    return newRequest(workspaceId, {
      name: url,
      url,
      method: uploadFiles[index] !== undefined ? last("request") ?? "PUT" : method,
      headers: structuredClone(headers),
      authentication: structuredClone(authentication),
      body: uploadFiles[index] !== undefined ? {
        mimeType: "application/octet-stream", text: "", params: [],
        fileName: uploadFiles[index], curlFileMode: "upload-file",
      } : structuredClone(body),
      settingFollowRedirects: location ? "on" : "off",
      settingProxy: proxy === undefined ? "global" : proxy === "" ? "off" : "custom",
      settingProxyUrl: proxyUrl,
      settingProxyBasicAuth: Boolean(proxy) && (proxyAuth[0] ?? "basic") === "basic",
      settingProxyAuth: proxy ? proxyAuth[0] ?? "basic" : "auto",
      settingRequestTimeout: requestTimeout,
      settingConnectTimeout: connectTimeout,
      settingDecodeResponse: entries.filter((e) => ["compressed", "no-compressed"].includes(e.name)).at(-1)?.name === "compressed",
      settingAutoReferer:autoReferer,
      settingValidateCertificates:
        entries.filter((e) => ["insecure", "no-insecure"].includes(e.name)).at(-1)?.name === "insecure"
          ? "off"
          : "on",
      settingEncodeUrl: false,
      _curlSource: words,
    });
  });
}

/** @param {string} text */
export function isCurlImport(text) {
  return /^\s*(?:\x60|\^|&\s*)?curl(?:\.exe)?(?:\s|$)/i.test(text) || isCurlConfig(text);
}

/** @param {string} text */
export function isCurlConfig(text) {
  if (/^\s*#\s*curl\s+config\b/i.test(text)) return true;
  if (/^\s*(?:openapi|swagger)\s*:/m.test(text)) return false;
  const first = text.split(/\r?\n/).find((line) => line.trim() && !line.trimStart().startsWith("#"))?.trimStart() || "";
  const token = /^([^\s:=]+)/.exec(first)?.[1] || "";
  const name = token.startsWith("--") ? token.slice(2) : token.startsWith("-") ? aliases[token.slice(1)] : token;
  return (values.has(name) || flags.has(name)) && /^\s*(?:url(?:[ \t]+|[ \t]*[:=])|--url[ \t]+)/m.test(text);
}

/**
 * Fields of one cURL request, for filling an existing request without discarding others.
 * @param {string} text
 */
export function curlRequestPatch(text) {
  const requests = curlResources(text).filter((r) => r._type === "request");
  if(requests.length>1)throw Error('This cURL input contains multiple requests. Use Import collection to keep all requests.');
  const request = requests[0];
  if (!request) throw new Error("cURL command has no URL.");
  return {
    url: request.url,
    method: request.method,
    headers: request.headers,
    parameters: [],
    authentication: request.authentication,
    body: request.body,
    settingFollowRedirects: request.settingFollowRedirects,
    settingProxy: request.settingProxy,
    settingProxyUrl: request.settingProxyUrl,
    settingProxyBasicAuth: request.settingProxyBasicAuth,
    settingProxyAuth: request.settingProxyAuth,
    settingRequestTimeout: request.settingRequestTimeout,
    settingConnectTimeout: request.settingConnectTimeout,
    settingDecodeResponse: request.settingDecodeResponse,
    settingAutoReferer: request.settingAutoReferer,
    settingValidateCertificates: request.settingValidateCertificates,
    settingEncodeUrl: false,
    _curlSource: request._curlSource,
  };
}

/** @param {string} text @param {{config?:boolean}} [importOptions] */
export function curlResources(text, importOptions = {}) {
  const workspaceId = id("wrk");
  const parsed = importOptions.config || isCurlConfig(text) ? [curlConfigWords(text, (option) => {
    const name = option.startsWith("--") ? option.slice(2) : aliases[option.slice(1)];
    if (!name || (!values.has(name) && !flags.has(name)))
      throw new Error("Unsupported cURL config option: " + option);
    return values.has(name);
  })] : commands(text);
  let count = 0,
    projected = 0;
  const requests = parsed.flatMap((words) => {
    /** @type {{name:string,value:string}[][]} */
    const groups = [[]];
    let stdinConsumed = false;
    for (let entry of options(words)) {
      const stdin = ["data", "data-ascii", "data-binary", "json"].includes(entry.name)
        ? entry.value === "@-"
        : entry.name === "data-urlencode" && !entry.value.includes("=") && entry.value.includes("@")
          && entry.value.slice(entry.value.indexOf("@") + 1) === "-";
      if (stdin) {
        // curl consumes stdin while reading data options, once per command.
        // Subsequent references, including after --next, see EOF.
        if (stdinConsumed) entry = { ...entry, value: "" };
        stdinConsumed = true;
      }
      if (entry.name === "next") groups.push([]);
      else groups[groups.length - 1].push(entry);
    }
    // Currently accepted global flags affect CLI presentation only. They have
    // no transfer state to carry. Every request-local option starts afresh.
    return groups.flatMap((entries) => {
      const globoff = entries.some((entry) => entry.name === "globoff");
      const expanded = [];
      const uploads = entries.filter(entry => entry.name === "upload-file");
      if (uploads.length > entries.filter(entry => entry.name === "url").length)
        throw new Error("Each cURL upload-file requires its own URL argument.");
      /** @type {(string|undefined)[]} */ const uploadFiles = [];
      let urlIndex = 0;
      const commandSize = words.reduce((sum, word) => sum + word.length + 1, 0);
      for (const entry of entries) {
        if (entry.name !== "url") { expanded.push(entry); continue; }
        const urls = globoff ? [entry.value] : expandCurlUrl(entry.value);
        const upload = uploads[urlIndex++]?.value;
        const files = upload === undefined ? [undefined] : globoff ? [upload] : expandCurlUrl(upload);
        if (files.some(file => file !== undefined && (!file || file === "-" || file === "." || file.length > 8192 || /[\0\r\n]/.test(file))))
          throw new Error("cURL uploads require a named file path of at most 8192 characters; stdin is not supported.");
        count += urls.length * files.length;
        projected += commandSize * urls.length * files.length;
        if (count > 1000 || projected > 8 * 1024 * 1024)
          throw new Error("cURL import expands beyond 1,000 requests or 8 MiB. Import smaller batches.");
        for (const file of files) for (const value of urls) {
          expanded.push({ name: "url", value }); uploadFiles.push(file);
        }
      }
      return requestsFor(words, workspaceId, expanded, uploadFiles);
    });
  });
  if (requests.length > 1000)
    throw new Error("cURL import exceeds 1,000 requests.");
  return [
    {
      _id: workspaceId,
      _type: "workspace",
      parentId: null,
      name: "cURL Import",
      scope: "collection",
    },
    ...requests,
  ];
}
