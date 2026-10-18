/** Standalone OAuth1 signing runtime. Match src-tauri/src/oauth1.rs, including
 * explicit legacy behavior; no token exchange or credentials discovery.
 * @param {Record<string,any>} c @param {URL} url @param {string} method
 * @param {string[][]} headers @param {Uint8Array} body
 * @param {{hash:(algorithm:string,value:Uint8Array)=>string,mac:(algorithm:string,key:string,value:string)=>string,rsa:(key:string,value:string)=>string,nonce:()=>string,now:()=>string}} crypto */
export function oauth1Sign(c,url,method,headers,body,crypto){
  const utf8=new TextEncoder(),decode=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
  const encode=(/** @type {string} */value)=>encodeURIComponent(value).replace(/[!'()*]/g,char=>'%'+char.charCodeAt(0).toString(16).toUpperCase());
  const parameters=(/** @type {string} */text)=>text.split('&').filter(Boolean).map(part=>{
    const index=part.indexOf('='),pair=index<0?[part,'']:[part.slice(0,index),part.slice(index+1)];
    return pair.map(value=>decodeURIComponent(value.replaceAll('+',' ').replace(/%(?![\da-f]{2})/gi,'%25')));
  });
  if(!c.consumerKey)throw Error('OAuth1 consumer key is required.');
  if(!['HMAC-SHA1','HMAC-SHA256','RSA-SHA1','PLAINTEXT'].includes(c.signatureMethod))throw Error('Choose a supported OAuth1 signature method.');
  if(!['standard','legacy'].includes(c.bodyMode))throw Error('Choose RFC 5849 or legacy OAuth1 signing explicitly.');
  if(c.timestamp&&!/^\d+$/.test(c.timestamp))throw Error('OAuth1 timestamp must contain decimal seconds.');
  for(const key of ['consumerKey','consumerSecret','tokenKey','tokenSecret','privateKey','callback','verifier','version','nonce','timestamp','realm'])if(utf8.encode(c[key]).length>65536)throw Error('An OAuth1 credential field exceeds 64 KiB.');
  if(c.legacyBodyJson!==null&&utf8.encode(c.legacyBodyJson).length>20*1024*1024)throw Error('OAuth1 legacy body exceeds 20 MiB.');
  const rows=(/** @type {string} */name)=>headers.filter(row=>row[0].toLowerCase()===name);
  if(rows('host').length>1||rows('content-type').length>1)throw Error('OAuth1 requires a single Host and Content-Type header.');
  if(c.bodyMode==='standard'&&!c.tokenKey&&c.tokenSecret)throw Error('OAuth1 token secret requires a token key.');
  const form=(rows('content-type')[0]?.[1]??'').split(';')[0].trim().toLowerCase()==='application/x-www-form-urlencoded';
  const legacyHash=c.bodyMode==='legacy'&&c.includeBodyHash&&form,query=url.search.slice(1);
  const params=parameters(query);
  if(c.bodyMode==='legacy'&&query){
    const seen=new Map();
    for(const part of query.split('&')){
      const index=part.indexOf('='),key=index<0?part:part.slice(0,index),value=index<0?'':part.slice(index+1);
      if(!part||key.includes('%')||part.includes('+')||value.includes('=')||['__proto__','constructor','toString'].includes(key)||seen.has(key)&&(!seen.get(key)||!value))throw Error('This query uses ambiguous legacy OAuth1 encoding. Choose RFC 5849 explicitly.');
      seen.set(key,value);
    }
  }
  if(c.bodyMode==='standard'&&form)for(const row of parameters(decode.decode(body)))params.push(row);
  if(params.some(row=>row[0].startsWith('oauth_')))throw Error('Set OAuth1 protocol parameters in Auth rather than the URL or form body.');
  const now=crypto.now();
  if(!/^\d+$/.test(now))throw Error('Invalid system clock.');
  const oauth=[['oauth_consumer_key',c.consumerKey],['oauth_nonce',legacyHash||!c.nonce?crypto.nonce():c.nonce],['oauth_signature_method',c.signatureMethod],['oauth_timestamp',legacyHash||!c.timestamp?now:c.timestamp]];
  if(c.version||c.bodyMode==='legacy'||c.addEmptyParamsToSign)oauth.push(['oauth_version',c.version||(c.bodyMode==='legacy'?'1.0':'')]);
  if(c.tokenKey||c.addEmptyParamsToSign)oauth.push(['oauth_token',c.tokenKey]);
  if(!legacyHash){if(c.callback)oauth.push(['oauth_callback',c.callback]);if(c.verifier)oauth.push(['oauth_verifier',c.verifier]);}
  const key=encode(c.consumerSecret)+'&'+encode(c.tokenKey?c.tokenSecret:'');
  const signature=(/** @type {string} */value,/** @type {boolean} */legacy)=>c.signatureMethod==='PLAINTEXT'?(legacy?value:key):c.signatureMethod==='RSA-SHA1'?crypto.rsa(c.privateKey,value):crypto.mac(c.signatureMethod==='HMAC-SHA256'?'sha256':'sha1',key,value);
  if(legacyHash){
    if(c.legacyBodyJson===null)throw Error('Missing resolved legacy OAuth1 form data.');
    oauth.push(['oauth_body_hash',signature(c.legacyBodyJson,true)]);
  }else if(c.bodyMode==='standard'&&c.includeBodyHash){
    if(form)throw Error('RFC form bodies are signed as parameters. Disable Hash Body or choose legacy mode.');
    if(c.signatureMethod==='PLAINTEXT')throw Error('The body-hash extension does not define PLAINTEXT.');
    oauth.push(['oauth_body_hash',crypto.hash(c.signatureMethod==='HMAC-SHA256'?'sha256':'sha1',body)]);
  }
  const encoded=[...params,...oauth].map(row=>row.map(encode)).sort((a,b)=>a[0]===b[0]?(a[1]<b[1]?-1:a[1]>b[1]?1:0):a[0]<b[0]?-1:1);
  const normalized=encoded.map(row=>row.join('=')).join('&');
  const base=new URL(url);base.search='';base.hash='';
  if(!['http:','https:'].includes(base.protocol)||base.username||base.password)throw Error('OAuth1 requires an HTTP(S) URL without user information.');
  const host=rows('host')[0]?.[1];
  if(host!==undefined){
    const authority=new URL(base.protocol+'//'+host+'/');
    if(authority.pathname!=='/'||authority.search||authority.hash||authority.username||authority.password)throw Error('Invalid OAuth1 Host header.');
    base.hostname=authority.hostname;base.port=authority.port;
  }
  oauth.push(['oauth_signature',signature(method.toUpperCase()+'&'+encode(base.href)+'&'+encode(normalized),c.bodyMode==='legacy')]);
  oauth.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
  headers=headers.filter(row=>row[0].toLowerCase()!=='authorization');
  if(c.addParamsToHeader!==false){
    const parts=oauth.filter(row=>row[1]!=='').map(([name,value])=>name+'="'+(c.disableHeaderEncoding?value.trim():encode(value))+'"');
    if(c.realm&&(!c.disableHeaderEncoding||c.realm.trim()))parts.unshift('realm="'+(c.disableHeaderEncoding?c.realm:encode(c.realm))+'"');
    const value='OAuth '+parts.join(', ');
    if(utf8.encode(value).length>65536||/[\x00-\x08\x0a-\x1f\x7f]/.test(value))throw Error('Invalid or oversized OAuth1 authorization header.');
    headers.push(['Authorization',value]);
  }else{
    const encoded=oauth.map(([name,value])=>encode(name)+'='+encode(value)).join('&');
    if(encoded.length>65536)throw Error('OAuth1 parameters exceed 64 KiB.');
    if(['POST','PUT'].includes(method)&&form){
      const suffix=utf8.encode((body.length?'&':'')+encoded),combined=new Uint8Array(body.length+suffix.length);
      if(combined.length>20*1024*1024)throw Error('Signed request body exceeds 20 MiB.');
      combined.set(body);combined.set(suffix,body.length);body=combined;
      headers=headers.filter(row=>!['content-length','transfer-encoding'].includes(row[0].toLowerCase()));
      headers.push(['Content-Length',String(body.length)]);
    }else url.search=(query?query+'&':'')+encoded;
  }
  return {headers,body};
}
