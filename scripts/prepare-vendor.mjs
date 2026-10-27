import {lstat,mkdir,mkdtemp,readdir,rename} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve,sep} from 'node:path';

const root=resolve(import.meta.dir,'..');
const sha=bytes=>Bun.CryptoHasher.hash('sha256',bytes,'hex');
function contained(parent,path){
  const target=resolve(parent,path);
  if(!target.startsWith(resolve(parent)+sep)||path.includes('\\')||path.split('/').some(part=>!part||part==='.'||part==='..')||path.includes(':'))throw Error('Unsafe vendor path: '+path);
  return target;
}
async function exists(path){
  try{const info=await lstat(path);if(info.isSymbolicLink())throw Error('Refuse linked vendor path: '+path);return info;}catch(error){if(error.code==='ENOENT')return null;throw error;}
}
async function treeSHA(path){
  const rows=[];
  async function visit(directory,prefix=''){
    for(const entry of await readdir(directory,{withFileTypes:true})){
      const name=prefix+entry.name,target=join(directory,entry.name);
      if(entry.isSymbolicLink())throw Error('Refuse linked vendor file: '+target);
      if(entry.isDirectory())await visit(target,name+'/');
      else if(entry.isFile())rows.push([name,sha(await Bun.file(target).bytes())]);
      else throw Error('Unsupported vendor entry: '+target);
    }
  }
  await visit(path);rows.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
  return sha(JSON.stringify(rows));
}
async function archiveBytes(pkg,projectRoot,offline){
  const filename=pkg.name+'-'+pkg.version+'.crate';
  const cargoCache=join(process.env.CARGO_HOME||join(homedir(),'.cargo'),'registry/cache');
  const localCache=join(projectRoot,'artifacts/vendor-cache',filename);
  const candidates=[localCache];
  try{for(const entry of await readdir(cargoCache))candidates.push(join(cargoCache,entry,filename));}catch(error){if(error.code!=='ENOENT')throw error;}
  for(const path of candidates)if(await Bun.file(path).exists()){
    const bytes=await Bun.file(path).bytes();
    if(sha(bytes)!==pkg.archiveSHA256)throw Error('Vendor archive checksum mismatch: '+path);
    return bytes;
  }
  if(offline)throw Error('Vendor archive missing from cache: '+filename);
  const response=await fetch('https://static.crates.io/crates/'+pkg.name+'/'+filename,{signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw Error('Vendor download failed: '+filename+' HTTP '+response.status);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(sha(bytes)!==pkg.archiveSHA256)throw Error('Vendor download checksum mismatch: '+filename);
  await Bun.write(localCache,bytes);
  console.log('Downloaded pinned vendor archive: '+filename);
  return bytes;
}
export async function prepareVendor(projectRoot=root,offline=false){
  const manifest=await Bun.file(join(projectRoot,'tools/vendor/manifest.json')).json();
  if(manifest.schema!==1||!Array.isArray(manifest.packages))throw Error('Unsupported vendor manifest');
  const vendor=join(projectRoot,'src-tauri/vendor');
  await exists(join(projectRoot,'src-tauri'));await exists(vendor);
  await mkdir(vendor,{recursive:true});
  for(const pkg of manifest.packages){
    const destination=contained(vendor,pkg.directory);
    if(await exists(destination)){
      if(await treeSHA(destination)!==pkg.treeSHA256)throw Error('Vendor differs from pinned source; preserve local changes before restoring: '+destination);
      continue;
    }
    const files=pkg.name?await new Bun.Archive(await archiveBytes(pkg,projectRoot,offline)).files():new Map();
    const stagingRoot=join(projectRoot,'artifacts/vendor-staging');await mkdir(stagingRoot,{recursive:true});
    const staging=await mkdtemp(join(stagingRoot,pkg.directory+'-'));
    for(const path of pkg.files){
      let bytes;
      if(pkg.overrides.includes(path))bytes=await Bun.file(contained(join(projectRoot,'tools/vendor/overrides',pkg.directory),path)).bytes();
      else{
        const file=files.get(pkg.name+'-'+pkg.version+'/'+path);
        if(!file)throw Error('Missing upstream vendor file: '+path);
        bytes=new Uint8Array(await file.arrayBuffer());
        if(pkg.crlf?.includes(path))bytes=new TextEncoder().encode(new TextDecoder('utf-8',{fatal:true}).decode(bytes).replaceAll('\n','\r\n'));
      }
      await Bun.write(contained(staging,path),bytes);
    }
    if(await treeSHA(staging)!==pkg.treeSHA256)throw Error('Restored vendor source checksum mismatch: '+staging);
    await rename(staging,destination);
    console.log('Restored vendor: '+pkg.directory);
  }
}
if(import.meta.main){
  if(process.argv.length>3||(process.argv[2]&&process.argv[2]!=='--offline'))throw Error('Usage: bun scripts/prepare-vendor.mjs [--offline]');
  await prepareVendor(root,process.argv[2]==='--offline');
}
