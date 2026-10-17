/** @param {Record<string,any>|undefined} event */
export const binaryStreamEvent=event=>['binary','ping','pong'].includes(event?.format);

/** @param {string} value @param {number} limit */
function clipped(value,limit){
  if(value.length<=limit)return value;
  const end=value.charCodeAt(limit-1);
  return value.slice(0,end>=0xd800&&end<=0xdbff?limit-1:limit);
}
/** Decode display/copy text only; stored Base64 remains authoritative for Save.
 * @param {string} base64 @param {boolean} [partial] */
function utf8(base64,partial=false){
  const bytes=Uint8Array.from(atob(base64),character=>character.charCodeAt(0));
  return new TextDecoder('utf-8',{fatal:false,ignoreBOM:true}).decode(bytes,{stream:partial});
}
/** @param {Record<string,any>|undefined} event @param {string} encoding */
export function streamEventText(event,encoding){
  if(event?.data==null)return event?JSON.stringify(event,null,2):'';
  const raw=String(event.data);
  return binaryStreamEvent(event)&&encoding==='utf8'?utf8(raw):raw;
}

/** Search complete event content, independently of preview truncation/encoding.
 * Invalid imported binary data remains searchable in its stored representation.
 * @param {Record<string,any>} event @param {string} query */
export function streamEventMatches(event,query){
  if(!query)return true;
  const needle=query.toLowerCase();
  if(['kind','event','data','message','reason','url'].some(key=>
    String(event[key]??'').toLowerCase().includes(needle)))return true;
  if(binaryStreamEvent(event)){
    try{return streamEventText(event,'utf8').toLowerCase().includes(needle);}
    catch{return false;}
  }
  return false;
}

/** Bounded UTF8 preview reads at most four bytes per visible UTF16 unit plus
 * one character of lookahead; it never decodes the entire large binary event.
 * @param {Record<string,any>|undefined} event @param {string} encoding @param {number} limit */
export function streamEventPreview(event,encoding,limit){
  const raw=String(event?.data??'');
  try{
    let text=raw,partial=false;
    if(binaryStreamEvent(event)&&encoding==='utf8'){
      const base64Limit=4*Math.ceil((limit*4+4)/3);
      partial=raw.length>base64Limit;
      text=utf8(raw.slice(0,base64Limit),partial);
    }
    return {text:clipped(text,limit),truncated:partial||text.length>limit,error:''};
  }catch{
    return {text:clipped(raw,limit),truncated:raw.length>limit,error:'Invalid Base64 stream event.'};
  }
}
