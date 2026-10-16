import {Buffer} from "buffer";
import iconv from "iconv-lite";
import {mimeParameter,partHeader} from './mime-headers.js';
/** Decode display text only. The caller retains original bytes for Save.
 * Unknown encoding labels retain the existing UTF8 fallback.
 * @param {Uint8Array} bytes @param {string} contentType */
export function decodeResponseBytes(bytes,contentType) {
  const charset=mimeParameter(contentType,'charset')||'utf-8';
  if(iconv.encodingExists(charset))return iconv.decode(Buffer.from(bytes),charset);
  return new TextDecoder('utf-8',{fatal:false}).decode(bytes);
}
/** Recover display text in older saved history without rewriting saved records.
 * @param {Record<string,any>|undefined} response */
export function responseBodyText(response) {
  const fallback=typeof response?.body==='string'?response.body:'';
  const contentType=partHeader(response?.headers||[],'content-type')||String(response?.contentType||'');
  const charset=mimeParameter(contentType,'charset');
  if(!charset||typeof response?.bodyBase64!=='string')return fallback;
  try{
    // Existing UTF8 source may intentionally include a BOM.
    if(!iconv.encodingExists(charset)||/^(?:utf8|unicode11utf8)$/.test(charset.toLowerCase().replace(/[^a-z0-9]/g,'')))return fallback;
    return iconv.decode(Buffer.from(atob(response.bodyBase64),"binary"),charset);
  }
  catch{return fallback;}
}
