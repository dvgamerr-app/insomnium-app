import {mimeParameter,partHeader} from './response-multipart.js';
/** Decode display text only. The caller retains original bytes for Save.
 * Unknown platform encoding labels retain the existing UTF8 fallback.
 * @param {Uint8Array} bytes @param {string} contentType */
export function decodeResponseBytes(bytes,contentType) {
  const charset=mimeParameter(contentType,'charset')||'utf-8';
  try{return new TextDecoder(charset,{fatal:false}).decode(bytes);}
  catch{return new TextDecoder('utf-8',{fatal:false}).decode(bytes);}
}
/** Recover display text in older saved history without rewriting saved records.
 * @param {Record<string,any>|undefined} response */
export function responseBodyText(response) {
  const fallback=typeof response?.body==='string'?response.body:'';
  const contentType=partHeader(response?.headers||[],'content-type')||String(response?.contentType||'');
  const charset=mimeParameter(contentType,'charset');
  if(!charset||typeof response?.bodyBase64!=='string')return fallback;
  try{
    const decoder=new TextDecoder(charset,{fatal:false});
    // Native UTF8 text is already decoded. Keep its authored BOM/source exact.
    if(decoder.encoding==='utf-8')return fallback;
    return decoder.decode(Uint8Array.from(atob(response.bodyBase64),char=>char.charCodeAt(0)));
  }
  catch{return fallback;}
}
