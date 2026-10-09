// Ported from Insomnium utils/url; original project license applies.
// Explicit browser package; no Node runtime is used.
import { format as urlFormat, parse as urlParse } from "url/url.js";
/** @param {string} url @param {string} [defaultProto] */
export const setDefaultProtocol = (url, defaultProto) => {
  const trimmedUrl = url.trim();
  defaultProto = defaultProto || "http:";
  if (!trimmedUrl) {
    return "";
  }
  if (trimmedUrl.indexOf("://") === -1) {
    return `${defaultProto}//${trimmedUrl}`;
  }
  return trimmedUrl;
};
const ESCAPE_REGEX_MATCH = /[-[\]/{}()*+?.\\^$|]/g;
const RFC_3986_GENERAL_DELIMITERS = ":@";
const RFC_3986_SUB_DELIMITERS = "$+,;=";
const URL_PATH_CHARACTER_WHITELIST = `${RFC_3986_GENERAL_DELIMITERS}${RFC_3986_SUB_DELIMITERS}`;
/** @param {string} url */
export const getJoiner = (url) => {
  url = url || "";
  return url.indexOf("?") === -1 ? "?" : "&";
};
/** @param {string} url @param {string} qs */
export const joinUrlAndQueryString = (url, qs) => {
  if (!qs) {
    return url;
  }
  if (!url) {
    return qs;
  }
  const [base, ...hashes] = url.split("#");
  const baseUrl = base || "";
  const joiner = getJoiner(base);
  const hash = hashes.length ? `#${hashes.join("#")}` : "";
  return `${baseUrl}${joiner}${qs}${hash}`;
};
/** @param {{name?:string,value?:string|number}} param @param {boolean} [strict] */
export const buildQueryParameter = (param, strict) => {
  strict = strict === undefined ? true : strict;
  if (strict && !param.name) {
    return "";
  }
  if (typeof param.value === "number") {
    param.value = String(param.value);
  }
  if (!strict || param.value) {
    const value = flexibleEncodeComponent(param.value || "").replace(
      /%2C/gi,
      ",",
    );
    const name = flexibleEncodeComponent(param.name || "");
    return `${name}=${value}`;
  } else {
    return flexibleEncodeComponent(param.name);
  }
};
/** @param {{name:string,value?:string}[]} parameters @param {boolean} [strict] */
export const buildQueryStringFromParams = (parameters, strict) => {
  strict = strict === undefined ? true : strict;
  const items = [];
  for (const param of parameters) {
    const built = buildQueryParameter(param, strict);
    if (!built) {
      continue;
    }
    items.push(built);
  }
  return items.join("&");
};
/** @param {string} [qs] @param {boolean} [strict] */
export const deconstructQueryStringToParams = (qs, strict) => {
  strict = strict === undefined ? true : strict;
  /** @type {{name:string,value:string}[]} */
  const pairs = [];
  if (!qs) {
    return pairs;
  }
  const stringPairs = qs.split("&");
  for (const stringPair of stringPairs) {
    const [encodedName, ...encodedValues] = stringPair.split("=");
    const encodedValue = encodedValues.join("=");
    let name = "";
    try {
      name = decodeURIComponent(encodedName || "");
    } catch (error) {
      name = encodedName;
    }
    let value = "";
    try {
      value = decodeURIComponent(encodedValue || "");
    } catch (error) {
      value = encodedValue;
    }
    if (strict && !name) {
      continue;
    }
    pairs.push({ name, value });
  }
  return pairs;
};
/** Keep the legacy query codec available for individual ordered row fragments.
 * @param {string} query @param {boolean} [encode] @param {boolean} [strict] */
export const smartEncodeQueryString = (query, encode = true, strict = true) => {
  if (!encode || !query) return query;
  const encoded = deconstructQueryStringToParams(query, strict).map(
    ({ name, value }) => ({
      name: flexibleEncodeComponent(name),
      value: flexibleEncodeComponent(value),
    }),
  );
  return buildQueryStringFromParams(encoded, strict);
};
/** @param {string} url @param {boolean} [encode] */
export const smartEncodeUrl = (url, encode) => {
  encode = encode === undefined ? true : encode;
  const urlWithProto = setDefaultProtocol(url);
  if (!encode) {
    return urlWithProto;
  } else {
    const parsedUrl = urlParse(urlWithProto);
    if (parsedUrl.pathname) {
      const segments = parsedUrl.pathname.split("/");
      parsedUrl.pathname = segments
        .map((/** @type {string} */ s) =>
          flexibleEncodeComponent(s, URL_PATH_CHARACTER_WHITELIST),
        )
        .join("/");
    }
    if (parsedUrl.query) {
      parsedUrl.query = smartEncodeQueryString(parsedUrl.query);
      parsedUrl.search = `?${parsedUrl.query}`;
    }
    return urlFormat(parsedUrl);
  }
};
export const flexibleEncodeComponent = (str = "", ignore = "") => {
  str = str.replace(/%20/g, " ");
  str = str.replace(/%([0-9a-fA-F]{2})/g, "__ENC__$1");
  for (const c of ignore) {
    const code = encodeURIComponent(c).replace("%", "");
    const escaped = c.replace(ESCAPE_REGEX_MATCH, "\\$&");
    const re2 = new RegExp(escaped, "g");
    str = str.replace(re2, `__RAW__${code}`);
  }
  str = encodeURIComponent(str);
  for (const match of str.match(/__RAW__([0-9a-fA-F]{2})/g) || []) {
    const code = match.replace("__RAW__", "");
    str = str.replace(match, decodeURIComponent(`%${code}`));
  }
  for (const match of str.match(/__ENC__([0-9a-fA-F]{2})/g) || []) {
    const code = match.replace("__ENC__", "");
    str = str.replace(match, `%${code}`);
  }
  return str;
};
