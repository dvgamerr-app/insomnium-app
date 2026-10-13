export function relativePath(path) {
  if (typeof path !== 'string' || !path || path.includes('\\') || path.includes('\0') || path.includes(':') || path.startsWith('/') || path.split('/').some(p => !p || p === '.' || p === '..')) throw Error('Invalid native notice relative path');
  return path;
}
export function tarFiles(tar, prefix) {
  if(!Buffer.isBuffer(tar)||tar.length>256*1024*1024)throw Error('Frontend tar size bound'); const files=new Map(), names=new Set();
  let longName=null, pax=null, end=false;
  const string = bytes => bytes.toString('utf8').replace(/\0.*$/s,'');
  const octal = bytes => {const s=string(bytes).trim();if(!/^[0-7]+$/.test(s))throw Error('Invalid native archive numeric field');const n=parseInt(s,8);if(!Number.isSafeInteger(n))throw Error('Native archive size overflow');return n;};
  for(let offset=0;offset+512<=tar.length;) {
    const header=tar.subarray(offset,offset+512);
    if(header.every(x=>x===0)){if(tar.subarray(offset).some(x=>x!==0))throw Error('Native archive trailing nonzero data');end=true;break;}
    const sum=octal(header.subarray(148,156));let actual=0;for(let i=0;i<512;i++)actual+=i>=148&&i<156?32:header[i];if(actual!==sum)throw Error('Native archive header checksum mismatch');
    const size=octal(header.subarray(124,136)), start=offset+512, next=start+Math.ceil(size/512)*512;
    if(next>tar.length)throw Error('Truncated native archive');
    const data=tar.subarray(start,start+size),type=header[156]||48;
    let name=string(header.subarray(0,100)), pre=string(header.subarray(345,500));if(pre)name=pre+'/'+name;
    if(type===76){if(longName!==null||pax!==null)throw Error('Ambiguous native archive name extension');longName=string(data).replace(/\n$/,'');offset=next;continue;}
    if(type===120){if(pax!==null||longName!==null)throw Error('Ambiguous native archive PAX');pax={};let pos=0;while(pos<data.length){const space=data.indexOf(32,pos);if(space<0)throw Error('Malformed native archive PAX');const len=Number(data.subarray(pos,space).toString());if(!Number.isSafeInteger(len)||len<=space-pos+1||pos+len>data.length||data[pos+len-1]!==10)throw Error('Malformed native archive PAX');const line=data.subarray(space+1,pos+len-1).toString(),eq=line.indexOf('=');if(eq<1||Object.hasOwn(pax,line.slice(0,eq)))throw Error('Duplicate native archive PAX key');pax[line.slice(0,eq)]=line.slice(eq+1);pos+=len;}offset=next;continue;}
    if(longName!==null)name=longName;
    if(pax?.path!==undefined)name=pax.path;
    if(pax?.linkpath!==undefined||pax?.size!==undefined)throw Error('Unsupported native archive PAX link/size');
    longName=null;pax=null;
    if(type===53){if(size!==0)throw Error('Native archive directory payload refused');name=name.replace(/\/$/,'');}
    relativePath(name);
    if(!name.startsWith(prefix+'/') && name!==prefix)throw Error('Native archive package prefix mismatch');
    if(names.has(name))throw Error('Duplicate native archive path');names.add(name);
    if(type!==48&&type!==53)throw Error('Native archive link/entry type refused');
    if(type===48){const path=name.slice(prefix.length+1);relativePath(path);files.set(path,Buffer.from(data));}
    offset=next;
  }
  if(!end||longName!==null||pax!==null)throw Error('Unterminated native archive');
  return files;
}
