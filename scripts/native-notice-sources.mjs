import {lstat, readdir, mkdir, open, rename} from 'node:fs/promises';
import {join, basename, resolve, dirname} from 'node:path';

export const sha256 = bytes => new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
export const compare = (a,b) => a < b ? -1 : a > b ? 1 : 0;
export const jsonBytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
export function relativePath(path) {
  if (typeof path !== 'string' || !path || path.includes('\\') || path.includes('\0') || path.includes(':') || path.startsWith('/') || path.split('/').some(p => !p || p === '.' || p === '..')) throw Error('Invalid native notice relative path');
  return path;
}
export async function fileBytes(path) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw Error('Native notice source must be a regular file');
  return Buffer.from(await Bun.file(path).bytes());
}
export async function optionalBytes(path) {
  try { return await fileBytes(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
export async function treeFiles(directory) {
  const rootStat = await lstat(directory);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw Error('Native notice tree must be an owned directory');
  const files = new Map();
  async function walk(at, prefix='') {
    for (const entry of (await readdir(at,{withFileTypes:true})).sort((a,b)=>compare(a.name,b.name))) {
      if (['.git','target','node_modules'].includes(entry.name)) continue;
      const path = relativePath(prefix + entry.name), full = join(at,entry.name);
      if (entry.isSymbolicLink()) throw Error('Native notice external/symbolic source refused');
      if (entry.isDirectory()) await walk(full,path+'/');
      else files.set(path,await fileBytes(full));
    }
  }
  await walk(directory);
  return files;
}
export function treeDigest(files) { return sha256(jsonBytes([...files].map(([path,b])=>({path,bytes:b.length,sha256:sha256(b)})).sort((a,b)=>compare(a.path,b.path)))); }
export function candidates(files, manifest) {
  const paths = [...files.keys()].filter(p=>/^(licen[cs]e|notice|copying|copyright)(?:$|[._-])/i.test(basename(p)) && !/\.(rs|json)$/i.test(p));
  const declared = manifest.package?.['license-file'];
  if (declared !== undefined) {
    relativePath(declared);
    if (!files.has(declared)) throw Error('Missing declared native license-file');
    if (!paths.includes(declared)) paths.push(declared);
  }
  return paths.sort(compare);
}
// Data-only ustar parser: no extraction to the host filesystem.
export function archiveFiles(gzip, prefix) {
  const tar=Buffer.from(Bun.gunzipSync(gzip)), files=new Map(), names=new Set();
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
export async function registryArchive(cargoHome, name, version) {
  const directory=resolve(cargoHome,'registry/cache');
  let namespaces;try{namespaces=await readdir(directory,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return null;throw error;}
  const found=[];
  for(const namespace of namespaces.sort((a,b)=>compare(a.name,b.name))) {
    if(namespace.isSymbolicLink())throw Error('Native cache namespace symlink refused');
    if(!namespace.isDirectory())continue;
    const bytes=await optionalBytes(join(directory,namespace.name,name+'-'+version+'.crate'));
    if(bytes)found.push(bytes);
  }
  if(!found.length)return null;
  if(found.some(b=>!b.equals(found[0])))throw Error('Conflicting native package archives across cache namespaces');
  return found[0];
}
export function privateArchivePath(projectRoot,checksum) {
  if(typeof checksum!=='string'||!/^[a-f0-9]{64}$/.test(checksum))throw Error('Invalid native private archive identity');
  return resolve(projectRoot,'artifacts/native-notice-source-snapshots',checksum+'.crate');
}
async function privateDirectory(projectRoot,leaf,create=false) {
  const artifacts=resolve(projectRoot,'artifacts'),directory=resolve(artifacts,leaf);
  if(create)await mkdir(artifacts,{recursive:true});
  for(const path of [artifacts,directory]) {
    if(create&&path===directory)await mkdir(path,{recursive:true});
    const stat=await lstat(path);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Native private archive directory must be an owned regular directory');
  }
}
export async function retainPrivateArchive(projectRoot,checksum,bytes) {
  if(sha256(bytes)!==checksum)throw Error('Native private archive checksum mismatch');
  await privateDirectory(projectRoot,'native-notice-source-snapshots',true);
  const path=privateArchivePath(projectRoot,checksum),existing=await optionalBytes(path);
  if(existing){if(!existing.equals(bytes)||sha256(existing)!==checksum)throw Error('Native private archive snapshot changed');return;}
  let handle;
  try {handle=await open(path,'wx');await handle.writeFile(bytes);}catch(error){if(error.code!=='EEXIST')throw error;}finally{await handle?.close();}
  const actual=await fileBytes(path);if(!actual.equals(bytes)||sha256(actual)!==checksum)throw Error('Native private archive snapshot changed');
}
export async function privateArchiveFiles(projectRoot,identity,archiveDigest) {
  await privateDirectory(projectRoot,'native-notice-source-snapshots');
  const bytes=await fileBytes(privateArchivePath(projectRoot,identity.checksum));
  if(bytes.length!==archiveDigest.bytes||sha256(bytes)!==identity.checksum||archiveDigest.sha256!==identity.checksum)throw Error('Native private archive authority mismatch');
  return archiveFiles(bytes,identity.name+'-'+identity.version);
}
function admissionPath(projectRoot,digest) {
  if(typeof digest!=='string'||!/^[a-f0-9]{64}$/.test(digest))throw Error('Invalid native admission receipt identity');
  return resolve(projectRoot,'artifacts/native-notice-admissions',digest+'.json');
}
export async function retainAdmissionReceipt(projectRoot,bytes) {
  await privateDirectory(projectRoot,'native-notice-admissions',true);
  const digest=sha256(bytes),path=admissionPath(projectRoot,digest),existing=await optionalBytes(path);
  if(existing){if(!existing.equals(bytes))throw Error('Native admission receipt changed');return digest;}
  let handle;try{handle=await open(path,'wx');await handle.writeFile(bytes);}catch(error){if(error.code!=='EEXIST')throw error;}finally{await handle?.close();}
  if(!(await fileBytes(path)).equals(bytes))throw Error('Native admission receipt changed');return digest;
}
function currentAdmissionPath(projectRoot,target) {
  if(!['x86_64-pc-windows-msvc','x86_64-unknown-linux-gnu','aarch64-unknown-linux-gnu','x86_64-apple-darwin','aarch64-apple-darwin'].includes(target))throw Error('Invalid native admission target');
  return resolve(projectRoot,'artifacts/native-notice-admissions','current-'+target+'.json');
}
export async function currentAdmissionDigest(projectRoot,target) {
  await privateDirectory(projectRoot,'native-notice-admissions');
  const row=JSON.parse((await fileBytes(currentAdmissionPath(projectRoot,target))).toString());
  if(Object.keys(row).sort(compare).join('|')!=='receiptSHA256|schemaVersion|target'||row.schemaVersion!==1||row.target!==target||typeof row.receiptSHA256!=='string'||!/^[a-f0-9]{64}$/.test(row.receiptSHA256))throw Error('Malformed native current admission');
  return row.receiptSHA256;
}
export async function validateAdmissionReceipt(projectRoot,target,bytes,expectedDigest=null) {
  await privateDirectory(projectRoot,'native-notice-admissions');
  const digest=expectedDigest??await currentAdmissionDigest(projectRoot,target);
  if(sha256(bytes)!==digest)throw Error('Native admitted generation identity mismatch');
  const admitted=await fileBytes(admissionPath(projectRoot,digest));
  if(sha256(admitted)!==digest||!admitted.equals(bytes))throw Error('Native private admission receipt mismatch');
}
export async function publishAdmission(projectRoot,target,digest) {
  await privateDirectory(projectRoot,'native-notice-admissions',true);
  await fileBytes(admissionPath(projectRoot,digest));
  const path=currentAdmissionPath(projectRoot,target),existing=await optionalBytes(path);
  if(existing)await currentAdmissionDigest(projectRoot,target);
  const temporary=path+'.'+crypto.randomUUID()+'.tmp';
  await Bun.write(temporary,jsonBytes({schemaVersion:1,target,receiptSHA256:digest}));
  await rename(temporary,path);
}
