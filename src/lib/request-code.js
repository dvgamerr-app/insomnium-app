import {multipartCode} from './request-code-multipart.js';
/** @typedef {{digest?:{username:string,password:string}|null,ntlm?:{username:string,password:string,domain:string,workstation:string}|null,netrc?:boolean}} NativeAuth */
/** @typedef {{method:string,url:string,headers:{name:string,value:string}[],cookies:{name:string,value:string}[],postData?:{text?:string},bodyBase64?:string|null,serializedMultipart?:boolean,multipartParts?:import('./request-code-multipart.js').MultipartPart[]|null,multipartContentType?:string|null,socketPath?:string|null,suppressDefaultHeaders?:string[],nativeAuth?:NativeAuth|null,hawk?:Record<string,any>|null,oauth1?:Record<string,any>|null,aws?:Record<string,any>|null,asap?:Record<string,any>|null}} CodeRequest */
export const generatedCodeLimit=32*1024*1024;
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
/** @param {string} value */
function shellQuote(value){
  if(value.includes('\0'))throw Error('Shell arguments cannot contain NUL bytes.');
  return "'"+value.replaceAll("'","'\"'\"'")+"'";
}
/** @param {CodeRequest} request */
function curlParts(request){
  if(request.asap)throw Error('cURL cannot export ASAP authentication. Use the native sender.');
  if(request.aws)throw Error('cURL cannot export AWS signatures. Use the native sender.');
  if(request.oauth1)throw Error('cURL cannot export OAuth1 authentication. Use the native sender.');
  if(request.hawk)throw Error('cURL cannot export Hawk authentication. Use the native sender.');
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
  /** @type {[string,string?][]} */
  const options=[['silent'],['show-error'],['globoff'],['path-as-is'],['request',request.method],['url',request.url]];
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
      options.push([auth.digest?'digest':'ntlm'],['user',username+':'+credentials.password]);
    }else if(auth.netrc)options.push(['netrc-optional']);
  }
  if(request.socketPath)options.push(['unix-socket',request.socketPath]);
  for(const [name,value] of headers)options.push(['header',name+(value===''?';':': '+value)]);
  const hasBody=encoded!==null||text!=='';
  if(request.method==='HEAD'){
    if(hasBody)throw Error('cURL cannot export HEAD with a body. Use the native sender.');
    options.push(['head']);
  }
  if(request.suppressDefaultHeaders?.includes('accept')&&!hasHeader('accept'))options.push(['header','Accept:']);
  // --data-binary would otherwise add its own form Content-Type.
  if(hasBody&&!hasHeader('content-type'))options.push(['header','Content-Type:']);
  const warning=auth?.digest?'# cURL cannot handle Digest auth-int for PUT/POST. Use the native sender.\n':'';
  return {options,encoded,text,hasBody,warning};
}
/** POSIX shell; a quoted heredoc preserves binary bytes without shell expansion.
 * @param {CodeRequest} request */
export function shellCurlCode(request){
  const {options,encoded,text,warning}=curlParts(request);
  const command=['curl --disable',...options.map(([name,value])=>'--'+name+(value===undefined?'':' '+shellQuote(value)))];
  if(encoded!==null)command.push('--data-binary @-');
  else if(text!=='')command.push('--data-binary '+shellQuote(text));
  const source=command.join(' \\\n  ');
  const output=encoded===null?source:"# POSIX shell; requires curl and base64 -d.\nbase64 -d <<'INSOMNIUM_BODY' | "+source+'\n'+(encoded.match(/.{1,76}/g)?.join('\n')??'')+'\nINSOMNIUM_BODY';
  return warning+output;
}
/** @param {string} value */
function utf8Base64(value){
  const bytes=new TextEncoder().encode(value);let data='';
  for(let offset=0;offset<bytes.length;offset+=8192)data+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
  return btoa(data);
}
/** Windows PowerShell 5.1+; files avoid native argument quoting and binary-pipeline conversion.
 * @param {CodeRequest} request */
export function windowsCurlCode(request){
  const {options,encoded,text,hasBody,warning}=curlParts(request);
  const config=options.map(([name,value])=>{
    if(value===undefined)return name;
    if(value.includes('\0'))throw Error('cURL arguments cannot contain NUL bytes.');
    const escaped=value.replace(/[\\"\t\n\r\v]/g,char=>({'\\':'\\\\','"':'\\"','\t':'\\t','\n':'\\n','\r':'\\r','\v':'\\v'}[char]??char));
    return name+' = "'+escaped+'"';
  }).join('\n')+'\n';
  return warning+`# Windows PowerShell 5.1+; requires curl.exe.
$curlDirectory = [IO.Path]::Combine([IO.Path]::GetTempPath(), 'insomnium-curl-' + [Guid]::NewGuid().ToString('N'))
$curlConfig = [IO.Path]::Combine($curlDirectory, 'request.conf')
$curlBody = [IO.Path]::Combine($curlDirectory, 'body.bin')
$null = [IO.Directory]::CreateDirectory($curlDirectory)
try {
  [IO.File]::WriteAllBytes($curlConfig, [Convert]::FromBase64String('${utf8Base64(config)}'))
${hasBody?`  [IO.File]::WriteAllBytes($curlBody, [Convert]::FromBase64String('${encoded??utf8Base64(text)}'))\n`:''}  & curl.exe --disable --config $curlConfig${hasBody?" --data-binary ('@' + $curlBody)":''}
  if ($LASTEXITCODE -ne 0) { throw "curl.exe exited with code $LASTEXITCODE" }
} finally {
  [IO.File]::Delete($curlConfig)
  [IO.File]::Delete($curlBody)
  [IO.Directory]::Delete($curlDirectory)
}`;
}
