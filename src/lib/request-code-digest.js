/** Self-contained RFC7616 runtime, embedded in generated Native modules. Keep
 * all dependencies in parameters so bundled function source remains portable.
 * @param {string[]} values @param {{username:string,password:string}} credentials
 * @param {string} method @param {string} target @param {Uint8Array} body
 * @param {{hash:(algorithm:string,value:string|Uint8Array)=>string,nonce:()=>string}} crypto
 * @returns {{header:string,stale:boolean}} */
export function digestAuthorization(values,credentials,method,target,body,crypto){
  const token="[!#$%&'*+.^_`|~0-9A-Za-z-]+";
  const field=new RegExp('^('+token+')[ \\t]*=[ \\t]*(.*)$');
  const scheme=new RegExp('^('+token+')(?:[ \\t]+(.*))?$');
  /** @type {{scheme:string,fields:Map<string,string>,valid:boolean}[]} */
  const challenges=[];
  for(const value of values){
    const pieces=[];let piece='',quoted=false,escaped=false;
    for(const char of value){
      if(char===','&&!quoted){pieces.push(piece.trim());piece='';continue;}
      piece+=char;
      if(escaped)escaped=false;
      else if(char==='\\'&&quoted)escaped=true;
      else if(char==='"')quoted=!quoted;
    }
    pieces.push(piece.trim());
    if(quoted||escaped)continue;
    /** @type {{scheme:string,fields:Map<string,string>,valid:boolean}|null} */
    let current=null;
    for(let part of pieces){
      if(!field.test(part)){
        const match=scheme.exec(part);
        if(!match){if(current)current.valid=false;continue;}
        current={scheme:match[1].toLowerCase(),fields:new Map(),valid:true};
        challenges.push(current);part=match[2]??'';
        if(!part)continue;
      }
      const pair=field.exec(part);
      if(!current||!pair){if(current)current.valid=false;continue;}
      const name=pair[1].toLowerCase(),raw=pair[2];
      let decoded;
      if(/^"(?:[^"\\]|\\.)*"$/.test(raw))decoded=raw.slice(1,-1).replace(/\\(.)/g,'$1');
      else if(new RegExp('^'+token+'$').test(raw))decoded=raw;
      else{current.valid=false;continue;}
      if(current.fields.has(name))current.valid=false;
      current.fields.set(name,decoded);
    }
  }
  for(const challenge of challenges){
    if(challenge.scheme!=='digest'||!challenge.valid)continue;
    const p=challenge.fields,realm=p.get('realm'),nonce=p.get('nonce');
    if(realm===undefined||nonce===undefined)continue;
    const charset=p.get('charset')?.toLowerCase();
    if(charset!==undefined&&charset!=='utf-8')continue;
    const algorithm=(p.get('algorithm')??'MD5').toUpperCase(),session=algorithm.endsWith('-SESS');
    const base=session?algorithm.slice(0,-5):algorithm;
    const hashName=base==='MD5'?'md5':base==='SHA-256'?'sha256':base==='SHA-512-256'?'sha512-256':null;
    if(!hashName)continue;
    const offered=p.get('qop')?.split(',').map(value=>value.trim().toLowerCase());
    const qop=offered?.includes('auth-int')?'auth-int':offered?.includes('auth')?'auth':null;
    if(offered&&!qop||session&&!qop)continue;
    const hash=(/** @type {string|Uint8Array} */value)=>crypto.hash(hashName,value);
    const username=charset==='utf-8'?credentials.username.normalize('NFC'):credentials.username;
    const password=charset==='utf-8'?credentials.password.normalize('NFC'):credentials.password;
    if(username.includes(':'))throw Error('Digest usernames cannot contain a colon.');
    const cnonce=qop?crypto.nonce():'',nc='00000001';
    let ha1=hash(username+':'+realm+':'+password);
    if(session)ha1=hash(ha1+':'+nonce+':'+cnonce);
    const ha2=hash(method+':'+target+(qop==='auth-int'?':'+hash(body):''));
    const response=hash(ha1+':'+nonce+':'+(qop?nc+':'+cnonce+':'+qop+':':'')+ha2);
    const quote=(/** @type {string} */value)=>{
      if(/[\x00-\x08\x0a-\x1f\x7f]/.test(value))throw Error('Invalid Digest header value.');
      return '"'+value.replace(/[\\"]/g,char=>'\\'+char)+'"';
    };
    const userhash=p.get('userhash')?.toLowerCase()==='true';
    let user;
    if(userhash)user='username='+quote(hash(username+':'+realm));
    else if(/[^\x00-\x7f]/.test(username)){
      let encoded='';
      for(const byte of new TextEncoder().encode(username))encoded+=byte>=48&&byte<=57||byte>=65&&byte<=90||byte>=97&&byte<=122?String.fromCharCode(byte):'%'+byte.toString(16).toUpperCase().padStart(2,'0');
      user="username*=UTF-8''"+encoded;
    }else user='username='+quote(username);
    const fields=[user,'realm='+quote(realm),'nonce='+quote(nonce),'uri='+quote(target),'response='+quote(response),'algorithm='+base+(session?'-sess':'')];
    if(p.has('opaque'))fields.push('opaque='+quote(p.get('opaque')??''));
    if(qop)fields.push('qop='+qop,'nc='+nc,'cnonce='+quote(cnonce));
    if(userhash)fields.push('userhash=true');
    return {header:'Digest '+fields.join(', '),stale:p.get('stale')?.toLowerCase()==='true'};
  }
  throw Error('The server returned no supported Digest challenge.');
}
