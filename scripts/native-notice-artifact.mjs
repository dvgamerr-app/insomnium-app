import {join,resolve} from 'node:path';
import {spectralPaths} from './spectral-artifact.mjs';
import {nativeRoot,exactKeys,projectIdentity,readPolicy,lockPackages,buildRecipe,nativeAssets,sourceNoticeCandidates} from './generate-native-notices.mjs';
import {sha256,compare,jsonBytes,fileBytes,treeFiles,relativePath,privateArchiveFiles,candidates,validateAdmissionReceipt} from './native-notice-sources.mjs';

const digestPattern=/^[a-f0-9]{64}$/;
function digest(row,label) {
  exactKeys(row,['sha256','bytes'],label);
  if(!digestPattern.test(row.sha256)||!Number.isSafeInteger(row.bytes)||row.bytes<0)throw Error('Invalid native digest '+label);
}
function nullableString(value,label) {if(value!==null&&typeof value!=='string')throw Error('Malformed native '+label);}
export async function validateNativeNotices(target,{projectRoot=nativeRoot,directory=resolve(projectRoot,'src-tauri/notices/native'),expectedRecipe=null,admissionReceiptSHA256=null}={}) {
  spectralPaths(target,projectRoot);
  const files=await treeFiles(directory), receiptBytes=files.get('collection-inputs.json'), stampBytes=files.get('preparation.json');
  if(!receiptBytes||!stampBytes)throw Error('Missing native notice preparation receipt');
  const receipt=JSON.parse(receiptBytes.toString()),stamp=JSON.parse(stampBytes.toString());
  exactKeys(receipt,['schemaVersion','target','buildRecipe','projectInputs','packages'],'receipt');
  exactKeys(stamp,['schemaVersion','target','projectInputs','receiptSHA256','outputs'],'stamp');
  if(receipt.schemaVersion!==1||stamp.schemaVersion!==1||receipt.target!==target||stamp.target!==target||stamp.receiptSHA256!==sha256(receiptBytes)||!receiptBytes.equals(jsonBytes(receipt)))throw Error('Native notice preparation identity mismatch');
  exactKeys(receipt.buildRecipe,['state','mode','profile','features','reason'],'build recipe');
  if(JSON.stringify(receipt.buildRecipe)!==JSON.stringify(buildRecipe(receipt.buildRecipe.mode))||expectedRecipe!==null&&JSON.stringify(expectedRecipe)!==JSON.stringify(receipt.buildRecipe))throw Error('Native notice build context mismatch');
  const projectInputs=await projectIdentity(projectRoot);
  if(JSON.stringify(receipt.projectInputs)!==JSON.stringify(projectInputs)||JSON.stringify(stamp.projectInputs)!==JSON.stringify(projectInputs))throw Error('Native notice project inputs are stale');
  const policy=readPolicy(await fileBytes(join(projectRoot,'tools/native-notices/source-policy.json'))),locked=lockPackages(await fileBytes(join(projectRoot,'src-tauri/Cargo.lock')),policy);
  if(!Array.isArray(receipt.packages)||receipt.packages.length!==locked.length)throw Error('Native notice locked package count mismatch');
  const blobs=new Map();
  const readBlob=(row,label)=>{digest(row,label);const bytes=files.get('blobs/'+row.sha256);if(!bytes||bytes.length!==row.bytes||sha256(bytes)!==row.sha256)throw Error('Native admitted blob mismatch '+label);blobs.set(row.sha256,bytes);return bytes;};
  for(let i=0;i<locked.length;i++) {
    const row=receipt.packages[i],identity=locked[i];
    exactKeys(row,['id','name','version','source','checksum','provenance','availability','availabilityReason','manifest','licenseExpression','licenseFile','repository','links','vcs','texts'],'package');
    for(const key of ['id','name','version','source','checksum'])if(row[key]!==identity[key])throw Error('Native package identity/source mismatch');
    for(const key of ['licenseExpression','licenseFile','repository','links'])nullableString(row[key],key);
    if(!Array.isArray(row.texts)||!['available','source-unavailable','no-candidate-discovered'].includes(row.availability))throw Error('Invalid native availability');
    const reasons={available:'verified-source-text-candidates','source-unavailable':'registry-archive-not-present-in-local-cache','no-candidate-discovered':'filename-and-declaration-policy-found-no-candidate'};
    if(row.availabilityReason!==reasons[row.availability])throw Error('Invalid native availability reason');
    if(row.availability==='source-unavailable') {
      if(row.source===null||row.provenance!==null||row.manifest!==null||row.vcs!==null||row.texts.length||[row.licenseExpression,row.licenseFile,row.repository,row.links].some(v=>v!==null))throw Error('Unverified native missing-source claim');
      continue;
    }
    const manifestBytes=readBlob(row.manifest,'manifest'),meta=Bun.TOML.parse(manifestBytes.toString()).package;
    if(meta?.name!==row.name||meta?.version!==row.version)throw Error('Native admitted manifest identity mismatch');
    for(const [field,key] of [['licenseExpression','license'],['licenseFile','license-file'],['repository','repository'],['links','links']])if(row[field]!==(meta[key]??null))throw Error('Native admitted manifest field mismatch');
    if(row.vcs!==null)JSON.parse(readBlob(row.vcs,'VCS').toString());
    let authoritative;
    if(row.source!==null) {
      exactKeys(row.provenance,['kind','archive','sourceId'],'registry provenance');
      if(row.provenance.kind!=='registry'||row.provenance.sourceId!==row.source)throw Error('Native registry provenance mismatch');
      digest(row.provenance.archive,'archive');if(row.provenance.archive.sha256!==row.checksum)throw Error('Native archive provenance checksum mismatch');
      authoritative=await privateArchiveFiles(projectRoot,identity,row.provenance.archive);
    } else if(Object.hasOwn(policy.patchRoots,row.name)) {
      exactKeys(row.provenance,['kind','logicalRoot','treeSHA256'],'patch provenance');
      const logical='src-tauri/'+policy.patchRoots[row.name], input=projectInputs.find(r=>r.path===logical);
      if(row.provenance.kind!=='local-patch'||row.provenance.logicalRoot!==logical||row.provenance.treeSHA256!==input?.sha256)throw Error('Native patch tree provenance mismatch');
      authoritative=await treeFiles(join(projectRoot,logical));
    } else {
      exactKeys(row.provenance,['kind','logicalRoot','contextSHA256','reason'],'workspace context');
      const native=projectInputs.find(r=>r.path==='src-tauri/Cargo.toml'),license=projectInputs.find(r=>r.path==='LICENSE');
      const context=[{path:'Cargo.toml',bytes:native.bytes,sha256:native.sha256},{path:'LICENSE',bytes:license.bytes,sha256:license.sha256}];
      if(row.provenance.kind!=='workspace-context'||row.provenance.logicalRoot!=='src-tauri'||row.provenance.contextSHA256!==sha256(jsonBytes(context))||row.provenance.reason!=='Native manifest and project root LICENSE context; not a whole workspace source-tree receipt.')throw Error('Native workspace context mismatch');
      authoritative=new Map([['Cargo.toml',await fileBytes(join(projectRoot,'src-tauri/Cargo.toml'))],['LICENSE',await fileBytes(join(projectRoot,'LICENSE'))]]);
    }
    if(!authoritative.get('Cargo.toml')?.equals(manifestBytes))throw Error('Native manifest bytes differ from authoritative source');
    const authoritativeVcs=authoritative.get('.cargo_vcs_info.json')??null;
    if((row.vcs!==null)!==Boolean(authoritativeVcs)||row.vcs!==null&&!authoritativeVcs.equals(readBlob(row.vcs,'VCS')))throw Error('Native VCS bytes differ from authoritative source');
    const {paths:expectedPaths,reviewedPaths}=sourceNoticeCandidates(policy,row,authoritative,{package:meta});
    if(JSON.stringify(row.texts.map(t=>t.path))!==JSON.stringify(expectedPaths))throw Error('Native selected text paths differ from authoritative source');
    const paths=new Set();
    for(const text of row.texts) {
      exactKeys(text,['path','discovery','sha256','bytes'],'text');relativePath(text.path);if(paths.has(text.path))throw Error('Duplicate native notice text path');paths.add(text.path);
      const expectedDiscovery=text.path===row.licenseFile?'declared-license-file':row.provenance.kind==='workspace-context'?'project-license-context':reviewedPaths.includes(text.path)?'reviewed-authors-license-notice':'filename-candidate';
      if(text.discovery!==expectedDiscovery)throw Error('Native text discovery mismatch');
      const admitted=readBlob({sha256:text.sha256,bytes:text.bytes},'text');
      if(!authoritative.get(text.path)?.equals(admitted))throw Error('Native text bytes differ from authoritative source');
    }
    if(row.licenseFile!==null&&!paths.has(row.licenseFile))throw Error('Missing native declared text');
    if((row.availability==='available')!==Boolean(row.texts.length))throw Error('Native availability/text mismatch');
  }
  const assets=nativeAssets(receipt,blobs),outputs=[...assets].map(([path,bytes])=>({path,bytes:bytes.length,sha256:sha256(bytes)})).sort((a,b)=>compare(a.path,b.path));
  if(JSON.stringify(outputs)!==JSON.stringify(stamp.outputs)||files.size!==assets.size+1)throw Error('Native output manifest mismatch');
  for(const [path,bytes] of assets)if(!files.get(path)?.equals(bytes))throw Error('Native notice output mismatch '+path);
  if(!stampBytes.equals(jsonBytes(stamp)))throw Error('Noncanonical native preparation stamp');
  await validateAdmissionReceipt(projectRoot,target,receiptBytes,admissionReceiptSHA256);
  if(JSON.stringify(projectInputs)!==JSON.stringify(await projectIdentity(projectRoot)))throw Error('Native project changed during authority validation');
  return {schemaVersion:1,target,coverage:'incomplete',targetLinkage:'unproven',receiptSHA256:stamp.receiptSHA256,projectInputs,outputs};
}
if(import.meta.main){if(Bun.argv.length!==3)throw Error('Expected one native notice validation target');console.log(JSON.stringify(await validateNativeNotices(Bun.argv[2])));}
