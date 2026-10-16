/** Resolve legacy import locations without exposing IO inside the guest.
 * @param {string} uri */
export function pluginImportLocation(uri){
  if(typeof uri!=='string'||!uri)throw Error('Enter an import URI');
  let url;
  try{url=new URL(uri);}catch{return {kind:'raw',value:decodeURIComponent(uri)};}
  if(url.origin==='https://github.com'){
    url.hostname='raw.githubusercontent.com';
    const parts=url.pathname.split('/');if(parts[3]==='blob')parts.splice(3,1);
    url.pathname=parts.join('/');
  }
  if(['http:','https:'].includes(url.protocol)){
    if(url.username||url.password)throw Error('Import URI must not contain embedded credentials');
    return {kind:'http',value:url.href};
  }
  if(url.protocol==='file:'){
    let path=decodeURIComponent(url.pathname);
    if(/^\/[a-z]:\//i.test(path))path=path.slice(1);
    if(url.hostname&&url.hostname!=='localhost')path='//'+url.hostname+path;
    return {kind:'file',value:path};
  }
  return {kind:'raw',value:decodeURIComponent(uri)};
}
/** Host-owned IO remains cancellable; content is imported only after it settles.
 * @param {string} uri @param {{signal:AbortSignal,fetchText:(url:string,signal:AbortSignal)=>Promise<string>,readText:(path:string,signal:AbortSignal)=>Promise<string>}} options */
export async function readPluginImportUri(uri,options){
  options.signal.throwIfAborted();
  const source=pluginImportLocation(uri);
  const text=source.kind==='http'?await options.fetchText(source.value,options.signal):source.kind==='file'?await options.readText(source.value,options.signal):source.value;
  options.signal.throwIfAborted();
  return text;
}
