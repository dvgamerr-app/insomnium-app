import {parseMediaType} from './media-type.js';

const limit=20*1024*1024;
/** @typedef {{name:string,value:string,fileName:string|null,contentType:string|null,valueBase64:boolean,headers:[string,string][],transferEncoding:string|null}} MultipartPart */
/** @param {Uint8Array} bytes */
function base64(bytes){
  let text='';
  for(let offset=0;offset<bytes.length;offset+=8192)text+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
  return btoa(text);
}
/** Match the native multipart_encoding encoder, including soft line breaks.
 * @param {Uint8Array} bytes @param {string} encoding */
function transfer(bytes,encoding){
  if(bytes.length>limit)throw Error('Multipart encoding input exceeds 20 MiB.');
  if(encoding==='binary'||encoding==='8bit')return null;
  if(encoding==='7bit'){
    if(bytes.some(byte=>byte>=128))throw Error('Multipart 7bit encoding cannot contain 8-bit bytes.');
    return null;
  }
  if(encoding==='base64'){
    const text=base64(bytes);
    if(text.length+Math.floor(Math.max(0,text.length-1)/76)*2>limit)throw Error('Encoded multipart part exceeds 20 MiB.');
    return text.match(/.{1,76}/g)?.join('\r\n')??'';
  }
  if(encoding!=='quoted-printable')throw Error('Choose a supported multipart transfer encoding.');
  const chunks=[];
  let column=0,length=0,chunk='';
  for(let index=0;index<bytes.length;){
    const byte=bytes[index],crlf=byte===13&&bytes[index+1]===10;
    const next=index+(crlf?2:1),end=next===bytes.length||bytes[next]===13&&bytes[next+1]===10;
    const escape=!crlf&&(!(byte>=33&&byte<=60||byte>=62&&byte<=126||byte===32||byte===9)||((byte===32||byte===9)&&end));
    const value=crlf?'\r\n':escape?'='+byte.toString(16).toUpperCase().padStart(2,'0'):String.fromCharCode(byte);
    const wrap=!crlf&&(column+value.length>76||column+value.length===76&&!end);
    length+=value.length+(wrap?3:0);
    if(length>limit)throw Error('Encoded multipart part exceeds 20 MiB.');
    if(wrap){chunk+='=\r\n';column=0;}
    chunk+=value;column=crlf?0:column+value.length;index=next;
    if(chunk.length>=8192){chunks.push(chunk);chunk='';}
  }
  return chunks.join('')+chunk;
}
/** Reqwest's default path-segment encoding for Content-Disposition field names.
 * @param {string} name */
function fieldName(name){
  let encoded='';
  for(const byte of new TextEncoder().encode(name))encoded+=byte<32||byte>=127||' "<>`#?{}/%'.includes(String.fromCharCode(byte))?'%'+byte.toString(16).toUpperCase().padStart(2,'0'):String.fromCharCode(byte);
  return encoded===name?'name="'+name+'"':"name*=utf-8''"+encoded;
}
/** Serialize prepared MIME parts into generated Blob chunks, without FormData's
 * newline/filename normalization or implicit file Content-Type. Native contract:
 * src-tauri/src/http.rs and vendor/reqwest/src/async_impl/multipart.rs.
 * @param {MultipartPart[]} parts @param {string|null} contentType
 * @param {(value:string)=>string} binaryLiteral */
export function multipartCode(parts,contentType,binaryLiteral){
  const encoded=parts.map(part=>{
    const binary=part.valueBase64||part.fileName!==null;
    let body=binary?binaryLiteral(part.value):JSON.stringify(part.value);
    let payload=binary?atob(part.value):part.value;
    if(part.transferEncoding){
      const bytes=binary?Uint8Array.from(payload,c=>c.charCodeAt(0)):new TextEncoder().encode(payload);
      const transformed=transfer(bytes,part.transferEncoding);
      if(transformed!==null){payload=transformed;body=JSON.stringify(transformed);}
    }
    let header='Content-Disposition: form-data; '+fieldName(part.name);
    if(part.fileName!==null)header+='; filename="'+part.fileName.replace(/[\\"\r\n]/g,char=>'\\'+char)+'"';
    if(part.contentType!==null){
      if(!parseMediaType(part.contentType))throw Error('Invalid multipart Content-Type.');
      header+='\r\nContent-Type: '+part.contentType;
    }
    for(const [name,value] of part.headers)header+='\r\n'+name.toLowerCase()+': '+value;
    if(part.transferEncoding)header+='\r\ncontent-transfer-encoding: '+part.transferEncoding;
    return {header,body,payload,binary:binary&&(!part.transferEncoding||['binary','8bit','7bit'].includes(part.transferEncoding))};
  });
  let boundary='';
  do{boundary='insomnium-'+crypto.randomUUID();}while(encoded.some(part=>part.header.includes(boundary)||part.payload.includes(boundary)));
  const chunks=[],bytes=[];
  const encoder=new TextEncoder();
  for(const part of encoded){
    const header='--'+boundary+'\r\n'+part.header+'\r\n\r\n';
    chunks.push(JSON.stringify(header),part.body,JSON.stringify('\r\n'));
    bytes.push(encoder.encode(header),part.binary?Uint8Array.from(part.payload,c=>c.charCodeAt(0)):encoder.encode(part.payload),encoder.encode('\r\n'));
  }
  if(parts.length){const end='--'+boundary+'--\r\n';chunks.push(JSON.stringify(end));bytes.push(encoder.encode(end));}
  return {chunks,bytes,contentType:contentType===''?'':(contentType??'multipart/form-data')+'; boundary='+boundary};
}
