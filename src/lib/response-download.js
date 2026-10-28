import {mimeParameter} from './response-multipart.js';
import { Channel, invoke } from "@tauri-apps/api/core";
import { createNativeCancellation } from "./native-cancellation.js";
import { legacyMimeExtension } from "./legacy-file-mime.js";

/** Native destinations are selected locally and never read from imported metadata.
 * @param {'get'|'choose'|'clear'|'write'} operation
 * @param {string} workspaceId @param {string} requestId @param {AbortSignal} signal
 * @param {Record<string,any>} [response] @param {string} [requestName] @returns {Promise<string|null>}
 */
export async function requestDownload(operation, workspaceId, requestId, signal, response, requestName) {
  signal.throwIfAborted();
  const id = "download_" + crypto.randomUUID();
  const cancellation = createNativeCancellation(id, signal);
  const onStarted = new Channel();
  onStarted.onmessage = cancellation.started;
  try {
    const result = await invoke("response_download", { request: {
      id, workspaceId, requestId, operation,
      ...(response ? { name: responseDownloadName(response, requestName), bodyBase64: response.bodyBase64 } : {}),
    }, onStarted });
    signal.throwIfAborted();
    return /** @type {string|null} */ (result);
  } finally { await cancellation.close(); }
}
/** Header filenames are suggestions, never paths.
 * @param {string} value */
export function safeResponseFilename(value) {
  let name=value.split(/[\\/]/).pop()?.replace(/[\x00-\x1f\x7f-\x9f<>:"|?*]/g,'_').trim().replace(/[. ]+$/,'')||'';
  if(!name || name==='.' || name==='..')return '';
  if(/^(?:con|prn|aux|nul|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(name))name='_'+name;
  // Match the native portable basename budget, retaining a normal extension.
  // Iterating code points avoids splitting a surrogate pair or UTF-8 sequence.
  const encoder = new TextEncoder();
  if (encoder.encode(name).length > 255) {
    const dot = name.lastIndexOf('.');
    const suffix = dot > 0 && encoder.encode(name.slice(dot)).length <= 64 ? name.slice(dot) : '';
    const budget = 255 - encoder.encode(suffix).length;
    let prefix = '', used = 0;
    for (const character of name.slice(0, suffix ? dot : name.length)) {
      const size = encoder.encode(character).length;
      if (used + size > budget) break;
      prefix += character;
      used += size;
    }
    name = (prefix.replace(/[. ]+$/, '') + suffix).replace(/[. ]+$/, '');
  }
  return name;
}
/** @param {string} disposition */
export function dispositionFilename(disposition) {
  let extended='';
  const parameter=mimeParameter(disposition,'filename*');
  const match=/^([^']*)'[^']*'(.*)$/.exec(parameter);
  if(match){
    try{
      if(/^utf-8$/i.test(match[1]))extended=decodeURIComponent(match[2]);
      else if(/^iso-8859-1$/i.test(match[1]) && !/%(?![0-9a-f]{2})/i.test(match[2]))
        extended=match[2].replace(/%([0-9a-f]{2})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16)));
    }catch{}
  }
  return safeResponseFilename(extended)||safeResponseFilename(mimeParameter(disposition,'filename'));
}
/** @param {Record<string,any>} response @param {string} [requestName] */
export function responseDownloadName(response, requestName) {
  const disposition=response.headers?.find((/** @type {string[]} */ row)=>row[0].toLowerCase()==='content-disposition')?.[1];
  const suggested = dispositionFilename(String(disposition || ''));
  if (suggested) return suggested;
  if (requestName === undefined) return 'response.bin';
  const type = response.headers?.find((/** @type {string[]} */ row) => row[0].toLowerCase() === 'content-type')?.[1];
  const extension = legacyMimeExtension(String(type || response.contentType || '')) || 'unknown';
  return safeResponseFilename(`${requestName.replace(/\s/g, '-').toLowerCase()}.${extension}`) || `response.${extension}`;
}
