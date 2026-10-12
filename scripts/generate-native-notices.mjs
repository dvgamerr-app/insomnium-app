import {mkdir, rename} from 'node:fs/promises';
import {resolve, join, dirname} from 'node:path';
import {homedir} from 'node:os';
import {spectralPaths} from './spectral-artifact.mjs';
import {sha256, compare, jsonBytes, fileBytes, optionalBytes, treeFiles, treeDigest, candidates, archiveFiles, registryArchive, relativePath} from './native-notice-sources.mjs';

export const nativeRoot=resolve(import.meta.dir,'..');
const policyPath='tools/native-notices/source-policy.json';
const modulePaths=['scripts/generate-native-notices.mjs','scripts/native-notice-sources.mjs','scripts/native-notice-artifact.mjs','scripts/tauri-spectral-hook.mjs','scripts/generate-spectral-notices.mjs','scripts/spectral-artifact.mjs','scripts/build-desktop.mjs','src-tauri/tauri.conf.json','.gitignore',policyPath];
const patchRoots={reqwest:'vendor/reqwest','http-auth':'vendor/http-auth','eventsource-stream':'vendor/eventsource-stream','p12-keystore':'vendor/p12-keystore'};
export const scopes=['source-unavailable','filename-declaration-discovery','local-patch-provenance','nested-and-per-file','build-conditions','target-linkage','system-and-toolchain','platform-distribution'];
export function exactKeys(value, keys, label) {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort(compare).join('|')!==[...keys].sort(compare).join('|'))throw Error('Malformed native notice '+label);
}
export function readPolicy(bytes) {
  const policy=JSON.parse(Buffer.from(bytes).toString());
  exactKeys(policy,['schemaVersion','evidenceClass','coverage','completenessBlocksBuild','registrySource','patchRoots','unresolvedScopes'],'policy');
  if(policy.schemaVersion!==1||policy.evidenceClass!=='cargo-source-corpus-candidate'||policy.coverage!=='incomplete'||policy.completenessBlocksBuild!==false||policy.registrySource!=='registry+https://github.com/rust-lang/crates.io-index'||JSON.stringify(policy.patchRoots)!==JSON.stringify(patchRoots)||JSON.stringify(policy.unresolvedScopes)!==JSON.stringify(scopes))throw Error('Unsupported native notice policy');
  return policy;
}
export function lockPackages(bytes, policy) {
  const parsed=Bun.TOML.parse(Buffer.from(bytes).toString());
  if(parsed.version!==4||!Array.isArray(parsed.package))throw Error('Malformed native Cargo lock');
  const seen=new Set();
  return parsed.package.map(row=>{
    if(typeof row.name!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(row.name)||typeof row.version!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9.+_-]*$/.test(row.version))throw Error('Invalid native locked identity');
    const source=row.source??null, checksum=row.checksum??null;
    if(source!==null&&(source!==policy.registrySource||typeof checksum!=='string'||!/^[a-f0-9]{64}$/.test(checksum))||source===null&&checksum!==null)throw Error('Unsupported native locked source/checksum');
    const id=sha256(jsonBytes([source,row.name,row.version]));
    if(seen.has(id))throw Error('Duplicate native locked identity');seen.add(id);
    return {id,name:row.name,version:row.version,source,checksum};
  }).sort((a,b)=>compare(a.id,b.id));
}
function parseManifest(bytes, identity) {
  const meta=Bun.TOML.parse(Buffer.from(bytes).toString());
  if(meta.package?.name!==identity.name||meta.package?.version!==identity.version)throw Error('Native manifest name/version mismatch');
  for(const k of ['license','license-file','repository','links'])if(meta.package[k]!==undefined&&typeof meta.package[k]!=='string')throw Error('Malformed native manifest '+k);
  return meta;
}
export async function projectIdentity(projectRoot=nativeRoot) {
  const policy=readPolicy(await fileBytes(join(projectRoot,policyPath))), rows=[];
  for(const path of [...modulePaths,'src-tauri/Cargo.lock','src-tauri/Cargo.toml','LICENSE'].sort(compare)) {
    const bytes=await fileBytes(join(projectRoot,path));rows.push({kind:'file',path,bytes:bytes.length,sha256:sha256(bytes)});
  }
  const native=Bun.TOML.parse((await fileBytes(join(projectRoot,'src-tauri/Cargo.toml'))).toString());
  if(JSON.stringify(Object.keys(native.patch?.['crates-io']??{}).sort(compare))!==JSON.stringify(Object.keys(patchRoots).sort(compare)))throw Error('Native patch admission differs from policy');
  for(const [name,path] of Object.entries(patchRoots)) {
    if(native.patch['crates-io'][name]?.path!==path)throw Error('Native patch path differs from policy');
    const logical='src-tauri/'+path, files=await treeFiles(join(projectRoot,logical));
    rows.push({kind:'tree',path:logical,bytes:[...files.values()].reduce((n,b)=>n+b.length,0),sha256:treeDigest(files)});
  }
  return rows.sort((a,b)=>compare(a.path,b.path));
}
export function buildRecipe(mode='manual') {
  if(!['manual','build','dev'].includes(mode))throw Error('Invalid native notice preparation mode');
  return {state:'unknown',mode,profile:null,features:null,reason:'Target is explicit; Cargo feature/profile/link selection is not proven by the notice hook.'};
}
export async function collectNativeNotices(target, {projectRoot=nativeRoot,cargoHome=process.env.CARGO_HOME??join(homedir(),'.cargo'),mode='manual'}={}) {
  spectralPaths(target,projectRoot);
  const projectInputs=await projectIdentity(projectRoot), policy=readPolicy(await fileBytes(join(projectRoot,policyPath))), locked=lockPackages(await fileBytes(join(projectRoot,'src-tauri/Cargo.lock')),policy);
  const nativeBytes=await fileBytes(join(projectRoot,'src-tauri/Cargo.toml')), native=Bun.TOML.parse(nativeBytes.toString()), packages=[], blobs=new Map();
  const addBlob=bytes=>{const sha=sha256(bytes);if(blobs.has(sha)&&!blobs.get(sha).equals(bytes))throw Error('Native blob digest collision');blobs.set(sha,bytes);return{sha256:sha,bytes:bytes.length};};
  for(const identity of locked) {
    let files, provenance, state='available';
    if(identity.source!==null) {
      const archive=await registryArchive(cargoHome,identity.name,identity.version);
      if(archive===null) {packages.push({...identity,provenance:null,availability:'source-unavailable',availabilityReason:'registry-archive-not-present-in-local-cache',manifest:null,licenseExpression:null,licenseFile:null,repository:null,links:null,vcs:null,texts:[]});continue;}
      if(sha256(archive)!==identity.checksum)throw Error('Native archive lock checksum mismatch: '+identity.name);
      files=archiveFiles(archive,identity.name+'-'+identity.version);
      provenance={kind:'registry',archive:{sha256:identity.checksum,bytes:archive.length},sourceId:identity.source};
    } else if(Object.hasOwn(patchRoots,identity.name)) {
      const logicalRoot='src-tauri/'+patchRoots[identity.name];files=await treeFiles(join(projectRoot,logicalRoot));
      provenance={kind:'local-patch',logicalRoot,treeSHA256:treeDigest(files)};
    } else {
      if(identity.name!==native.package?.name||identity.version!==native.package?.version)throw Error('Unadmitted native path/workspace source');
      const license=await fileBytes(join(projectRoot,'LICENSE'));
      files=new Map([['Cargo.toml',nativeBytes],['LICENSE',license]]);
      provenance={kind:'workspace-context',logicalRoot:'src-tauri',contextSHA256:treeDigest(files),reason:'Native manifest and project root LICENSE context; not a whole workspace source-tree receipt.'};
    }
    const manifestBytes=files.get('Cargo.toml');if(!manifestBytes)throw Error('Missing native archive manifest');
    const meta=parseManifest(manifestBytes,identity), paths=candidates(files,meta), texts=[];
    for(const path of paths)texts.push({path,discovery:meta.package['license-file']===path?'declared-license-file':provenance.kind==='workspace-context'?'project-license-context':'filename-candidate',...addBlob(files.get(path))});
    if(!texts.length)state='no-candidate-discovered';
    const vcs=files.get('.cargo_vcs_info.json');if(vcs)JSON.parse(vcs.toString());
    packages.push({...identity,provenance,availability:state,availabilityReason:state==='available'?'verified-source-text-candidates':'filename-and-declaration-policy-found-no-candidate',manifest:addBlob(manifestBytes),licenseExpression:meta.package.license??null,licenseFile:meta.package['license-file']??null,repository:meta.package.repository??null,links:meta.package.links??null,vcs:vcs?addBlob(vcs):null,texts});
  }
  // Refuse a mixed generation if project/source trees changed while collecting.
  if(JSON.stringify(projectInputs)!==JSON.stringify(await projectIdentity(projectRoot)))throw Error('Native notice project changed during collection');
  const receipt={schemaVersion:1,target,buildRecipe:buildRecipe(mode),projectInputs,packages};
  return {receipt,blobs};
}
export function nativeAssets(receipt, blobs) {
  const references=new Map(), chunks=[Buffer.from('Insomnium native Cargo source-text candidates\nCoverage incomplete; target linkage unproven.\n')];
  for(const row of receipt.packages)for(const text of row.texts) {
    const origin={packageId:row.id,name:row.name,version:row.version,path:text.path,discovery:text.discovery,provenance:row.provenance};
    const entry=references.get(text.sha256)??{sha256:text.sha256,bytes:text.bytes,blobPath:'blobs/'+text.sha256,origins:[]};entry.origins.push(origin);references.set(text.sha256,entry);
  }
  const texts=[...references.values()].sort((a,b)=>compare(a.sha256,b.sha256));
  for(const text of texts)chunks.push(Buffer.from('\n=== Source text SHA256 '+text.sha256+'; origins '+text.origins.map(o=>o.name+'@'+o.version+'/'+o.path).join(', ')+' ===\n'),blobs.get(text.sha256),Buffer.from('\n'));
  const inventory={schemaVersion:1,evidenceClass:'cargo-source-corpus-candidate',coverage:'incomplete',completenessBlocksBuild:false,targetLinkage:'unproven',receiptSHA256:sha256(jsonBytes(receipt)),lockIdentities:receipt.packages.length,packages:receipt.packages,texts,unresolvedScopes:scopes};
  const assets=new Map([['collection-inputs.json',jsonBytes(receipt)],['inventory.json',jsonBytes(inventory)],['THIRD_PARTY_NOTICES.txt',Buffer.concat(chunks)]]);
  for(const [sha,bytes] of [...blobs].sort(([a],[b])=>compare(a,b)))assets.set('blobs/'+sha,bytes);
  return assets;
}
export async function generateNativeNotices(target,options={}) {
  const projectRoot=options.projectRoot??nativeRoot, collected=await collectNativeNotices(target,options), assets=nativeAssets(collected.receipt,collected.blobs);
  const stamp={schemaVersion:1,target,projectInputs:collected.receipt.projectInputs,receiptSHA256:sha256(assets.get('collection-inputs.json')),outputs:[...assets].map(([path,bytes])=>({path,bytes:bytes.length,sha256:sha256(bytes)})).sort((a,b)=>compare(a.path,b.path))};
  assets.set('preparation.json',jsonBytes(stamp));
  const stage=resolve(projectRoot,'artifacts/native-notice-stage-'+crypto.randomUUID()), destination=resolve(projectRoot,'src-tauri/notices/native'), backup=resolve(projectRoot,'artifacts/native-notice-prior-'+crypto.randomUUID());
  await mkdir(stage,{recursive:true});for(const [path,bytes] of assets){relativePath(path);await mkdir(dirname(join(stage,path)),{recursive:true});await Bun.write(join(stage,path),bytes);}
  const {validateNativeNotices}=await import('./native-notice-artifact.mjs');await validateNativeNotices(target,{projectRoot,directory:stage,expectedRecipe:collected.receipt.buildRecipe});
  await mkdir(dirname(destination),{recursive:true});let moved=false;
  try {try{await rename(destination,backup);moved=true;}catch(error){if(error.code!=='ENOENT')throw error;}await rename(stage,destination);}catch(error){if(moved)await rename(backup,destination);throw error;}
  return {receipt:collected.receipt,inventory:JSON.parse(assets.get('inventory.json').toString()),stamp};
}
if(import.meta.main){if(Bun.argv.length!==3)throw Error('Expected one native notice target');const result=await generateNativeNotices(Bun.argv[2]);console.log(JSON.stringify({identities:result.inventory.lockIdentities,texts:result.inventory.texts.length,coverage:'incomplete',targetLinkage:'unproven'}));}
