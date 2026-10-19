import {multipartCode} from './request-code-multipart.js';
import digestRuntime from './request-code-digest.js?raw';
import hawkRuntime from './request-code-hawk.js?raw';
import oauth1Runtime from './request-code-oauth1.js?raw';
import awsRuntime from './request-code-aws.js?raw';
import asapRuntime from './request-code-asap.js?raw';
const forbiddenHeaders=new Set('accept-charset accept-encoding access-control-request-headers access-control-request-method connection content-length cookie cookie2 date dnt expect host keep-alive origin referer set-cookie te trailer transfer-encoding upgrade via'.split(' '));
/** @typedef {import('./request-code-multipart.js').MultipartPart} MultipartPart */
/** @typedef {{digest?:{username:string,password:string}|null,ntlm?:{username:string,password:string,domain:string,workstation:string}|null,netrc?:boolean}} NativeAuth */
/** @typedef {import('httpsnippet-lite').HarRequest & {bodyBase64?:string|null,serializedMultipart?:boolean,multipartParts?:MultipartPart[]|null,multipartContentType?:string|null,socketPath?:string|null,suppressDefaultHeaders?:string[],nativeAuth?:NativeAuth|null,hawk?:Record<string,any>|null,oauth1?:Record<string,any>|null,aws?:Record<string,any>|null,asap?:Record<string,any>|null}} CodeRequest */
export const generatedCodeLimit=32*1024*1024;
/** A 20 MiB transport body expands to at most 28 MiB of Base64 source.
 * @param {string} value @param {boolean} [buffer] @param {boolean} [serializedMultipart] */
function binaryLiteral(value,buffer=false,serializedMultipart=false){
  binaryData(value,serializedMultipart);
  return buffer?`Buffer.from(${JSON.stringify(value)}, 'base64')`:`Uint8Array.from(atob(${JSON.stringify(value)}), character => character.charCodeAt(0))`;
}
/** Serialized MIME includes framing in addition to the selected upload budget.
 * Bound its Base64 source by the existing generated-code budget, reserving
 * room for client code/headers; ordinary raw uploads retain their 20 MiB cap.
 * @param {string} value @param {boolean} [serializedMultipart] */
function binaryData(value,serializedMultipart=false){
  const limit=serializedMultipart?Math.floor((generatedCodeLimit-65536)/4)*3:20*1024*1024;
  const message=serializedMultipart?'Multipart body exceeds the generated code limit.':'Binary request exceeds 20 MiB.';
  if(value.length>4*Math.ceil(limit/3))throw Error(message);
  let decoded;
  try{decoded=atob(value);}catch{throw Error('Binary file data is invalid. Select the file again.');}
  if(decoded.length>limit)throw Error(message);
  if(btoa(decoded)!==value)throw Error('Binary file data is invalid. Select the file again.');
  return decoded;
}
/** Emit data literals, never interpolate request text into executable syntax.
 * Browser Fetch owns header normalization and CORS. Prepared multipart has an
 * explicit MIME body so per-part transport options survive code generation.
 * @param {CodeRequest} request */
export function javascriptFetchCode(request) {
  if(request.asap)throw Error('Choose Node.js / Native to generate ASAP authentication.');
  if(request.aws)throw Error('Choose Node.js / Native to generate AWS signatures.');
  if(request.oauth1)throw Error('Choose Node.js / Native to generate OAuth1 authentication.');
  if(request.hawk)throw Error('Choose Node.js / Native to generate Hawk authentication.');
  if(request.nativeAuth)throw Error(request.nativeAuth.digest?'Choose Node.js / Native to generate Digest code, including auth-int.':'Choose Shell / cURL to generate code for NTLM or netrc authentication.');
  if(request.socketPath)throw Error('Choose Node.js / Native to generate code for a socket request.');
  const binary=typeof request.bodyBase64==='string';
  const multipart=!binary&&request.postData?.mimeType==='multipart/form-data';
  const text=request.postData?.text??'';
  const hasBody=binary||multipart||text!=='';
  if(['CONNECT','TRACE','TRACK'].includes(request.method.toUpperCase()))
    throw Error('Browser fetch cannot use this HTTP method. Choose another client.');
  const url=new URL(request.url);
  if(url.username||url.password)throw Error('Browser fetch cannot use credentials in a URL. Use an Authorization header or choose another client.');
  if(hasBody&&['GET','HEAD'].includes(request.method.toUpperCase()))
    throw Error('Browser fetch cannot send a body with GET or HEAD. Choose another client or change the request method.');
  if(request.cookies.length||request.headers.some(row=>row.name.toLowerCase()==='cookie'))
    throw Error('Browser fetch uses its own cookie jar. Choose another client to export explicit cookies.');
  if(request.headers.some(row=>{
    const name=row.name.toLowerCase();
    return forbiddenHeaders.has(name)||name.startsWith('proxy-')||name.startsWith('sec-')||
      ['x-http-method','x-http-method-override','x-method-override'].includes(name)&&row.value.split(',').some(value=>['CONNECT','TRACE','TRACK'].includes(value.trim().toUpperCase()));
  }))
    throw Error('Browser fetch manages transport headers. Choose another client to set them explicitly.');
  const lines=[`const url = ${JSON.stringify(request.url)};`];
  const preparedMultipart=multipart&&request.multipartParts?multipartCode(request.multipartParts,request.multipartContentType??null,binaryLiteral):null;
  if(preparedMultipart)lines.push('const form = new Blob([\n  '+preparedMultipart.chunks.join(',\n  ')+'\n]);');
  else if(multipart){
    lines.push('const form = new FormData();');
    for(const part of request.postData?.params??[]){
      if(part.fileName!==undefined&&part.fileName!==null)throw Error('Browser fetch file generation requires a file adapter.');
      lines.push(`form.append(${JSON.stringify(part.name)}, ${JSON.stringify(part.value??'')});`);
    }
  }
  const headers=request.headers.filter(row=>!multipart||row.name.toLowerCase()!=='content-type').map(row=>[row.name,row.value]);
  if(preparedMultipart)headers.push(['Content-Type',preparedMultipart.contentType]);
  const body=binary?binaryLiteral(/** @type {string} */(request.bodyBase64),false,request.serializedMultipart):multipart?'form':JSON.stringify(text);
  lines.push(`const options = {`, `  method: ${JSON.stringify(request.method)},`,
    `  headers: ${JSON.stringify(headers)},`,
    ...(hasBody?[`  body: ${body},`]:[]),
    '};', '', 'const response = await fetch(url, options);',
    'const data = await response.text();', 'console.log(data);');
  return lines.join('\n');
}

/** The native HTTP client accepts raw header rows and byte bodies without the
 * browser Fetch method, cookie or multipart restrictions. No code is executed
 * by the application; the output is a standalone ECMAScript module.
 * @param {CodeRequest} request */
export function nodeNativeCode(request){
  if(request.nativeAuth?.ntlm||request.nativeAuth?.netrc)throw Error('Choose Shell / cURL to generate code for NTLM or netrc authentication.');
  const url=new URL(request.url);
  if(!['http:','https:'].includes(url.protocol))throw Error('Node.js Native requires an HTTP or HTTPS URL.');
  if(request.method.toUpperCase()==='CONNECT')throw Error('CONNECT requires a tunnel adapter.');
  const lines=["import http from 'node:http';","import https from 'node:https';","import { Buffer } from 'node:buffer';",'',`const url = new URL(${JSON.stringify(request.url)});`];
  const headers=request.headers.map(row=>[row.name,row.value]);
  const hasHeader=(/** @type {string} */name)=>headers.some(row=>row[0].toLowerCase()===name);
  const digest=request.nativeAuth?.digest&&!hasHeader('authorization')?request.nativeAuth.digest:null;
  const hawk=request.hawk&&!hasHeader('authorization')?request.hawk:null;
  const oauth1=request.oauth1&&!hasHeader('authorization')?request.oauth1:null;
  const aws=request.aws??null;
  const asap=request.asap&&!hasHeader('authorization')?request.asap:null;
  if(digest||hawk||oauth1||aws)lines.push("import { createHash, createHmac, randomBytes, createPrivateKey, sign, constants } from 'node:crypto';");
  if(digest)lines.push(digestRuntime,`const credentials = ${JSON.stringify(digest)};`);
  if(hawk)lines.push(hawkRuntime);
  if(oauth1)lines.push(oauth1Runtime);
  if(aws)lines.push(awsRuntime);
  if(asap)lines.push(asapRuntime);
  let body;
  if(request.multipartParts){
    const multipart=multipartCode(request.multipartParts,request.multipartContentType??null,value=>binaryLiteral(value,true));
    for(let index=headers.length-1;index>=0;index--)if(headers[index][0].toLowerCase()==='content-type')headers.splice(index,1);
    headers.push(['Content-Type',multipart.contentType]);
    body='Buffer.concat([\n  '+multipart.chunks.join(',\n  ')+"\n].map(part => typeof part === 'string' ? Buffer.from(part, 'utf8') : part))";
  }else if(typeof request.bodyBase64==='string')body=binaryLiteral(request.bodyBase64,true,request.serializedMultipart);
  else if(request.postData?.text)body=`Buffer.from(${JSON.stringify(request.postData.text)}, 'utf8')`;
  if(request.cookies.length&&!hasHeader('cookie'))headers.push(['Cookie',request.cookies.map(cookie=>cookie.name+'='+cookie.value).join('; ')]);
  if(!hasHeader('host'))headers.push(['Host',url.host]);
  if(body||oauth1)lines.push((oauth1?'let':'const')+' body = '+(body??'Buffer.alloc(0)')+';');
  if(oauth1)lines.push(`const signed = oauth1Sign(${JSON.stringify(oauth1)}, url, ${JSON.stringify(request.method)}, ${JSON.stringify(headers)}, body, {`,"  hash: (algorithm, value) => createHash(algorithm).update(value).digest('base64'),","  mac: (algorithm, key, value) => createHmac(algorithm, key).update(value).digest('base64'),","  rsa: (pem, value) => {","    if (!/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(pem)) throw new Error('OAuth1 requires an unencrypted PKCS1 or PKCS8 RSA PEM key.');","    const key = createPrivateKey(pem);","    if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength > 8192) throw new Error('OAuth1 requires an RSA key of at most 8192 bits.');","    return sign('RSA-SHA1', Buffer.from(value), { key, padding: constants.RSA_PKCS1_PADDING }).toString('base64');",'  },',"  nonce: () => randomBytes(32).toString('base64url'),","  now: () => String(Math.floor(Date.now() / 1000)),",'});','body = Buffer.from(signed.body);');
  // HeaderValue::from_str in the native sender stores UTF-8 bytes. Node's
  // HTTP header strings are Latin-1 byte containers, not UTF-8 text.
  if(aws)lines.push(`const awsHeaders = awsSign(${JSON.stringify(aws)}, url, ${JSON.stringify(request.method)}, ${JSON.stringify(headers)}, ${body?'body':'Buffer.alloc(0)'}, {`,"  hash: value => createHash('sha256').update(value).digest('hex'),","  mac: (key, value) => createHmac('sha256', key).update(value).digest(),","  now: () => new Date().toISOString().replace(/[:-]|\\.\\d{3}/g, ''),",'});');
  lines.push('const headers = '+(aws?'awsHeaders.flat()':oauth1?'signed.headers.flat()':JSON.stringify(headers.flat()))+".map((value, index) => index % 2 ? Buffer.from(value, 'utf8').toString('latin1') : value);");
  if(body||oauth1)lines.push(`if (${body?'true':'body.length > 0'} && !headers.some((value, index) => index % 2 === 0 && ['content-length', 'transfer-encoding'].includes(value.toLowerCase()))) headers.push('Content-Length', String(body.length));`);
  if(asap)lines.push(`headers.push('Authorization', asapAuthorization(${JSON.stringify(asap)}));`);
  if(hawk)lines.push(`const hawkHeader = hawkAuthorization(${JSON.stringify(hawk)}, url, ${JSON.stringify(request.method)}, ${JSON.stringify(headers)}, ${body?'body':'Buffer.alloc(0)'}, {`,"  hash: (algorithm, payload, mime) => createHash(algorithm).update('hawk.1.payload\\n' + mime + '\\n').update(payload).update('\\n').digest('base64'),","  mac: (algorithm, key, value) => createHmac(algorithm, key).update(value).digest('base64'),","  nonce: () => randomBytes(6).toString('base64url').slice(0, 6),","  now: () => String(Math.floor(Date.now() / 1000)),",'});',"headers.push('Authorization', Buffer.from(hawkHeader, 'utf8').toString('latin1'));");
  lines.push('',"const send = () => new Promise((resolve, reject) => {", "  const client = url.protocol === 'https:' ? https : http;",'  const request = client.request(url, {',`    method: ${JSON.stringify(request.method)},`,'    headers,',...(request.socketPath?[`    socketPath: ${JSON.stringify(request.socketPath)},`]:[]),'  }, resolve);',"  request.once('error', reject);","  request.once('upgrade', (_response, socket) => {",'    socket.destroy();',"    reject(new Error('Protocol upgrade requires a streaming adapter.'));",'  });',`  request.end(${oauth1&&!body?'body.length ? body : undefined':body?'body':''});`,'});','let response = await send();');
  if(digest)lines.push('for (let attempt = 0; response.statusCode === 401 && attempt < 2; attempt++) {','  const challenges = [];','  for (let index = 0; index < response.rawHeaders.length; index += 2) {',"    if (response.rawHeaders[index].toLowerCase() === 'www-authenticate')", "      challenges.push(Buffer.from(response.rawHeaders[index + 1], 'latin1').toString('utf8'));",'  }',`  const answer = digestAuthorization(challenges, credentials, ${JSON.stringify(request.method)}, url.pathname + url.search, ${body?'body':'Buffer.alloc(0)'}, {`,"    hash: (algorithm, value) => createHash(algorithm).update(value).digest('hex'),","    nonce: () => randomBytes(16).toString('hex'),",'  });','  if (attempt > 0 && !answer.stale) break;','  for await (const _chunk of response) {}','  for (let index = headers.length - 2; index >= 0; index -= 2)',"    if (headers[index].toLowerCase() === 'authorization') headers.splice(index, 2);","  headers.push('Authorization', Buffer.from(answer.header, 'utf8').toString('latin1'));",'  response = await send();','}');
  lines.push('const chunks = [];','for await (const chunk of response) chunks.push(chunk);',"const data = Buffer.concat(chunks).toString('utf8');",'console.log(data);');
  return lines.join('\n');
}

/** @param {string} value */
function shellQuote(value){
  if(value.includes('\0'))throw Error('Shell arguments cannot contain NUL bytes.');
  return "'"+value.replaceAll("'","'\"'\"'")+"'";
}
/** POSIX shell output. A quoted heredoc keeps binary data out of shell arguments
 * and command substitution; base64 -d streams the exact bytes to curl stdin.
 * @param {CodeRequest} request */
export function shellCurlCode(request){
  if(request.asap)throw Error('Choose Node.js / Native to generate ASAP authentication.');
  if(request.aws)throw Error('Choose Node.js / Native to generate AWS signatures.');
  if(request.oauth1)throw Error('Choose Node.js / Native to generate OAuth1 authentication.');
  if(request.hawk)throw Error('Choose Node.js / Native to generate Hawk authentication.');
  const headers=request.headers.map(row=>[row.name,row.value]);
  const hasHeader=(/** @type {string} */name)=>headers.some(row=>row[0].toLowerCase()===name);
  let encoded=null;
  const text=request.postData?.text??'';
  if(request.multipartParts){
    const multipart=multipartCode(request.multipartParts,request.multipartContentType??null,value=>{binaryData(value);return '';});
    for(let index=headers.length-1;index>=0;index--)if(headers[index][0].toLowerCase()==='content-type')headers.splice(index,1);
    headers.push(['Content-Type',multipart.contentType]);
    let data='';
    for(const bytes of multipart.bytes)for(let offset=0;offset<bytes.length;offset+=8192)data+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
    encoded=btoa(data);
  }else if(typeof request.bodyBase64==='string'){binaryData(request.bodyBase64,request.serializedMultipart);encoded=request.bodyBase64;}
  else if(text.includes('\0')||text.startsWith('@')||new TextEncoder().encode(text).length>8192){
    const bytes=new TextEncoder().encode(text);let data='';
    for(let offset=0;offset<bytes.length;offset+=8192)data+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
    encoded=btoa(data);
  }
  if(request.cookies.length&&!hasHeader('cookie'))headers.push(['Cookie',request.cookies.map(cookie=>cookie.name+'='+cookie.value).join('; ')]);
  const command=['curl --disable --silent --show-error --globoff --path-as-is', '--request '+shellQuote(request.method),'--url '+shellQuote(request.url)];
  const auth=request.nativeAuth;
  if(auth&&!hasHeader('authorization')){
    const credentials=auth.digest||auth.ntlm;
    if(credentials){
      let username=credentials.username;
      if(!username)throw Error('cURL requires an explicit username to avoid automatic OS authentication.');
      if(auth.ntlm){
        if(auth.ntlm.workstation)throw Error('cURL cannot set the explicit NTLM workstation. Clear it or use the native sender.');
        if(auth.ntlm.domain)username=auth.ntlm.domain+'\\'+username;
      }
      if(username.includes(':'))throw Error('cURL --user cannot represent a username containing a colon.');
      command.push(auth.digest?'--digest':'--ntlm','--user '+shellQuote(username+':'+credentials.password));
    }else if(auth.netrc)command.push('--netrc-optional');
  }
  if(request.socketPath)command.push('--unix-socket '+shellQuote(request.socketPath));
  for(const [name,value] of headers)command.push('--header '+shellQuote(name+(value===''?';':': '+value)));
  const hasBody=encoded!==null||text!=='';
  if(request.method.toUpperCase()==='HEAD'){
    if(hasBody)throw Error('Choose Node.js / Native to generate HEAD with a body.');
    command.push('--head');
  }
  if(request.suppressDefaultHeaders?.includes('accept')&&!hasHeader('accept'))command.push("--header 'Accept:'");
  // --data-binary would otherwise add its own form Content-Type.
  if(hasBody&&!hasHeader('content-type'))command.push("--header 'Content-Type:'");
  if(encoded!==null)command.push('--data-binary @-');
  else if(text!=='')command.push('--data-binary '+shellQuote(text));
  const source=command.join(' \\\n  ');
  const output=encoded===null?source:"# POSIX shell; requires curl and base64 -d.\nbase64 -d <<'INSOMNIUM_BODY' | "+source+'\n'+(encoded.match(/.{1,76}/g)?.join('\n')??'')+'\nINSOMNIUM_BODY';
  return auth?.digest?'# cURL cannot handle Digest auth-int for PUT/POST. Choose Node.js / Native or use the native sender.\n'+output:output;
}
