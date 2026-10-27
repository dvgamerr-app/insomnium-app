import { parseMediaType } from './media-type.js';
import { transfer } from './request-code-multipart.js';
import { multipartEncodings, multipartHeaders } from './multipart-headers.js';

/** @typedef {{name:string|null,value?:string,valueBase64?:boolean,fileName?:string|null,contentType?:string|null,headers:string,transferEncoding?:string|null,params?:CurlPart[]}} CurlPart */
const encoder = new TextEncoder();
/** Curl_mime_contenttype deliberately uses a small extension table rather than
 * browser/OS MIME guesses. @param {string|null|undefined} name @returns {string|null} */
export function curlFileContentType(name) {
  const types = /** @type {Record<string,string>} */ ({gif:'image/gif',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',svg:'image/svg+xml',txt:'text/plain',htm:'text/html',html:'text/html',pdf:'application/pdf',xml:'application/xml'});
  return types[name?.split('.').at(-1)?.toLowerCase() ?? ''] ?? null;
}
/** Curl's default form strategy percent-escapes only quote, CR and LF.
 * @param {string} value @param {boolean} backslash */
function quoted(value, backslash) {
  if (value.includes('\0')) throw Error('Multipart metadata cannot contain NUL.');
  if (backslash) {
    if (/[\r\n]/.test(value)) throw Error('Backslash-escaped multipart metadata cannot contain line breaks.');
    return value.replace(/[\\"]/g, char => '\\' + char);
  }
  return value.replace(/["\r\n]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase());
}
/** Serialize prepared curl MIME trees without FormData normalization. Absent
 * names remain absent, and each group owns its independent MIME boundary.
 * Reference: curl lib/mime.c mime_prepare_headers/add_content_disposition.
 * @param {CurlPart[]} parts @param {string|null} [contentType] @param {boolean} [formEscape]
 * @returns {{bytes:Uint8Array,contentType:string}} */
export function curlMultipart(parts, contentType = null, formEscape = false) {
  let nodes = 0;
  const ancestors = new Set();
  /** @param {Uint8Array[]} chunks */
  function join(chunks) {
    const bytes = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return bytes;
  }
  /** @param {CurlPart[]} rows @param {string} type @param {number} depth
   * @returns {{bytes:Uint8Array,contentType:string}} */
  function group(rows, type, depth) {
    if (depth > 40 || ancestors.has(rows)) throw Error('Multipart nesting exceeds MIME limits.');
    if (type !== '' && !parseMediaType(type)) throw Error('Invalid multipart Content-Type.');
    ancestors.add(rows);
    const form = type.split(';')[0].trim().toLowerCase() === 'multipart/form-data';
    const encoded = rows.map(part => {
      if (++nodes > 10000) throw Error('Multipart exceeds part limits.');
      const headerRows = multipartHeaders(part.headers,true);
      const headerValue = (/** @type {string} */ name) => headerRows.find(([key]) => key.toLowerCase() === name)?.[1];
      const nested = Array.isArray(part.params);
      let mime = part.contentType ?? headerValue('content-type') ?? (nested ? 'multipart/mixed' : null);
      let payload;
      if (nested) {
        const child = group(/** @type {CurlPart[]} */ (part.params), /** @type {string} */ (mime), depth + 1);
        mime = child.contentType;
        payload = child.bytes;
      } else if (part.valueBase64) {
        const value = part.value ?? '';
        let decoded;
        try { decoded = atob(value); } catch { throw Error('Invalid multipart file data.'); }
        if (btoa(decoded) !== value) throw Error('Invalid multipart file data.');
        payload = Uint8Array.from(decoded, char => char.charCodeAt(0));
      } else payload = encoder.encode(part.value ?? '');
      const disposition = headerValue('content-disposition') !== undefined ? null : form ? 'form-data' : part.name !== null || part.fileName != null ? 'attachment' : null;
      let header = disposition ? 'Content-Disposition: ' + disposition : '';
      if (disposition && part.name !== null) header += '; name="' + quoted(part.name, formEscape) + '"';
      if (disposition && part.fileName != null) header += '; filename="' + quoted(part.fileName, formEscape) + '"';
      /** @param {string} line */
      const add = line => { header += (header ? '\r\n' : '') + line; };
      if (mime !== null) {
        if (mime !== '' && !parseMediaType(mime)) throw Error('Invalid multipart Content-Type.');
        add('Content-Type: ' + mime);
      }
      if (part.transferEncoding) {
        if (!multipartEncodings.includes(part.transferEncoding)) throw Error('Unsupported multipart transfer encoding.');
        const transformed = transfer(payload, part.transferEncoding);
        if (transformed !== null) payload = encoder.encode(transformed);
        if (headerValue('content-transfer-encoding') === undefined) add('Content-Transfer-Encoding: ' + part.transferEncoding);
      }
      for (const line of part.headers.split(/\r?\n/).filter(Boolean)) {
        const name = line.slice(0,line.indexOf(':'));
        if (name.toLowerCase() === 'content-type') continue;
        add(line);
      }
      return { header, payload };
    });
    ancestors.delete(rows);
    let boundary = '';
    do { boundary = 'insomnium-' + crypto.randomUUID(); }
    while (encoded.some(part => part.header.includes(boundary) || new TextDecoder('latin1').decode(part.payload).includes(boundary)));
    const chunks = [];
    for (const part of encoded) chunks.push(encoder.encode('--' + boundary + '\r\n' + part.header + (part.header ? '\r\n' : '') + '\r\n'), part.payload, encoder.encode('\r\n'));
    chunks.push(encoder.encode('--' + boundary + '--\r\n'));
    return { bytes: join(chunks), contentType: type + '; boundary=' + boundary };
  }
  return group(parts, contentType ?? 'multipart/form-data', 1);
}
