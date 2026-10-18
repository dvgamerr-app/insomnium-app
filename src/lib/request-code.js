const forbiddenHeaders=new Set('accept-charset accept-encoding access-control-request-headers access-control-request-method connection content-length cookie cookie2 date dnt expect host keep-alive origin referer set-cookie te trailer transfer-encoding upgrade via'.split(' '));
/** @typedef {import('httpsnippet-lite').HarRequest & {bodyBase64?:string|null}} CodeRequest */
export const generatedCodeLimit=32*1024*1024;
/** A 20 MiB transport body expands to at most 28 MiB of Base64 source.
 * @param {string} value */
function binaryLiteral(value){
  const limit=20*1024*1024;
  if(value.length>4*Math.ceil(limit/3))throw Error('Binary request exceeds 20 MiB.');
  let decoded;
  try{decoded=atob(value);}catch{throw Error('Binary file data is invalid. Select the file again.');}
  if(decoded.length>limit)throw Error('Binary request exceeds 20 MiB.');
  if(btoa(decoded)!==value)throw Error('Binary file data is invalid. Select the file again.');
  return `Uint8Array.from(atob(${JSON.stringify(value)}), character => character.charCodeAt(0))`;
}
/** Emit data literals, never interpolate request text into executable syntax.
 * Browser Fetch owns header normalization, CORS and multipart boundaries.
 * @param {CodeRequest} request */
export function javascriptFetchCode(request) {
  const multipart=request.postData?.mimeType==='multipart/form-data';
  const text=request.postData?.text??'';
  const binary=typeof request.bodyBase64==='string';
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
  if(multipart){
    lines.push('const form = new FormData();');
    for(const part of request.postData?.params||[]){
      if(part.fileName!==undefined)throw Error('Browser fetch file generation requires a file adapter.');
      lines.push(`form.append(${JSON.stringify(part.name)}, ${JSON.stringify(part.value??'')});`);
    }
  }
  const headers=request.headers.filter(row=>!multipart||row.name.toLowerCase()!=='content-type').map(row=>[row.name,row.value]);
  const body=binary?binaryLiteral(/** @type {string} */(request.bodyBase64)):multipart?'form':JSON.stringify(text);
  lines.push(`const options = {`, `  method: ${JSON.stringify(request.method)},`,
    `  headers: ${JSON.stringify(headers)},`,
    ...(hasBody?[`  body: ${body},`]:[]),
    '};', '', 'const response = await fetch(url, options);',
    'const data = await response.text();', 'console.log(data);');
  return lines.join('\n');
}
