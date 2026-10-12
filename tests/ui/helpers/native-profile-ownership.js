import assert from 'node:assert/strict';
import {lstat,realpath,mkdir} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {createHash} from 'node:crypto';

export const resourceCrudProbeIdentifier='app.insomnium.probe.resourcecrud20261012';
const canonical=(/** @type {string} */ path)=>resolve(path).toLowerCase();
export function knownWindowsApplicationData(){
  assert.equal(process.platform,'win32');
  const result=Bun.spawnSync(['powershell','-NoProfile','-NonInteractive','-Command',"[Environment]::GetFolderPath('ApplicationData')"],{windowsHide:true});
  assert.equal(result.exitCode,0);const folder=result.stdout.toString().trim();assert.ok(folder&&resolve(folder)===folder,'Windows KnownFolder must be absolute');return folder;
}
/** @param {string} path */
async function missing(path){return lstat(path).then(()=>false,error=>{if(error.code==='ENOENT')return true;throw error;});}
/** @param {string} markerPath */
function validateMarkerPath(markerPath){const path=resolve(markerPath);assert.ok(path.startsWith(resolve('artifacts')+sep),'Ownership proof must be in owned artifacts');return path;}
/** Create proof outside an absent profile; never create/delete app_data_dir.
 * @param {string} markerPath */
export async function prepareCrudProfileOwnership(markerPath){
  const path=validateMarkerPath(markerPath);assert.equal(await missing(path),true,'Refuse to replace ownership proof');
  const knownFolder=knownWindowsApplicationData(),profile=join(knownFolder,resourceCrudProbeIdentifier);
  const info=await lstat(knownFolder);assert.ok(info.isDirectory()&&!info.isSymbolicLink());assert.equal(canonical(await realpath(knownFolder)),canonical(knownFolder));
  assert.equal(await missing(profile),true,'Refuse existing unowned CRUD profile');
  const record={identifier:resourceCrudProbeIdentifier,knownFolder,profile,initiallyAbsent:true,prepared:Date.now(),state:'prepared',launches:/** @type {any[]} */([])};
  await mkdir(resolve(path,'..'),{recursive:true});await Bun.write(path,JSON.stringify(record,null,2));return record;
}
/** Bind the audited completed executable before a profile can be reserved.
 * @param {string} markerPath @param {string} buildStatePath @param {string} artifactPath */
export async function bindCrudProfileCandidate(markerPath,buildStatePath,artifactPath){
  const path=validateMarkerPath(markerPath),record=await Bun.file(path).json();assert.equal(record.state,'prepared');
  const buildPath=validateMarkerPath(buildStatePath),artifact=validateMarkerPath(artifactPath),bytes=await Bun.file(artifact).bytes(),build=await Bun.file(buildPath).json();
  assert.equal(build.identifier,resourceCrudProbeIdentifier);assert.equal(build.status,'finished');assert.equal(build.result?.code,0);assert.equal(canonical(build.artifact),canonical(artifact));assert.ok(Buffer.from(bytes).includes(Buffer.from(resourceCrudProbeIdentifier)));
  record.candidate={buildStatePath:buildPath,artifact,exeSha256:createHash('sha256').update(bytes).digest('hex'),buildStateSha256:createHash('sha256').update(await Bun.file(buildPath).bytes()).digest('hex')};await Bun.write(path,JSON.stringify(record,null,2));return record;
}
/** @param {string} markerPath @param {string} buildStatePath @param {string} artifactPath */
export async function reserveCrudProfileLaunch(markerPath,buildStatePath,artifactPath){
  const path=validateMarkerPath(markerPath),record=await Bun.file(path).json(),knownFolder=knownWindowsApplicationData();
  assert.equal(record.identifier,resourceCrudProbeIdentifier);assert.equal(record.initiallyAbsent,true);assert.equal(canonical(record.knownFolder),canonical(knownFolder));assert.equal(canonical(record.profile),canonical(join(knownFolder,resourceCrudProbeIdentifier)));
  assert.ok(record.candidate,'Profile requires audited candidate binding');assert.equal(canonical(record.candidate.buildStatePath),canonical(buildStatePath));assert.equal(canonical(record.candidate.artifact),canonical(artifactPath));
  assert.equal(createHash('sha256').update(await Bun.file(buildStatePath).bytes()).digest('hex'),record.candidate.buildStateSha256,'Build record changed after profile binding');assert.equal(createHash('sha256').update(await Bun.file(artifactPath).bytes()).digest('hex'),record.candidate.exeSha256,'Executable changed after profile binding');
  if(record.state==='prepared')assert.equal(await missing(record.profile),true,'Profile created before its first owned launch');
  else{assertCrudProfileRestartable(record);const info=await lstat(record.profile);assert.ok(info.isDirectory()&&!info.isSymbolicLink());assert.equal(canonical(await realpath(record.profile)),canonical(record.profile));}
  record.state='reserved';await Bun.write(path,JSON.stringify(record,null,2));return record;
}
/** Bind actual native resolved path before the scenario may mutate its profile.
 * @param {string} markerPath @param {number} pid @param {string} nativePath */
export async function bindCrudProfileLaunch(markerPath,pid,nativePath){
  const path=validateMarkerPath(markerPath),record=await Bun.file(path).json();assert.equal(record.state,'reserved');assert.equal(record.identifier,resourceCrudProbeIdentifier);assert.equal(canonical(nativePath),canonical(record.profile),'Actual native app_data_dir must match approved KnownFolder profile');
  for(let turn=0;turn<100&&await missing(record.profile);turn++)await Bun.sleep(20);
  const info=await lstat(record.profile);assert.ok(info.isDirectory()&&!info.isSymbolicLink());assert.equal(canonical(await realpath(record.profile)),canonical(record.profile));
  record.state='owned';record.launches.push({pid,nativePath,verified:Date.now()});await Bun.write(path,JSON.stringify(record,null,2));return record;
}
/** A live/bound host is never enough proof that its profile can be reused.
 * @param {any} record */
export function assertCrudProfileRestartable(record){
  assert.equal(record.state,'owned-exited','Only observed exited owned host can restart');assert.ok(Array.isArray(record.launches)&&record.launches.length);
  const last=record.launches.at(-1);assert.ok(last.observedExit&&Number.isFinite(last.observedExit.observed),'Owned host exit must be recorded');
}
/** Called only after withNativeApp observes this exact spawned child's exit.
 * @param {string} markerPath @param {number} pid @param {{code?:number|null,signal?:string|null,error?:string}} exit */
export async function recordCrudProfileExit(markerPath,pid,exit){
  const path=validateMarkerPath(markerPath),record=await Bun.file(path).json();
  if(record.state==='reserved')return; // Failed before native path ownership was established.
  assert.equal(record.state,'owned');const last=record.launches.at(-1);assert.equal(last?.pid,pid,'Exit must belong to the exact owned host');assert.ok(!exit.error&&(typeof exit.code==='number'||typeof exit.signal==='string'),'Actual child exit required');
  last.observedExit={...exit,observed:Date.now()};record.state='owned-exited';await Bun.write(path,JSON.stringify(record,null,2));return record;
}
