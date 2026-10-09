import { parseMediaType } from "./media-type.js";
import { encodeOpenApiContent } from "./openapi-content.js";
import {
  selectedExternalExample,
  externalExampleText,
} from "./openapi-example-assets.js";

/** Select authored HTTP representation before sampling or data-value serialization.
 * @param {Record<string,any>|undefined} parameter @param {Record<string,any>|undefined} media @param {string} version */
export function selectSerializedExample(parameter, media, version) {
  const candidates = /** @type {[Record<string,any>|undefined,string][]} */ ([
    [parameter, "parameter"],
    [media, "media"],
  ]);
  for (const [node, level] of candidates) {
    const external = selectedExternalExample(node);
    if (external)
      return { text: externalExampleText(external), level: String(level) };
    const first = Object.values(node?.examples || {})[0];
    if (
      first &&
      version.startsWith("3.2.") &&
      typeof first === "object" &&
      Object.hasOwn(first, "serializedValue")
    )
      return { text: first.serializedValue, level: String(level) };
  }
  return null;
}

/** Preserve serialized spelling; only add the destination's outer encoding.
 * @param {string} name @param {string} text
 * @param {{serializedLevel?:string,mediaType?:string,querystring?:boolean,review?:boolean}} options
 * @param {string} location */
export function serializeOpenApiSerialized(name, text, options, location) {
  /** @param {string} reason @returns {never} */
  const fail = (reason) => {
    throw new Error(`Serialized ${location} example ${name}: ${reason}`);
  };
  if (options.review) fail("review this representation before sending.");
  if (typeof text !== "string") fail("requires text.");
  if (
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
      text,
    )
  )
    fail("contains an unpaired Unicode surrogate.");
  let form = false;
  if (options.serializedLevel === "media") {
    const media = parseMediaType(options.mediaType);
    if (!media) fail("requires a valid media type.");
    const charsets = media.parameters.filter((p) => p.name === "charset");
    if (
      charsets.length > 1 ||
      (charsets.length &&
        !["utf-8", "us-ascii"].includes(charsets[0].value.toLowerCase()))
    )
      fail("requires supported UTF-8 or US-ASCII media bytes.");
    if (
      charsets[0]?.value.toLowerCase() === "us-ascii" &&
      /[^\x00-\x7f]/.test(text)
    )
      fail("contains non-ASCII text.");
    const json = /^(?:application|text)\/(?:[\w.-]+\+)?json$/.test(media.name);
    form = media.name === "application/x-www-form-urlencoded";
    if (
      !json &&
      !form &&
      !/^(?:text\/|application\/(?:[\w.-]+\+)?xml$|application\/graphql$|multipart\/)/.test(
        media.name,
      )
    )
      fail("media byte representation needs review.");
    if (json) {
      try {
        JSON.parse(text);
      } catch {
        fail("contains invalid JSON.");
      }
    }
    if (media.name.startsWith("multipart/")) {
      const boundaries = media.parameters.filter((p) => p.name === "boundary");
      if (
        boundaries.length !== 1 ||
        !/^[0-9A-Za-z'()+_,.\/:=? -]{1,70}$/.test(boundaries[0].value) ||
        boundaries[0].value.endsWith(" ")
      )
        fail("requires one valid multipart boundary.");
    }
    if (location === "body") return text;
    if (location === "path") return encodeOpenApiContent(text);
    if (location === "query" && !options.querystring)
      return `${encodeOpenApiContent(name)}=${encodeOpenApiContent(text)}`;
    if (
      location === "query" &&
      options.querystring &&
      media.name === "text/plain"
    )
      return (text.match(/%[\da-f]{2}|[\s\S]/giu) || [])
        .map((char) =>
          /^%[\da-f]{2}$/i.test(char) || /^[\w.~:/?@!$&()*+,;=-]$/.test(char)
            ? char
            : encodeOpenApiContent(char),
        )
        .join("");
    if (location === "query" && options.querystring && !form)
      return encodeOpenApiContent(text);
  } else if (options.serializedLevel !== "parameter")
    fail("requires an example level.");
  if (location === "query" || location === "path") {
    // Authored URI syntax must survive the HTTP URL parser without normalization.
    const allowed =
      location === "path"
        ? /^[\w.~!$&'()*+,;=:@%/\-]*$/
        : /^[\w.~!$&()*+,;=:@%/?\-]*$/;
    if (!allowed.test(text) || /%(?![\da-f]{2})/i.test(text))
      fail("requires valid percent-escaped URI text.");
    return text;
  }
  if (location === "header") {
    if (/[\u0000-\u0008\u000a-\u001f\u007f]/.test(text))
      fail("contains invalid header control characters.");
    return text;
  }
  if (location === "cookie") {
    const result =
      options.serializedLevel === "media" ? `${name}=${text}` : text;
    if (/[^\x20-\x7e]/.test(result))
      fail("contains invalid Cookie field characters.");
    for (const pair of result.split(";")) {
      const index = pair.indexOf("=");
      const key = pair.slice(0, index).trim();
      const value = pair.slice(index + 1);
      const unquoted =
        value.startsWith('"') && value.endsWith('"') && value.length >= 2
          ? value.slice(1, -1)
          : value;
      if (
        index < 1 ||
        !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(key) ||
        !/^[\x21\x23-\x2b\x2d-\x3a\x3c-\x5b\x5d-\x7e]*$/.test(unquoted)
      )
        fail("requires valid Cookie pairs and octets.");
    }
    return result;
  }
  fail("unsupported destination.");
  return "";
}
