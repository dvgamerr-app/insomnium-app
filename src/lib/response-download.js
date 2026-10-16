import {mimeParameter} from './response-multipart.js';
/** Header filenames are suggestions, never paths.
 * @param {string} value */
export function safeResponseFilename(value) {
  let name=value.split(/[\\/]/).pop()?.replace(/[\x00-\x1f\x7f<>:"|?*]/g,'_').trim().replace(/[. ]+$/,'')||'';
  if(!name || name==='.' || name==='..')return '';
  if(/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))name='_'+name;
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
/** @param {Record<string,any>} response */
export function responseDownloadName(response) {
  const disposition=response.headers?.find((/** @type {string[]} */ row)=>row[0].toLowerCase()==='content-disposition')?.[1];
  return dispositionFilename(String(disposition||''))||'response.bin';
}
