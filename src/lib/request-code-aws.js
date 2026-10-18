/** Standalone SigV4 runtime. Match src-tauri/src/aws.rs and its pinned
 * aws-sigv4 settings (including S3 and legacy CodeCommit GIT).
 * @param {Record<string,any>} c @param {URL} url @param {string} method
 * @param {string[][]} headers @param {Uint8Array} body
 * @param {{hash:(value:string|Uint8Array)=>string,mac:(key:string|Uint8Array,value:string)=>Uint8Array,now:()=>string}} crypto */
export function awsSign(c,url,method,headers,body,crypto){
  const utf8=new TextEncoder();
  const encode=(/** @type {string} */value)=>encodeURIComponent(value).replace(/[!'()*]/g,char=>'%'+char.charCodeAt(0).toString(16).toUpperCase());
  const reserved=new Set(['x-amz-signature','x-amz-algorithm','x-amz-credential','x-amz-security-token','x-amz-date','x-amz-expires','x-amz-signedheaders']);
  if(c.addAuthDataToQuery&&(!Number.isInteger(c.expiresIn)||c.expiresIn<1||c.expiresIn>604800))throw Error('AWS query signing expiry must be 1–604800 seconds.');
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('AWS signing requires an HTTP(S) URL without embedded credentials.');
  for(const name of ['accessKeyId','secretAccessKey','sessionToken'])if(utf8.encode(c[name]).length>65536||/[\x00-\x1f\x7f-\x9f]/.test(c[name]))throw Error('AWS credential contains control characters or exceeds 64 KiB.');
  if(!c.accessKeyId||!c.secretAccessKey)throw Error('AWS access key ID and secret access key are required.');
  if(/[\/, ]/.test(c.accessKeyId))throw Error('AWS access key ID contains invalid characters.');
  const hosts=headers.filter(row=>row[0].toLowerCase()==='host');
  if(hosts.length>1)throw Error('AWS signing requires a single Host header.');
  const host=hosts[0]?.[1]??url.host;
  if(!host||/[^\x09\x20-\x7e]|[\/@?# \\]/.test(host))throw Error('AWS Host must be an ASCII hostname with an optional port.');
  const hostUrl=new URL('http://'+host+'/');
  const hostname=hostUrl.hostname.replace(/\.$/,'').toLowerCase();
  let inferredService='',inferredRegion='us-east-1';
  const endpoint=/^(.*)\.amazonaws\.com(?:\.cn)?$/.exec(hostname);
  if(endpoint){
    const parts=endpoint[1].split('.');
    let service=parts.length>1?parts[parts.length-2]:parts[0],region=parts.length>1?parts[parts.length-1]:'';
    if(region==='es'||region==='aoss')[service,region]=[region,service];
    if(region==='s3'){service='s3';region='us-east-1';}
    else if(service.startsWith('s3-')||region.startsWith('s3-')){region=(service.startsWith('s3-')?service:region).slice(3);service='s3';}
    inferredService=service==='email'?'ses':service;inferredRegion=region||'us-east-1';
  }
  let service=c.service||inferredService;const region=c.region||inferredRegion;
  if(service==='email')service='ses';
  for(const value of [service,region])if(!/^[A-Za-z0-9-]{1,128}$/.test(value))throw Error('Set a valid AWS service and region explicitly in Auth.');
  const originalQuery=url.search.slice(1),query=[...url.searchParams];
  if(query.some(([name])=>reserved.has(name.toLowerCase())))throw Error('Remove AWS signing parameters from the URL or disable AWS IAM.');
  headers=headers.filter(row=>!['authorization','x-amz-date','x-amz-security-token','x-amz-content-sha256','host'].includes(row[0].toLowerCase()));
  headers.push(['Host',host]);
  for(const [,value] of headers)if(/[^\x09\x20-\x7e]/.test(value))throw Error('AWS signed headers must contain ASCII characters.');
  const stamp=crypto.now();
  if(!/^\d{8}T\d{6}Z$/.test(stamp))throw Error('AWS signing requires a four-digit UTC year.');
  const codecommit=!c.addAuthDataToQuery&&service==='codecommit'&&method==='GIT';
  const scope=stamp.slice(0,8)+'/'+region+'/'+service+'/aws4_request';
  const signature=(/** @type {string} */canonical,/** @type {string} */timestamp)=>{
    let key=crypto.mac('AWS4'+c.secretAccessKey,stamp.slice(0,8));
    for(const value of [region,service,'aws4_request'])key=crypto.mac(key,value);
    return Array.from(crypto.mac(key,['AWS4-HMAC-SHA256',timestamp,scope,crypto.hash(canonical)].join('\n')),byte=>byte.toString(16).padStart(2,'0')).join('');
  };
  const normalize=(/** @type {string} */value)=>value.replace(/^ +| +$/g,'').replace(/ +/g,' ');
  const normalizePath=(/** @type {string} */path)=>{
    const parts=[];
    for(const part of path.split('/'))if(part==='..')parts.pop();else if(part&&part!=='.')parts.push(part);
    let value='/'+parts.join('/');
    if((path.endsWith('/')||path.endsWith('/.')||path.endsWith('/..'))&&!value.endsWith('/'))value+='/';
    return value;
  };
  const sort=(/** @type {string[][]} */pairs)=>pairs.sort((a,b)=>a[0]===b[0]?(a[1]<b[1]?-1:a[1]>b[1]?1:0):a[0]<b[0]?-1:1).map(row=>row.join('=')).join('&');
  if(codecommit){
    const types=headers.filter(row=>row[0].toLowerCase()==='content-type');
    if(types.length>1)throw Error('CodeCommit signing requires one Content-Type header.');
    const signed=types.map(row=>['content-type',row[1].trim().replace(/\s+/g,' ')]);
    signed.push(['host',host.trim().replace(/\s+/g,' ')]);
    const names=signed.map(row=>row[0]).join(';');
    const path=normalizePath(url.pathname).split('/').map(encode).join('/');
    const canonical=['GIT',path,sort(query.slice(0,1000).filter(row=>row[0]).map(row=>row.map(encode))),signed.map(([name,value])=>name+':'+value+'\n').join(''),names,''].join('\n');
    headers.push(['Authorization','AWS4-HMAC-SHA256 Credential='+c.accessKeyId+'/'+scope+', SignedHeaders='+names+', Signature='+signature(canonical,stamp.slice(0,-1))]);
    return headers;
  }
  const payload=c.addAuthDataToQuery&&service==='s3'?'UNSIGNED-PAYLOAD':crypto.hash(body);
  if(!c.addAuthDataToQuery){
    headers.push(['X-Amz-Date',stamp]);
    if(c.sessionToken)headers.push(['X-Amz-Security-Token',c.sessionToken]);
    if(service==='s3')headers.push(['X-Amz-Content-Sha256',payload]);
  }
  const excluded=new Set(['authorization','user-agent','x-amzn-trace-id','transfer-encoding','connection','content-length','expect','te','trailer','upgrade','proxy-authorization','proxy-authenticate','keep-alive','accept-encoding','sec-websocket-key','sec-websocket-version','sec-websocket-extensions','sec-websocket-protocol','cookie']);
  if(c.addAuthDataToQuery){excluded.add('x-amz-user-agent');excluded.add('x-amz-checksum-mode');}
  /** @type {Map<string,string[]>} */const values=new Map();
  for(const [name,value] of headers){const key=name.toLowerCase();if(excluded.has(key))continue;const list=values.get(key)??[];list.push(normalize(value));values.set(key,list);}
  const names=[...values.keys()].sort(),signedHeaders=names.join(';');
  const canonicalHeaders=names.map(name=>name+':'+values.get(name)?.join(',')+'\n').join('');
  const added=c.addAuthDataToQuery?[['X-Amz-Date',stamp],['X-Amz-Expires',String(c.expiresIn)],['X-Amz-Algorithm','AWS4-HMAC-SHA256'],['X-Amz-Credential',c.accessKeyId+'/'+scope],['X-Amz-SignedHeaders',signedHeaders],...(c.sessionToken?[['X-Amz-Security-Token',c.sessionToken]]:[])]:[];
  const path=service==='s3'?url.pathname:normalizePath(url.pathname).split('/').map(encode).join('/');
  const canonical=[method,path,sort([...query,...added].map(row=>row.map(encode))),canonicalHeaders,signedHeaders,payload].join('\n');
  const mac=signature(canonical,stamp);
  if(c.addAuthDataToQuery){
    added.push(['X-Amz-Signature',mac]);
    url.search=(originalQuery?originalQuery+'&':'')+added.map(([name,value])=>encode(name)+'='+encode(value)).join('&');
  }else headers.push(['Authorization','AWS4-HMAC-SHA256 Credential='+c.accessKeyId+'/'+scope+', SignedHeaders='+signedHeaders+', Signature='+mac]);
  return headers;
}
