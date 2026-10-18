import {mkdir, rename} from 'node:fs/promises';
import {resolve, join, dirname} from 'node:path';
import {homedir} from 'node:os';
import {spectralPaths} from './spectral-artifact.mjs';
import {sha256, compare, jsonBytes, fileBytes, treeFiles, treeDigest, candidates, archiveFiles, registryArchive, relativePath,retainPrivateArchive,retainAdmissionReceipt,publishAdmission} from './native-notice-sources.mjs';

export const nativeRoot=resolve(import.meta.dir,'..');
const policyPath='tools/native-notices/source-policy.json';
const modulePaths=['scripts/generate-native-notices.mjs','scripts/native-notice-sources.mjs','scripts/native-notice-artifact.mjs','scripts/tauri-spectral-hook.mjs','scripts/generate-spectral-notices.mjs','scripts/spectral-artifact.mjs','scripts/build-desktop.mjs','src-tauri/tauri.conf.json','.gitignore',policyPath];
const patchRoots={reqwest:'vendor/reqwest','http-auth':'vendor/http-auth','eventsource-stream':'vendor/eventsource-stream','p12-keystore':'vendor/p12-keystore','tower-http':'vendor/tower-http','hyper-util':'vendor/hyper-util'};
const reviewedAuthors=[
 {source:'registry+https://github.com/rust-lang/crates.io-index',name:'r-efi',version:'5.3.0',checksum:'69cdb34c158ceb288df11e18b4bd39de994f6657d83847bdffdbd7f346754b0f',path:'AUTHORS',bytes:3693,sha256:'ff92bed461f50338dd703a9ba9aee496a425957873df1d91192776e4bdf5dda7',kind:'authors-license-notice'},
 {source:'registry+https://github.com/rust-lang/crates.io-index',name:'r-efi',version:'6.0.0',checksum:'f8dcc9c7d52a811697d2151c701e0d08956f92b0e24136cf4cf27b57a6a0d9bf',path:'AUTHORS',bytes:3733,sha256:'d027e91dbc9cdbb2f1190068e498bd6b61cff022b6a032b191021ba658d96111',kind:'authors-license-notice'},
];
const headerKeys=['source','name','version','checksum','path','sourceBytes','sourceSHA256','offset','bytes','sha256','kind','classification','containsCanonicalFullLicense','containsStandaloneFullGrant'];
const reviewedHeaderDigest='76737a4318e88b58dd9917c9e86e5749dd487c8c0a5aa5c785ae01bf9135bb3f';
const repositorySourcePath='tools/native-notices/repository-sources';
const repositoryKeys=['source','name','version','checksum','repository','commit','pathInVcs','vcsSHA256','manifestSHA256','packageManifestSHA256','packageManifestBytes','packageManifestURL','workspaceSHA256','workspaceBytes','workspaceURL','licenseSHA256','licenseBytes','licenseURL','kind'];
const reviewedRepositoryDigest='c8d33d57b033851030ebd3c237a4a2758b222877ca39ab14d68773a1c1ca51ed';
const tauriRepositoryKeys=[...repositoryKeys,'declaredLicense','licensePath'];
const reviewedTauriRepositoryDigest='e0671f92c259b6b23cd78b6570f316c876b3dde27d843ce80dd3215ef60472ab';
export const scopes=['source-unavailable','filename-declaration-discovery','local-patch-provenance','nested-and-per-file','build-conditions','target-linkage','system-and-toolchain','platform-distribution'];
export function exactKeys(value, keys, label) {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort(compare).join('|')!==[...keys].sort(compare).join('|'))throw Error('Malformed native notice '+label);
}
export function readPolicy(bytes) {
  const policy=JSON.parse(Buffer.from(bytes).toString());
  exactKeys(policy,['schemaVersion','evidenceClass','coverage','completenessBlocksBuild','registrySource','patchRoots','unresolvedScopes',...([2,3,4,5].includes(policy.schemaVersion)?['additionalCandidates']:[]),...(policy.schemaVersion>=3?['sourceHeaderCandidates']:[]),...(policy.schemaVersion>=4?['repositoryCandidates']:[])],'policy');
  if(![1,2,3,4,5].includes(policy.schemaVersion)||policy.evidenceClass!=='cargo-source-corpus-candidate'||policy.coverage!=='incomplete'||policy.completenessBlocksBuild!==false||policy.registrySource!=='registry+https://github.com/rust-lang/crates.io-index'||JSON.stringify(policy.patchRoots)!==JSON.stringify(patchRoots)||JSON.stringify(policy.unresolvedScopes)!==JSON.stringify(scopes))throw Error('Unsupported native notice policy');
  if([2,3,4,5].includes(policy.schemaVersion)){
    if(!Array.isArray(policy.additionalCandidates)||policy.additionalCandidates.length!==reviewedAuthors.length)throw Error('Unsupported native authors candidate policy');
    for(let at=0;at<reviewedAuthors.length;at++){const row=policy.additionalCandidates[at],expected=reviewedAuthors[at];exactKeys(row,Object.keys(expected),'authors candidate');for(const key of Object.keys(expected))if(row[key]!==expected[key])throw Error('Unsupported native authors candidate policy');}
  }
  if(policy.schemaVersion>=3){
    if(!Array.isArray(policy.sourceHeaderCandidates)||policy.sourceHeaderCandidates.length!==24)throw Error('Unsupported native header candidate policy');
    const canonical=policy.sourceHeaderCandidates.map(row=>{exactKeys(row,headerKeys,'header candidate');return Object.fromEntries(headerKeys.map(key=>[key,row[key]]));});
    if(sha256(jsonBytes(canonical))!==reviewedHeaderDigest)throw Error('Unsupported native header candidate policy');
  }
  if(policy.schemaVersion>=4){
    const keys=policy.schemaVersion===5?tauriRepositoryKeys:repositoryKeys;
    if(!Array.isArray(policy.repositoryCandidates)||policy.repositoryCandidates.length!==(policy.schemaVersion===5?5:3))throw Error('Unsupported native repository candidate policy');
    const canonical=policy.repositoryCandidates.map(row=>{exactKeys(row,keys,'repository candidate');return Object.fromEntries(keys.map(key=>[key,row[key]]));});
    if(sha256(jsonBytes(canonical))!==(policy.schemaVersion===5?reviewedTauriRepositoryDigest:reviewedRepositoryDigest))throw Error('Unsupported native repository candidate policy');
  }
  return policy;
}
export async function repositorySourceFiles(policy,projectRoot=nativeRoot){
  if(policy.schemaVersion<4)return new Map();
  const files=await treeFiles(join(projectRoot,repositorySourcePath)),expected=new Map();
  for(const r of policy.repositoryCandidates)for(const [sha,bytes]of [[r.packageManifestSHA256,r.packageManifestBytes],[r.workspaceSHA256,r.workspaceBytes],[r.licenseSHA256,r.licenseBytes]]){if(expected.has(sha)&&expected.get(sha)!==bytes)throw Error('Repository source size conflict');expected.set(sha,bytes);}
  if(files.size!==(policy.schemaVersion===5?10:6)||files.size!==expected.size)throw Error('Native repository source exact set mismatch');
  for(const [sha,bytes]of expected){const b=files.get(sha);if(!b||b.length!==bytes||sha256(b)!==sha)throw Error('Native repository source bytes mismatch');}
  return files;
}
export function repositorySourceNotices(policy,identity,files,sources){
  const notices=[],blobs=new Map();
  for(const r of policy.repositoryCandidates??[]){
    if(r.name!==identity.name||r.version!==identity.version)continue;
    if(r.source!==identity.source||r.checksum!==identity.checksum)throw Error('Native repository source identity mismatch');
    const manifest=files.get('Cargo.toml'),original=files.get('Cargo.toml.orig'),vcs=files.get('.cargo_vcs_info.json'),packageSource=sources.get(r.packageManifestSHA256),workspaceSource=sources.get(r.workspaceSHA256),license=sources.get(r.licenseSHA256);
    if(!manifest||sha256(manifest)!==r.manifestSHA256||!original||!packageSource||!original.equals(packageSource)||original.length!==r.packageManifestBytes||sha256(original)!==r.packageManifestSHA256||!vcs||sha256(vcs)!==r.vcsSHA256)throw Error('Native repository archive binding mismatch');
    if(!workspaceSource||workspaceSource.length!==r.workspaceBytes||sha256(workspaceSource)!==r.workspaceSHA256||!license||license.length!==r.licenseBytes||sha256(license)!==r.licenseSHA256)throw Error('Native repository pinned text mismatch');
    const declared=JSON.parse(vcs.toString()),meta=Bun.TOML.parse(manifest.toString()).package,pkg=Bun.TOML.parse(original.toString()).package,workspace=Bun.TOML.parse(workspaceSource.toString()).workspace;
    const declaredLicense=r.declaredLicense??'MIT';
    const rawBase='https://raw.githubusercontent.com/'+r.repository.slice('https://github.com/'.length)+'/'+r.commit+'/';
    if(r.licenseURL!==rawBase+(r.licensePath??'LICENSE')||r.packageManifestURL!==rawBase+r.pathInVcs+'/Cargo.toml'||r.workspaceURL!==rawBase+'Cargo.toml')throw Error('Native repository immutable URL binding mismatch');
    if(declared.git?.sha1!==r.commit||declared.path_in_vcs!==r.pathInVcs||meta.repository!==r.repository||meta.license!==declaredLicense||pkg.license?.workspace!==true||workspace?.package?.license!==declaredLicense||(typeof pkg.version==='string'?pkg.version:workspace.package.version)!==r.version)throw Error('Native repository published workspace binding mismatch');
    if(!workspaceSource||workspaceSource.length!==r.workspaceBytes||sha256(workspaceSource)!==r.workspaceSHA256||!license||license.length!==r.licenseBytes||sha256(license)!==r.licenseSHA256)throw Error('Native repository pinned text mismatch');
    notices.push({kind:r.kind,repository:r.repository,commit:r.commit,url:r.licenseURL,sha256:r.licenseSHA256,bytes:r.licenseBytes,packageManifest:{url:r.packageManifestURL,sha256:r.packageManifestSHA256,bytes:r.packageManifestBytes},workspace:{url:r.workspaceURL,sha256:r.workspaceSHA256,bytes:r.workspaceBytes},vcs:{sha256:r.vcsSHA256,commit:r.commit,pathInVcs:r.pathInVcs}});blobs.set(r.licenseSHA256,license);
  }
  return{notices,blobs};
}
export function sourceHeaderNotices(policy,identity,files){
  const notices=[],blobs=new Map();
  for(const rule of policy.sourceHeaderCandidates??[]){
    if(rule.name!==identity.name||rule.version!==identity.version)continue;
    if(rule.source!==identity.source||rule.checksum!==identity.checksum)throw Error('Native header source identity mismatch');
    const source=files.get(rule.path);if(!source||source.length!==rule.sourceBytes||sha256(source)!==rule.sourceSHA256)throw Error('Native header full source mismatch');
    if(!Number.isSafeInteger(rule.offset)||!Number.isSafeInteger(rule.bytes)||rule.offset<0||rule.bytes<1||rule.offset+rule.bytes>source.length)throw Error('Native header range mismatch');
    const range=source.subarray(rule.offset,rule.offset+rule.bytes);if(sha256(range)!==rule.sha256)throw Error('Native header range mismatch');
    notices.push({path:rule.path,discovery:'reviewed-per-file-source-notice',classification:rule.classification,source:{sha256:rule.sourceSHA256,bytes:rule.sourceBytes},range:{offset:rule.offset,sha256:rule.sha256,bytes:rule.bytes}});blobs.set(rule.sha256,range);
  }
  return {notices,blobs};
}
export function sourceNoticeCandidates(policy,identity,files,manifest){
  const paths=candidates(files,manifest),reviewedPaths=[];
  for(const rule of policy.additionalCandidates??[]){
    if(rule.name!==identity.name||rule.version!==identity.version)continue;
    if(rule.source!==identity.source||rule.checksum!==identity.checksum)throw Error('Native authors candidate source identity mismatch');
    const bytes=files.get(rule.path);if(!bytes||bytes.length!==rule.bytes||sha256(bytes)!==rule.sha256)throw Error('Native authors candidate raw text mismatch');
    reviewedPaths.push(rule.path);if(!paths.includes(rule.path))paths.push(rule.path);
  }
  return {paths:paths.sort(compare),reviewedPaths};
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
  if(policy.schemaVersion>=4){const files=await repositorySourceFiles(policy,projectRoot);rows.push({kind:'tree',path:repositorySourcePath,bytes:[...files.values()].reduce((n,b)=>n+b.length,0),sha256:treeDigest(files)});}
  return rows.sort((a,b)=>compare(a.path,b.path));
}
export function buildRecipe(mode='manual') {
  if(!['manual','build','dev'].includes(mode))throw Error('Invalid native notice preparation mode');
  return {state:'unknown',mode,profile:null,features:null,reason:'Target is explicit; Cargo feature/profile/link selection is not proven by the notice hook.'};
}
export async function collectNativeNotices(target, {projectRoot=nativeRoot,cargoHome=process.env.CARGO_HOME??join(homedir(),'.cargo'),mode='manual'}={}) {
  spectralPaths(target,projectRoot);
  const projectInputs=await projectIdentity(projectRoot), policy=readPolicy(await fileBytes(join(projectRoot,policyPath))), locked=lockPackages(await fileBytes(join(projectRoot,'src-tauri/Cargo.lock')),policy);
  const repositorySources=await repositorySourceFiles(policy,projectRoot);
  const nativeBytes=await fileBytes(join(projectRoot,'src-tauri/Cargo.toml')), native=Bun.TOML.parse(nativeBytes.toString()), packages=[], blobs=new Map();
  const addBlob=bytes=>{const sha=sha256(bytes);if(blobs.has(sha)&&!blobs.get(sha).equals(bytes))throw Error('Native blob digest collision');blobs.set(sha,bytes);return{sha256:sha,bytes:bytes.length};};
  for(const identity of locked) {
    let files, provenance, state='available';
    if(identity.source!==null) {
      const archive=await registryArchive(cargoHome,identity.name,identity.version);
      if(archive===null) {packages.push({...identity,provenance:null,availability:'source-unavailable',availabilityReason:'registry-archive-not-present-in-local-cache',manifest:null,licenseExpression:null,licenseFile:null,repository:null,links:null,vcs:null,texts:[],...(policy.schemaVersion>=3?{perFileNotices:[]}: {}),...(policy.schemaVersion>=4?{repositoryNotices:[]}: {})});continue;}
      if(sha256(archive)!==identity.checksum)throw Error('Native archive lock checksum mismatch: '+identity.name);
      files=archiveFiles(archive,identity.name+'-'+identity.version);
      await retainPrivateArchive(projectRoot,identity.checksum,archive);
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
    const meta=parseManifest(manifestBytes,identity), {paths,reviewedPaths}=sourceNoticeCandidates(policy,identity,files,meta), texts=[];
    for(const path of paths)texts.push({path,discovery:meta.package['license-file']===path?'declared-license-file':provenance.kind==='workspace-context'?'project-license-context':reviewedPaths.includes(path)?'reviewed-authors-license-notice':'filename-candidate',...addBlob(files.get(path))});
    if(!texts.length)state='no-candidate-discovered';
    const vcs=files.get('.cargo_vcs_info.json');if(vcs)JSON.parse(vcs.toString());
    const headers=sourceHeaderNotices(policy,identity,files);for(const bytes of headers.blobs.values())addBlob(bytes);
    const repositoryNotices=repositorySourceNotices(policy,identity,files,repositorySources);for(const bytes of repositoryNotices.blobs.values())addBlob(bytes);
    packages.push({...identity,provenance,availability:state,availabilityReason:state==='available'?'verified-source-text-candidates':'filename-and-declaration-policy-found-no-candidate',manifest:addBlob(manifestBytes),licenseExpression:meta.package.license??null,licenseFile:meta.package['license-file']??null,repository:meta.package.repository??null,links:meta.package.links??null,vcs:vcs?addBlob(vcs):null,texts,...(policy.schemaVersion>=3?{perFileNotices:headers.notices}: {}),...(policy.schemaVersion>=4?{repositoryNotices:repositoryNotices.notices}: {})});
  }
  // Refuse a mixed generation if project/source trees changed while collecting.
  if(JSON.stringify(projectInputs)!==JSON.stringify(await projectIdentity(projectRoot)))throw Error('Native notice project changed during collection');
  const receipt={schemaVersion:policy.schemaVersion>=4?3:policy.schemaVersion>=3?2:1,target,buildRecipe:buildRecipe(mode),projectInputs,packages};
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
  const headerReferences=new Map();
  if(receipt.schemaVersion>=2)for(const row of receipt.packages)for(const notice of row.perFileNotices){const origin={packageId:row.id,name:row.name,version:row.version,path:notice.path,discovery:notice.discovery,classification:notice.classification,source:notice.source,offset:notice.range.offset,provenance:row.provenance};const entry=headerReferences.get(notice.range.sha256)??{sha256:notice.range.sha256,bytes:notice.range.bytes,blobPath:'blobs/'+notice.range.sha256,origins:[]};entry.origins.push(origin);headerReferences.set(notice.range.sha256,entry);}
  const perFileNotices=[...headerReferences.values()].sort((a,b)=>compare(a.sha256,b.sha256));
  const repositoryReferences=new Map();
  if(receipt.schemaVersion===3)for(const row of receipt.packages)for(const notice of row.repositoryNotices){const entry=repositoryReferences.get(notice.sha256)??{sha256:notice.sha256,bytes:notice.bytes,blobPath:'blobs/'+notice.sha256,origins:[]};entry.origins.push({packageId:row.id,name:row.name,version:row.version,...notice});repositoryReferences.set(notice.sha256,entry);}
  const repositoryNotices=[...repositoryReferences.values()].sort((a,b)=>compare(a.sha256,b.sha256));
  const inventory={schemaVersion:receipt.schemaVersion,evidenceClass:'cargo-source-corpus-candidate',coverage:'incomplete',completenessBlocksBuild:false,targetLinkage:'unproven',receiptSHA256:sha256(jsonBytes(receipt)),lockIdentities:receipt.packages.length,packages:receipt.packages,texts,unresolvedScopes:scopes,...(receipt.schemaVersion>=2?{perFileNotices,perFileNoticeOrigins:perFileNotices.reduce((n,h)=>n+h.origins.length,0),perFileNoticeBlobCount:perFileNotices.length}: {}),...(receipt.schemaVersion===3?{repositoryNotices,repositoryNoticeOrigins:repositoryNotices.reduce((n,x)=>n+x.origins.length,0),repositoryNoticeBlobCount:repositoryNotices.length}: {})};
  const assets=new Map([['collection-inputs.json',jsonBytes(receipt)],['inventory.json',jsonBytes(inventory)],['THIRD_PARTY_NOTICES.txt',Buffer.concat(chunks)]]);
  if(receipt.schemaVersion>=2){const partial=[Buffer.from('Insomnium exact per-file source notices\nPartial references/identifiers/attribution; no full-license or target-linkage claim.\n')];for(const notice of perFileNotices)partial.push(Buffer.from('\n=== Raw source notice SHA256 '+notice.sha256+'; origins '+notice.origins.map(o=>o.name+'@'+o.version+'/'+o.path+' byte'+o.offset).join(', ')+' ===\n'),blobs.get(notice.sha256),Buffer.from('\n'));assets.set('PER_FILE_SOURCE_NOTICES.txt',Buffer.concat(partial));}
  if(receipt.schemaVersion===3){const supplemental=[Buffer.from('Insomnium repository-license texts at exact published commits\nSupplemental source evidence; archive discovery and target linkage unchanged.\n')];for(const text of repositoryNotices)supplemental.push(Buffer.from('\n=== Repository source text SHA256 '+text.sha256+'; origins '+text.origins.map(o=>o.name+'@'+o.version+' '+o.url).join(', ')+' ===\n'),blobs.get(text.sha256),Buffer.from('\n'));assets.set('REPOSITORY_LICENSE_NOTICES.txt',Buffer.concat(supplemental));}
  for(const [sha,bytes] of [...blobs].sort(([a],[b])=>compare(a,b)))assets.set('blobs/'+sha,bytes);
  return assets;
}
export async function generateNativeNotices(target,options={}) {
  const projectRoot=options.projectRoot??nativeRoot, collected=await collectNativeNotices(target,options), assets=nativeAssets(collected.receipt,collected.blobs);
  const stamp={schemaVersion:1,target,projectInputs:collected.receipt.projectInputs,receiptSHA256:sha256(assets.get('collection-inputs.json')),outputs:[...assets].map(([path,bytes])=>({path,bytes:bytes.length,sha256:sha256(bytes)})).sort((a,b)=>compare(a.path,b.path))};
  assets.set('preparation.json',jsonBytes(stamp));
  const admissionReceiptSHA256=await retainAdmissionReceipt(projectRoot,assets.get('collection-inputs.json'));
  const stage=resolve(projectRoot,'artifacts/native-notice-stage-'+crypto.randomUUID()), destination=resolve(projectRoot,'src-tauri/notices/native'), backup=resolve(projectRoot,'artifacts/native-notice-prior-'+crypto.randomUUID());
  await mkdir(stage,{recursive:true});for(const [path,bytes] of assets){relativePath(path);await mkdir(dirname(join(stage,path)),{recursive:true});await Bun.write(join(stage,path),bytes);}
  const {validateNativeNotices}=await import('./native-notice-artifact.mjs');await validateNativeNotices(target,{projectRoot,directory:stage,expectedRecipe:collected.receipt.buildRecipe,admissionReceiptSHA256});
  await mkdir(dirname(destination),{recursive:true});let moved=false;
  let published=false;
  try {try{await rename(destination,backup);moved=true;}catch(error){if(error.code!=='ENOENT')throw error;}await rename(stage,destination);published=true;await publishAdmission(projectRoot,target,admissionReceiptSHA256);}catch(error){if(published)await rename(destination,stage);if(moved)await rename(backup,destination);throw error;}
  return {receipt:collected.receipt,inventory:JSON.parse(assets.get('inventory.json').toString()),stamp};
}
if(import.meta.main){if(Bun.argv.length!==3)throw Error('Expected one native notice target');const result=await generateNativeNotices(Bun.argv[2]);console.log(JSON.stringify({identities:result.inventory.lockIdentities,texts:result.inventory.texts.length,coverage:'incomplete',targetLinkage:'unproven'}));}
