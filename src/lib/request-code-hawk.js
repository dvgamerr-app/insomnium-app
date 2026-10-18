/** Standalone Hawk v1 runtime embedded in generated Native modules. Contract:
 * src-tauri/src/hawk.rs, including its legacy/Postman payload and ext modes.
 * @param {Record<string,any>} c @param {URL} url @param {string} method
 * @param {string[][]} headers @param {Uint8Array} body
 * @param {{hash:(algorithm:string,body:Uint8Array,mime:string)=>string,mac:(algorithm:string,key:string,value:string)=>string,nonce:()=>string,now:()=>string}} crypto */
export function hawkAuthorization(c,url,method,headers,body,crypto){
  const encoder=new TextEncoder();
  if(!c.id||!c.key)throw Error('Hawk ID and key are required.');
  if(!['sha1','sha256'].includes(c.algorithm))throw Error('Choose Hawk SHA1 or SHA256 in Auth.');
  if(!['legacy','standard','postman'].includes(c.bodyMode))throw Error('Choose a Hawk signing mode in Auth.');
  for(const [name,value] of [['ID',c.id],['nonce',c.nonce],['application',c.app],['delegation',c.dlg],['ext',c.ext]]){
    if(value.length>4096||/[^\x20-\x7e]/.test(value)||name!=='ext'&&/["\\]/.test(value))throw Error('Invalid Hawk '+name+'. Use printable ASCII, at most 4096 bytes; quotes/backslashes only in ext.');
  }
  if(encoder.encode(c.key).length>65536||c.legacyPayload!==null&&encoder.encode(c.legacyPayload).length>20*1024*1024)throw Error('Hawk key exceeds 64 KiB or legacy payload exceeds 20 MiB.');
  if(encoder.encode(c.legacyContentType).length>4096||/[\r\n]/.test(c.legacyContentType))throw Error('Invalid Hawk content type.');
  if(c.timestamp&&(!/^\d+$/.test(c.timestamp)||BigInt(c.timestamp)<=0n||BigInt(c.timestamp)>18446744073709551615n))throw Error('Hawk timestamp must be positive integer seconds, or blank to generate.');
  if(!c.app&&c.dlg)throw Error('Hawk delegation requires an application ID.');
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Hawk requires an HTTP(S) URL without embedded credentials.');
  let hostUrl=url;
  if(c.bodyMode==='standard'){
    const hosts=headers.filter(row=>row[0].toLowerCase()==='host');
    if(hosts.length>1)throw Error('Hawk signing requires one Host header.');
    if(hosts.length){
      const host=hosts[0][1];
      if(!host||/[\/@?# \\]/.test(host))throw Error('Invalid Hawk Host header.');
      hostUrl=new URL(url.protocol+'//'+host+'/');
    }
  }
  const host=c.bodyMode==='standard'?hostUrl.hostname:hostUrl.hostname.replace(/^\[|\]$/g,'');
  const port=hostUrl.port||(hostUrl.protocol==='https:'?'443':'80');
  let payload=null,mime=c.legacyContentType;
  if(c.bodyMode==='legacy')payload=c.legacyPayload===null?null:encoder.encode(c.legacyPayload);
  else if(c.bodyMode==='postman')payload=!c.postmanSkipPayload&&body.length?body:null;
  else{
    const types=headers.filter(row=>row[0].toLowerCase()==='content-type');
    if(c.validatePayload&&types.length>1)throw Error('Hawk payload signing requires one Content-Type header.');
    payload=body;mime=types[0]?.[1]??'';
  }
  const hash=c.validatePayload&&payload!==null?crypto.hash(c.algorithm,payload,mime.split(';')[0].trim().toLowerCase()):null;
  const timestamp=c.timestamp||crypto.now(),nonce=c.nonce||crypto.nonce();
  const ext=c.bodyMode==='postman'?c.ext.replace('\\','\\\\').replace('\n','\\n'):c.ext.replaceAll('\\','\\\\').replaceAll('\n','\\n');
  let normalized=['hawk.1.header',timestamp,nonce,method.toUpperCase(),url.pathname+url.search,host.toLowerCase(),port,hash??'',ext,''].join('\n');
  if(c.app)normalized+=c.app+'\n'+c.dlg+'\n';
  const mac=crypto.mac(c.algorithm,c.key,normalized);
  let value='Hawk id="'+c.id+'", ts="'+timestamp+'", nonce="'+nonce+'"';
  if(hash!==null)value+=', hash="'+hash+'"';
  if(c.ext)value+=', ext="'+c.ext.replace(/[\\"]/g,(/** @type {string} */char)=>'\\'+char)+'"';
  value+=', mac="'+mac+'"';
  if(c.app){value+=', app="'+c.app+'"';if(c.dlg)value+=', dlg="'+c.dlg+'"';}
  if(value.length>4096)throw Error('Hawk Authorization exceeds the 4096-byte header limit.');
  return value;
}
