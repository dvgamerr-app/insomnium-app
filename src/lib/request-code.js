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
/** Shared prepared bytes and explicit headers for standard HTTP adapters.
 * @param {CodeRequest} request */
function preparedCodeParts(request,client='Python http.client'){
  if(request.asap||request.aws||request.oauth1||request.hawk||request.nativeAuth?.digest)
    throw Error('Choose Node.js / Native to generate this authentication.');
  if(request.nativeAuth)throw Error('Choose Shell / cURL to generate code for NTLM or netrc authentication.');
  if(request.socketPath)throw Error('Choose Node.js / Native to generate code for a socket request.');
  if(request.method.toUpperCase()==='CONNECT')throw Error('CONNECT requires a tunnel adapter.');
  const url=new URL(request.url);
  if(!['http:','https:'].includes(url.protocol))throw Error(client+' requires an HTTP or HTTPS URL.');
  const headers=request.headers.map(row=>[row.name,row.value]);
  const hasHeader=(/** @type {string} */ name)=>headers.some(row=>row[0].toLowerCase()===name);
  if(request.cookies.length&&!hasHeader('cookie'))headers.push(['Cookie',request.cookies.map(cookie=>cookie.name+'='+cookie.value).join('; ')]);
  const encode=(/** @type {Uint8Array} */ bytes)=>{
    let text='';
    for(let offset=0;offset<bytes.length;offset+=8192)text+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
    return btoa(text);
  };
  if((url.username||url.password)&&!hasHeader('authorization')){
    const decode=(/** @type {string} */ value)=>decodeURIComponent(value.replace(/%(?![0-9a-f]{2})/gi,'%25'));
    try{headers.push(['Authorization','Basic '+encode(new TextEncoder().encode(decode(url.username)+':'+decode(url.password)))]);}
    catch{throw Error('URL credentials must contain valid UTF-8 for '+client+' code export.');}
  }
  const hasBody=request.multipartParts!=null||typeof request.bodyBase64==='string'||!!request.postData?.text;
  let encoded='';
  if(request.multipartParts){
    const multipart=multipartCode(request.multipartParts,request.multipartContentType??null,value=>{binaryData(value);return '';});
    for(let index=headers.length-1;index>=0;index--)if(headers[index][0].toLowerCase()==='content-type')headers.splice(index,1);
    headers.push(['Content-Type',multipart.contentType]);
    const length=multipart.bytes.reduce((sum,bytes)=>sum+bytes.length,0);
    if(length>Math.floor((generatedCodeLimit-65536)/4)*3)throw Error('Multipart body exceeds the generated code limit.');
    const bytes=new Uint8Array(length);let offset=0;
    for(const chunk of multipart.bytes){bytes.set(chunk,offset);offset+=chunk.length;}
    encoded=encode(bytes);
  }else if(typeof request.bodyBase64==='string'){
    binaryData(request.bodyBase64,request.serializedMultipart);encoded=request.bodyBase64;
  }else if(request.postData?.mimeType==='multipart/form-data')
    throw Error('Multipart export requires the prepared request body. Regenerate the request.');
  else encoded=encode(new TextEncoder().encode(request.postData?.text??''));
  if(headers.some(([name,value])=>!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)||/[^\x20-\x7e\t]/.test(value)))
    throw Error(client+' export requires ASCII headers. Choose Node.js / Native for raw header bytes.');
  const transfers=headers.filter(([name])=>name.toLowerCase()==='transfer-encoding');
  if(transfers.length&&(transfers.length!==1||transfers[0][1].trim().toLowerCase()!=='chunked'||hasHeader('content-length')))
    throw Error(client+' export supports only chunked Transfer-Encoding without Content-Length.');
  const chunked=transfers.length>0;
  const target=url.pathname+(url.search||(url.href.split('#',1)[0].endsWith('?')?'?':''));
  return {url,headers,hasHeader,hasBody,encoded,chunked,target};
}
/** Go sends the captured bytes without form/JSON reconstruction.
 * @param {CodeRequest} request */
export function goNativeCode(request){
  const {url,headers,hasHeader,encoded,chunked}=preparedCodeParts(request,'Go net/http');
  if(!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(request.method))
    throw Error('Go net/http requires a valid HTTP method token.');
  const rows=(/** @type {string} */ name)=>headers.filter(row=>row[0].toLowerCase()===name);
  for(const name of ['host','content-length','user-agent'])if(rows(name).length>1)
    throw Error('Go net/http cannot preserve duplicate '+name+' headers. Choose Node.js / Native.');
  if(rows('host').some(([,value])=>!value||/\s/.test(value)))
    throw Error('Go net/http cannot preserve an empty or whitespace Host. Choose Node.js / Native.');
  if(rows('trailer').length)throw Error('Go net/http trailer declarations require a trailer adapter. Choose Node.js / Native.');
  const size=encoded.length/4*3-(encoded.endsWith('==')?2:encoded.endsWith('=')?1:0);
  const length=rows('content-length')[0]?.[1];
  if(length!==undefined&&(!/^\d+$/.test(length)||BigInt(length)!==BigInt(size)))
    throw Error('Go net/http requires Content-Length to match the prepared body bytes.');
  url.username='';url.password='';url.hash='';
  const lines=['package main','','import (','  "bytes"','  "encoding/base64"','  "io"','  "net/http"','  "os"',')','','func main() {',
    `  body, err := base64.StdEncoding.DecodeString(${JSON.stringify(encoded)})`,
    '  if err != nil { panic(err) }',
    `  req, err := http.NewRequest(${JSON.stringify(request.method)}, ${JSON.stringify(url.href)}, bytes.NewReader(body))`,
    '  if err != nil { panic(err) }'];
  for(const [name,value] of headers){
    const key=name.toLowerCase();
    if(key==='content-length'||key==='transfer-encoding')continue;
    if(key==='host')lines.push(`  req.Host = ${JSON.stringify(value)}`);
    else lines.push(`  req.Header.Add(${JSON.stringify(name)}, ${JSON.stringify(value)})`);
  }
  if(!hasHeader('user-agent'))lines.push('  req.Header["User-Agent"] = []string{""}');
  if(chunked)lines.push('  req.TransferEncoding = []string{"chunked"}','  req.ContentLength = -1');
  else if(length!==undefined)lines.push(`  req.ContentLength = ${size}`);
  lines.push('  transport := &http.Transport{Proxy: nil, DisableCompression: true}',
    '  defer transport.CloseIdleConnections()',
    '  client := &http.Client{Transport: transport, CheckRedirect: func(req *http.Request, via []*http.Request) error { return http.ErrUseLastResponse }}',
    '  response, err := client.Do(req)','  if err != nil { panic(err) }','  defer response.Body.Close()',
    '  if _, err := io.Copy(os.Stdout, response.Body); err != nil { panic(err) }','}');
  return lines.join('\n');
}
/** Python's low-level API preserves duplicate headers and sends bytes unchanged.
 * @param {CodeRequest} request */
export function pythonHttpClientCode(request){
  const {url,headers,hasHeader,hasBody,encoded,chunked,target}=preparedCodeParts(request);
  const lines=['import base64','import http.client','import sys','',`body = base64.b64decode(${JSON.stringify(encoded)}, validate=True)`,
    `conn = http.client.${url.protocol==='https:'?'HTTPSConnection':'HTTPConnection'}(${JSON.stringify(url.host)})`,'try:',
    `    conn.putrequest(${JSON.stringify(request.method)}, ${JSON.stringify(target)}, skip_host=${hasHeader('host')?'True':'False'}, skip_accept_encoding=True)`];
  for(const [name,value] of headers)lines.push(`    conn.putheader(${JSON.stringify(name)}, ${JSON.stringify(value)})`);
  if(hasBody&&!chunked&&!hasHeader('content-length'))lines.push('    conn.putheader("Content-Length", str(len(body)))');
  lines.push(`    conn.endheaders(${hasBody||chunked?'body':'None'}, encode_chunked=${chunked?'True':'False'})`,
    '    response = conn.getresponse()','    sys.stdout.buffer.write(response.read())','finally:','    conn.close()');
  return lines.join('\n');
}
/** Requests receives bytes after preparation rather than re-encoding forms/JSON.
 * @param {CodeRequest} request */
export function pythonRequestsCode(request){
  const {url,headers,hasHeader,hasBody,encoded,chunked,target}=preparedCodeParts(request);
  if(request.method!==request.method.toUpperCase())
    throw Error('Python Requests changes HTTP method casing. Choose Python / http.client to preserve it.');
  if(target.startsWith('//')||!url.search&&target.endsWith('?'))
    throw Error('Python Requests normalizes this request target. Choose Python / http.client to preserve it.');
  const names=new Set();
  for(const [name,value] of headers){
    const key=name.toLowerCase();
    if(names.has(key))throw Error('Python Requests combines duplicate headers. Choose Python / http.client to preserve them.');
    if(['host','user-agent','accept-encoding'].includes(key)&&value==='@@@SKIP_HEADER@@@')
      throw Error('This header value is reserved by urllib3. Choose Python / http.client to send it literally.');
    names.add(key);
  }
  url.username='';url.password='';url.hash='';
  const lines=['import base64','import sys','import requests','from urllib3.util import SKIP_HEADER','',
    '# Requests 2.32+ with urllib3 2.x.',`body = base64.b64decode(${JSON.stringify(encoded)}, validate=True)`,
    `prepared = requests.Request(${JSON.stringify(request.method)}, ${JSON.stringify(url.href)}).prepare()`,
    `prepared.url = ${JSON.stringify(url.href)}`,
    `prepared.body = ${hasBody||chunked?'body':'None'}`,
    'prepared.headers = requests.structures.CaseInsensitiveDict({'];
  for(const [name,value] of headers)lines.push(`    ${JSON.stringify(name)}: ${JSON.stringify(value)},`);
  lines.push('})');
  for(const name of ['User-Agent','Accept-Encoding'])if(!hasHeader(name.toLowerCase()))
    lines.push(`prepared.headers[${JSON.stringify(name)}] = SKIP_HEADER`);
  if(hasBody&&!chunked&&!hasHeader('content-length'))lines.push('prepared.headers["Content-Length"] = str(len(body))');
  lines.push('with requests.Session() as session:','    session.trust_env = False',
    '    with session.send(prepared, proxies={}, allow_redirects=False, stream=True) as response:',
    '        sys.stdout.buffer.write(response.raw.read(decode_content=False))');
  return lines.join('\n');
}
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
 * @param {CodeRequest} request @param {string} client */
function browserCodeParts(request,client) {
  if(request.asap)throw Error('Choose Node.js / Native to generate ASAP authentication.');
  if(request.aws)throw Error('Choose Node.js / Native to generate AWS signatures.');
  if(request.oauth1)throw Error('Choose Node.js / Native to generate OAuth1 authentication.');
  if(request.hawk)throw Error('Choose Node.js / Native to generate Hawk authentication.');
  if(request.nativeAuth)throw Error(request.nativeAuth.digest?'Choose Node.js / Native to generate Digest code, including auth-int.':'Choose Shell / cURL to generate code for NTLM or netrc authentication.');
  if(request.socketPath)throw Error('Choose Node.js / Native to generate code for a socket request.');
  if(['DELETE','GET','HEAD','OPTIONS','POST','PUT'].includes(request.method.toUpperCase())&&
      request.method!==request.method.toUpperCase())
    throw Error(`${client} changes this HTTP method's casing. Choose Shell / cURL to preserve it.`);
  const binary=typeof request.bodyBase64==='string';
  const multipart=!binary&&(request.multipartParts!=null||request.postData?.mimeType==='multipart/form-data');
  const text=request.postData?.text??'';
  const hasBody=binary||multipart||text!=='';
  if(['CONNECT','TRACE','TRACK'].includes(request.method.toUpperCase()))
    throw Error(`${client} cannot use this HTTP method. Choose another client.`);
  const url=new URL(request.url);
  if(url.username||url.password)throw Error(`${client} cannot use credentials in a URL. Use an Authorization header or choose another client.`);
  if(hasBody&&['GET','HEAD'].includes(request.method.toUpperCase()))
    throw Error(`${client} cannot send a body with GET or HEAD. Choose another client or change the request method.`);
  if(request.cookies.length||request.headers.some(row=>row.name.toLowerCase()==='cookie'))
    throw Error(`${client} uses its own cookie jar. Choose another client to export explicit cookies.`);
  if(request.headers.some(row=>{
    const name=row.name.toLowerCase();
    return forbiddenHeaders.has(name)||name.startsWith('proxy-')||name.startsWith('sec-')||
      ['x-http-method','x-http-method-override','x-method-override'].includes(name)&&row.value.split(',').some(value=>['CONNECT','TRACE','TRACK'].includes(value.trim().toUpperCase()));
  }))
    throw Error(`${client} manages transport headers. Choose another client to set them explicitly.`);
  const lines=[`const url = ${JSON.stringify(request.url)};`];
  const preparedMultipart=multipart&&request.multipartParts?multipartCode(request.multipartParts,request.multipartContentType??null,binaryLiteral):null;
  if(preparedMultipart)lines.push('const form = new Blob([\n  '+preparedMultipart.chunks.join(',\n  ')+'\n]);');
  else if(multipart){
    lines.push('const form = new FormData();');
    for(const part of request.postData?.params??[]){
      if(part.fileName!==undefined&&part.fileName!==null)throw Error(`${client} file generation requires a file adapter.`);
      lines.push(`form.append(${JSON.stringify(part.name)}, ${JSON.stringify(part.value??'')});`);
    }
  }
  const headers=request.headers.filter(row=>!multipart||row.name.toLowerCase()!=='content-type').map(row=>[row.name,row.value]);
  if(preparedMultipart)headers.push(['Content-Type',preparedMultipart.contentType]);
  const body=binary?binaryLiteral(/** @type {string} */(request.bodyBase64),false,request.serializedMultipart):multipart?'form':JSON.stringify(text);
  return {lines,headers,body,hasBody,binary,multipart};
}

/** @param {CodeRequest} request */
export function javascriptFetchCode(request) {
  const {lines,headers,body,hasBody}=browserCodeParts(request,'Browser fetch');
  lines.push(`const options = {`, `  method: ${JSON.stringify(request.method)},`,
    `  headers: ${JSON.stringify(headers)},`,
    ...(hasBody?[`  body: ${body},`]:[]),
    '};', '', 'const response = await fetch(url, options);',
    'const data = await response.text();', 'console.log(data);');
  return lines.join('\n');
}

/** Use the same prepared byte/MIME body as Fetch. A text Blob avoids XHR's
 * string-body charset rewrite and implicit text/plain Content-Type.
 * @param {CodeRequest} request */
export function javascriptXhrCode(request) {
  const {lines,headers,body,hasBody,binary,multipart}=browserCodeParts(request,'XMLHttpRequest');
  lines.push('const xhr = new XMLHttpRequest();','xhr.withCredentials = true;',`xhr.open(${JSON.stringify(request.method)}, url);`);
  for(const [name,value] of headers)
    lines.push(`xhr.setRequestHeader(${JSON.stringify(name)}, ${JSON.stringify(value)});`);
  lines.push('xhr.onload = () => {', '  console.log(xhr.status, xhr.responseText);', '};',
    "xhr.onerror = () => console.error('Request failed.');",
    `xhr.send(${hasBody?binary||multipart?body:`new Blob([${body}])`:''});`);
  return lines.join('\n');
}

/** Axios 1.x's XHR adapter accepts the same prepared browser body. Bypass
 * automatic JSON/form conversion and ambient XSRF/default header injection.
 * @param {CodeRequest} request */
export function javascriptAxiosCode(request) {
  const {lines,headers,body,hasBody,binary,multipart}=browserCodeParts(request,'Browser Axios');
  // Axios uppercases every method before XHR.open, unlike XHR's limited set
  // of standard normalized methods. Refuse spellings that it would change.
  if(!['DELETE','GET','HEAD','OPTIONS','POST','PUT'].includes(request.method.toUpperCase())&&
      request.method!==request.method.toUpperCase())
    throw Error('Axios changes custom HTTP method casing. Choose JavaScript / XMLHttpRequest or Shell / cURL.');
  lines.unshift("import axios from 'axios';",'// Axios 1.x, running in a browser.','');
  lines.push(`const headers = Object.fromEntries(new Headers(${JSON.stringify(headers)}));`,
    "if (!Object.hasOwn(headers, 'accept')) headers.Accept = false;",
    "if (!Object.hasOwn(headers, 'content-type')) headers['Content-Type'] = false;",'',
    'try {','  const response = await axios.request({',"    adapter: 'xhr',",
    `    method: ${JSON.stringify(request.method)},`,'    url,','    headers,',
    // An empty Blob prevents Axios from dropping an explicit Content-Type
    // solely because data is undefined; XHR itself discards GET/HEAD bodies.
    `    data: ${hasBody?binary||multipart?body:`new Blob([${body}])`:'new Blob([])'},`,
    '    transformRequest: [data => data],','    transformResponse: [data => data],',
    "    responseType: 'text',",'    xsrfCookieName: null,','    xsrfHeaderName: null,',
    '  });','  console.log(response.status, response.data);','} catch (error) {',
    '  console.error(error);','}');
  return lines.join('\n');
}

/** Node's Axios HTTP adapter must receive prepared bytes rather than its JSON,
 * form or FormData transforms. Keep unsupported raw-header semantics explicit.
 * @param {CodeRequest} request */
export function nodeAxiosCode(request){
  if(request.asap||request.aws||request.oauth1||request.hawk||request.nativeAuth?.digest)
    throw Error('Choose Node.js / Native to generate this authentication.');
  if(request.nativeAuth?.ntlm||request.nativeAuth?.netrc)
    throw Error('Choose Shell / cURL to generate code for NTLM or netrc authentication.');
  if(request.method!==request.method.toUpperCase())
    throw Error('Node.js Axios changes HTTP method casing. Choose Shell / cURL to preserve it.');
  const url=new URL(request.url);
  if(!['http:','https:'].includes(url.protocol))throw Error('Node.js Axios requires an HTTP or HTTPS URL.');
  if(request.method==='CONNECT')throw Error('CONNECT requires a tunnel adapter.');
  const user=url.username,password=url.password,hasAuthority=!!(user||password);
  url.username='';url.password='';
  const headers=request.headers.map(row=>[row.name,row.value]);
  const hasHeader=(/** @type {string} */name)=>headers.some(row=>row[0].toLowerCase()===name);
  const lines=["import axios from 'axios';","import { Buffer } from 'node:buffer';",'// Axios 1.x, running in Node.js.','',`const url = ${JSON.stringify(hasAuthority?url.href:request.url)};`];
  const hasBody=request.multipartParts!=null||typeof request.bodyBase64==='string'||!!request.postData?.text;
  let body="Buffer.alloc(0)";
  if(request.multipartParts){
    const multipart=multipartCode(request.multipartParts,request.multipartContentType??null,value=>binaryLiteral(value,true));
    for(let index=headers.length-1;index>=0;index--)if(headers[index][0].toLowerCase()==='content-type')headers.splice(index,1);
    headers.push(['Content-Type',multipart.contentType]);
    body='Buffer.concat([\n  '+multipart.chunks.join(',\n  ')+"\n].map(part => typeof part === 'string' ? Buffer.from(part, 'utf8') : part))";
  }else if(typeof request.bodyBase64==='string')body=binaryLiteral(request.bodyBase64,true,request.serializedMultipart);
  else if(request.postData?.mimeType==='multipart/form-data')
    throw Error('Multipart export requires the prepared request body. Regenerate the request.');
  else if(request.postData?.text)body=`Buffer.from(${JSON.stringify(request.postData.text)}, 'utf8')`;
  if(request.cookies.length&&!hasHeader('cookie'))headers.push(['Cookie',request.cookies.map(cookie=>cookie.name+'='+cookie.value).join('; ')]);
  if(hasAuthority&&!hasHeader('authorization')){
    const decode=(/** @type {string} */value)=>decodeURIComponent(value.replace(/%(?![0-9a-f]{2})/gi,'%25'));
    let credentials;
    try{credentials=decode(user)+':'+decode(password);}
    catch{throw Error('URL credentials must contain valid UTF-8 for Node.js code export.');}
    // Clear userinfo even with manual Authorization: Axios URL auth otherwise
    // deletes that header. Emit Basic as bytes, never Axios's auth option.
    lines.push(`const authority = 'Basic ' + Buffer.from(${JSON.stringify(credentials)}, 'utf8').toString('base64');`);
  }
  const names=new Set();
  if(!hasHeader('host'))headers.push(['Host',url.host]);
  for(const [name,value] of headers){
    const key=name.toLowerCase();
    if(names.has(key))throw Error('Axios normalizes duplicate headers. Choose Node.js / Native to preserve raw header rows.');
    if(/[^\x00-\x7f]/.test(value))throw Error('Choose Node.js / Native to preserve UTF-8 header bytes across Axios versions.');
    if(['__proto__','constructor','prototype'].includes(key))throw Error('Choose Node.js / Native to preserve this header name.');
    names.add(key);
  }
  lines.push(`const body = ${body};`,`const headers = Object.fromEntries(${JSON.stringify(headers)});`);
  if(hasAuthority&&!hasHeader('authorization'))lines.push('headers.Authorization = authority;');
  for(const name of ['Accept','Content-Type','User-Agent','Accept-Encoding'])
    if(!hasHeader(name.toLowerCase()))lines.push(`headers[${JSON.stringify(name)}] = false;`);
  // Avoid adding Content-Length alongside a captured Transfer-Encoding.
  if(hasHeader('transfer-encoding')&&!hasHeader('content-length'))lines.push("headers['Content-Length'] = false;");
  lines.push('','const response = await axios.request({',"  adapter: 'http',",`  method: ${JSON.stringify(request.method)},`,'  url,','  headers,',...(hasBody?['  data: body,']:[]),
    ...(request.socketPath?[`  socketPath: ${JSON.stringify(request.socketPath)},`]:[]),
    '  transformRequest: [data => data],','  transformResponse: [data => data],',
    '  proxy: false,','  maxRedirects: 0,','  decompress: false,',"  responseType: 'arraybuffer',",'  validateStatus: () => true,',
    '});',"console.log(response.status, Buffer.from(response.data).toString('utf8'));");
  return lines.join('\n');
}

/** The native HTTP client accepts raw header rows and byte bodies without the
 * browser Fetch method, cookie or multipart restrictions. No code is executed
 * by the application; the output is a standalone ECMAScript module.
 * @param {CodeRequest} request */
export function nodeNativeCode(request){
  if(request.nativeAuth?.ntlm||request.nativeAuth?.netrc)throw Error('Choose Shell / cURL to generate code for NTLM or netrc authentication.');
  if(request.method!==request.method.toUpperCase())
    throw Error('Node.js HTTP changes HTTP method casing. Choose Shell / cURL to preserve it.');
  const url=new URL(request.url);
  if(!['http:','https:'].includes(url.protocol))throw Error('Node.js Native requires an HTTP or HTTPS URL.');
  if(request.method.toUpperCase()==='CONNECT')throw Error('CONNECT requires a tunnel adapter.');
  const authorityUser=url.username,authorityPassword=url.password;
  const hasAuthority=!!(authorityUser||authorityPassword);
  url.username='';url.password='';
  const lines=["import http from 'node:http';","import https from 'node:https';","import { Buffer } from 'node:buffer';",'',`const url = new URL(${JSON.stringify(hasAuthority?url.href:request.url)});`];
  const headers=request.headers.map(row=>[row.name,row.value]);
  const hasHeader=(/** @type {string} */name)=>headers.some(row=>row[0].toLowerCase()===name);
  const digest=request.nativeAuth?.digest&&!hasHeader('authorization')?request.nativeAuth.digest:null;
  const hawk=request.hawk&&!hasHeader('authorization')?request.hawk:null;
  const oauth1=request.oauth1&&!hasHeader('authorization')?request.oauth1:null;
  const aws=request.aws??null;
  const asap=request.asap&&!hasHeader('authorization')?request.asap:null;
  let authorityCredentials=null;
  if(hasAuthority&&!hasHeader('authorization')&&!digest&&!hawk&&!oauth1&&!aws&&!asap){
    // URL stores percent-encoded userinfo. Decode UTF-8, preserving literal
    // malformed percent signs as percent_encoding::percent_decode does.
    const decode=(/** @type {string} */value)=>decodeURIComponent(value.replace(/%(?![0-9a-f]{2})/gi,'%25'));
    try{authorityCredentials=decode(authorityUser)+':'+decode(authorityPassword);}
    catch{throw Error('URL credentials must contain valid UTF-8 for Node.js code export.');}
  }
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
  // Node skips its automatic URL-auth insertion for a raw header array.
  if(authorityCredentials!==null)lines.push(`headers.push('Authorization', 'Basic ' + Buffer.from(${JSON.stringify(authorityCredentials)}, 'utf8').toString('base64'));`);
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
  if(request.method==='HEAD'){
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
