import {createPrivateKey as asapKey,sign as asapSign,constants as asapConstants,randomBytes as asapRandom,randomUUID as asapUuid} from 'node:crypto';
import {Buffer as AsapBuffer} from 'node:buffer';

/** Standalone local ASAP JWT runtime; no key discovery or token cache.
 * Contract: src-tauri/src/asap.rs. @param {Record<string,any>} c */
export function asapAuthorization(c){
  const utf8=new TextEncoder();
  /** @returns {string} */
  const stringify=(/** @type {any} */value,depth=0)=>{
    if(depth>128)throw Error('ASAP claims exceed the JSON nesting limit.');
    if(typeof value==='bigint')return value.toString();
    if(value===null||typeof value!=='object')return JSON.stringify(value)??'null';
    if(Array.isArray(value))return '['+value.map(item=>stringify(item,depth+1)).join(',')+']';
    return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stringify(value[key],depth+1)).join(',')+'}';
  };
  for(const name of ['issuer','subject','keyId','privateKey','additionalClaims'])if(utf8.encode(c[name]).length>65536)throw Error('An ASAP field exceeds 64 KiB.');
  if(utf8.encode(JSON.stringify(c.audience)).length>65536)throw Error('An ASAP field exceeds 64 KiB.');
  if(!['legacy','postman'].includes(c.claimsMode))throw Error('Choose an ASAP claims mode in Auth.');
  const postman=c.claimsMode==='postman',algorithm=c.algorithm||'RS256';
  if(!['RS256','RS384','RS512','PS256','PS384','PS512','ES256','ES384','ES512'].includes(algorithm)||!postman&&algorithm!=='RS256')throw Error('Legacy ASAP uses RS256; Postman supports RSA/PSS and ES256/ES384/ES512.');
  const source=c.additionalClaims.trim()||'{}',ordinary=JSON.parse(source);
  let marker='';
  do{marker='\0asap-number:'+asapUuid()+':';}while(JSON.stringify(ordinary).includes(JSON.stringify(marker).slice(1,-1)));
  // Tokenize numbers outside JSON strings, then restore native i64/u64 integers
  // without a Number conversion. JSON.parse still validates all JSON structure.
  const wrapped=source.replace(/"(?:[^"\\]|\\.)*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g,(/** @type {string} */token)=>token.startsWith('"')?token:JSON.stringify(marker+token));
  let extra=JSON.parse(wrapped,(_key,value)=>{
    if(typeof value!=='string'||!value.startsWith(marker))return value;
    const raw=value.slice(marker.length);
    if(/^-?\d+$/.test(raw)){
      const integer=BigInt(raw);
      if(integer>=-9223372036854775808n&&integer<=18446744073709551615n)return integer;
    }
    const number=Number(raw);if(!Number.isFinite(number))throw Error('ASAP claim number is out of range.');return number;
  });
  if(extra===null||typeof extra!=='object'||Array.isArray(extra)){
    if(!postman&&Array.isArray(extra))extra=Object.fromEntries(extra.map((value,index)=>[String(index),value]));
    else if(!postman&&!extra)extra={};else throw Error('ASAP additional claims must be a JSON object.');
  }
  if(Object.hasOwn(extra,'__proto__'))throw Error('Review the unsupported __proto__ claim in ASAP Auth.');
  const decimal=(/** @type {string} */text)=>{
    const match=/^[+-]?\d+/.exec(text.trimStart());if(!match)return null;
    const value=BigInt(match[0]);return value>=-9223372036854775808n&&value<=9223372036854775807n?value:null;
  };
  const now=BigInt(Math.floor(Date.now()/1000));if(now<0n)throw Error('System clock is before Unix epoch.');
  let duration=postman?3600n:600n;
  if(postman&&c.expirySeconds){duration=decimal(c.expirySeconds)||3600n;if(duration<1n||duration>3600n)throw Error('ASAP expiry must be 1–3600 seconds.');}
  const claims=Object.assign(Object.create(null),{iss:c.issuer,sub:c.subject||c.issuer,aud:c.audience,iat:now,nbf:now,exp:now+duration,jti:postman?asapUuid():asapRandom(20).toString('hex')});
  let kid=c.keyId;
  if(postman){
    delete claims.nbf;
    for(const name of ['iss','sub','aud','iat','exp','jti'])if(extra[name])claims[name]=extra[name];
    const value=extra.exp;
    // serde's float formatting uses scientific notation at large magnitudes.
    const text=typeof value==='number'&&Math.abs(value)>=1e16?value.toExponential():typeof value==='string'?value:stringify(value);
    claims.exp=value&&decimal(text)?decimal(text):now+duration;
    if(!extra.sub&&!c.subject)claims.sub=claims.iss;
    if(extra.kid){if(typeof extra.kid!=='string')throw Error('ASAP kid must be a string.');kid=extra.kid;}
    for(const [name,value] of Object.entries(extra))if(!['iss','sub','aud','iat','exp','jti'].includes(name))claims[name]=value;
    for(const name of ['iss','sub','jti'])if(typeof claims[name]!=='string'||!claims[name])throw Error('ASAP '+name+' must be a non-empty string.');
    if(!claims.aud)throw Error('ASAP audience is required.');
  }else{
    if(!c.issuer||!c.audience)throw Error('ASAP issuer and audience are required before additional-claims overrides.');
    Object.assign(claims,extra);
  }
  for(const name of ['iat','nbf','exp'])if(Object.hasOwn(claims,name)&&!['number','bigint'].includes(typeof claims[name]))throw Error('ASAP '+name+' must be numeric seconds.');
  if(claims.iat===0||claims.iat===0n)claims.iat=now;
  let text=c.privateKey.replaceAll('\\n','\n').replaceAll('"','').trim(),der=null,dataUri=false;
  const base64=(/** @type {string} */value)=>{
    if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw Error('Invalid ASAP base64 key data.');
    const bytes=AsapBuffer.from(value,'base64');if(bytes.toString('base64')!==value)throw Error('Invalid ASAP base64 key data.');return bytes;
  };
  if(text.startsWith('data:')){
    if(/%(?![\da-f]{2})/i.test(text))throw Error('Invalid ASAP data URI percent encoding.');
    text=decodeURIComponent(text);const match=/^data:application\/pkcs8;kid=([A-Za-z0-9_.+\/-]+);base64,(.*)$/.exec(text);
    if(!match)throw Error('Expected data:application/pkcs8;kid=...;base64,...');
    if(kid&&kid!==match[1])throw Error('ASAP key ID does not match the data URI.');
    kid=match[1];der=base64(match[2]);dataUri=true;
  }else if(!text.startsWith('-----BEGIN')){
    const bytes=base64(text.replace(/\s/g,''));
    if(bytes.subarray(0,10).toString()==='-----BEGIN')text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);else der=bytes;
  }
  if(!kid)throw Error('ASAP Key ID is required (or include kid in a PKCS8 data URI).');
  const ec=algorithm.startsWith('ES');
  let key;
  if(der){
    const formats=dataUri||ec&&algorithm!=='ES512'?['pkcs8']:ec?['pkcs8','sec1']:['pkcs8','pkcs1'];
    for(const type of formats){try{key=asapKey({key:der,format:'der',type:/** @type {'pkcs8'|'pkcs1'|'sec1'} */(type)});break;}catch{/* Try only native-supported formats. */}}
    if(!key)throw Error('Invalid ASAP private key format.');
  }else{
    if(!/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(text)||ec&&algorithm!=='ES512'&&!text.startsWith('-----BEGIN PRIVATE KEY-----'))throw Error('ASAP requires an unencrypted private key in the selected format.');
    key=asapKey(text);
  }
  const bits=Number(algorithm.slice(2)),hash='sha'+bits;
  if(ec){
    const curve=algorithm==='ES256'?'prime256v1':algorithm==='ES384'?'secp384r1':'secp521r1';
    if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!==curve)throw Error('ASAP EC key must match the selected curve.');
  }else if(key.asymmetricKeyType!=='rsa'||!key.asymmetricKeyDetails?.modulusLength||key.asymmetricKeyDetails.modulusLength<2048||key.asymmetricKeyDetails.modulusLength>8192)throw Error('ASAP RSA keys must be between 2048 and 8192 bits.');
  const header=postman?{alg:algorithm,kid}:{typ:'JWT',alg:algorithm,kid};
  const input=AsapBuffer.from(JSON.stringify(header)).toString('base64url')+'.'+AsapBuffer.from(stringify(claims)).toString('base64url');
  const signature=ec?asapSign(hash,AsapBuffer.from(input),{key,dsaEncoding:'ieee-p1363'}):asapSign(hash,AsapBuffer.from(input),{key,padding:algorithm.startsWith('PS')?asapConstants.RSA_PKCS1_PSS_PADDING:asapConstants.RSA_PKCS1_PADDING,...(algorithm.startsWith('PS')?{saltLength:asapConstants.RSA_PSS_SALTLEN_DIGEST}:{})});
  const token=input+'.'+signature.toString('base64url');if(token.length>65536)throw Error('ASAP token exceeds 64 KiB.');return 'Bearer '+token;
}
