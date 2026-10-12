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
  const path=validateMarkerPath(markerPath),record=await Bun.file(path).json(),knownFolder=knownWindowsApplicationData();
  assertCrudNativePathBinding(record,pid,nativePath,knownFolder);
  const parent=await lstat(knownFolder);assert.ok(parent.isDirectory()&&!parent.isSymbolicLink());assert.equal(canonical(await realpath(knownFolder)),canonical(knownFolder));
  const candidate=record.candidate;validateMarkerPath(candidate.buildStatePath);validateMarkerPath(candidate.artifact);
  assert.equal(createHash('sha256').update(await Bun.file(candidate.buildStatePath).bytes()).digest('hex'),candidate.buildStateSha256);const executable=await Bun.file(candidate.artifact).bytes();assert.equal(createHash('sha256').update(executable).digest('hex'),candidate.exeSha256);
  const build=await Bun.file(candidate.buildStatePath).json();assert.equal(build.identifier,resourceCrudProbeIdentifier);assert.equal(build.status,'finished');assert.equal(build.result?.code,0);assert.equal(canonical(build.artifact),canonical(candidate.artifact));assert.ok(Buffer.from(executable).includes(Buffer.from(resourceCrudProbeIdentifier)));
  const absent=await missing(record.profile);assertCrudNativeDirectoryPolicy(record,absent);
  const row={pid,nativePath,verified:Date.now(),directoryAbsentAtBind:absent,profileBinding:'pending'};
  // Persist the exact native-resolved owner before directory validation. The
  // path resolver need not create app_data_dir; the first UI Save will do so.
  record.state='owned';record.launches.push(row);await Bun.write(path,JSON.stringify(record,null,2));
  if(!absent){const info=await lstat(record.profile);assert.ok(info.isDirectory()&&!info.isSymbolicLink());assert.equal(canonical(await realpath(record.profile)),canonical(record.profile));}
  row.profileBinding=absent?'native-path-first-absence':'native-path-directory';await Bun.write(path,JSON.stringify(record,null,2));return record;
}
/** @param {any} record @param {number} pid @param {string} nativePath @param {string} knownFolder */
export function assertCrudNativePathBinding(record,pid,nativePath,knownFolder){
  assert.equal(record.state,'reserved');assert.equal(record.identifier,resourceCrudProbeIdentifier);assert.equal(record.initiallyAbsent,true);assert.ok(Number.isSafeInteger(pid)&&pid>0);assert.ok(record.candidate);assert.ok(Array.isArray(record.launches));
  assert.equal(canonical(record.knownFolder),canonical(knownFolder));assert.equal(canonical(record.profile),canonical(join(knownFolder,resourceCrudProbeIdentifier)));assert.equal(canonical(nativePath),canonical(record.profile),'Actual native app_data_dir must match approved KnownFolder profile');
}
/** @param {any} record @param {boolean} absent */
export function assertCrudNativeDirectoryPolicy(record,absent){
  assert.equal(record.initiallyAbsent,true);assert.ok(!absent||record.launches.length===0,'Only original first owned binding may precede profile creation');
}
/** Readonly validation of the explicitly frozen, failed first-launch evidence.
 * The actual native path is inferred from the old bind's guarded ENOENT line,
 * not from an independently recorded native resolve_directory result.
 * @param {any} record @param {any} prelaunch @param {any} negative @param {any} host @param {any[]} inventory */
export function assertCrudFailedFirstLaunchRecovery(record,prelaunch,negative,host,inventory){
  assert.equal(record.identifier,resourceCrudProbeIdentifier);assert.equal(record.initiallyAbsent,true);assert.equal(record.state,'reserved');assert.deepEqual(record.launches,[]);assert.ok(record.candidate);
  assert.equal(prelaunch.passed,true);assert.equal(prelaunch.initiallyAbsent,true);assert.equal(prelaunch.identifier,record.identifier);assert.equal(canonical(prelaunch.profile),canonical(record.profile));assert.equal(prelaunch.exeSha256,record.candidate.exeSha256);
  assert.equal(prelaunch.sources,752);assert.equal(prelaunch.assets,51);assert.equal(prelaunch.consumed['tests/ui/helpers/native-profile-ownership.js'],'15312e1964f8bbdbf6c989471c6f47d3c064bdf6a08f38d2a1a13bd430000ecc');assert.equal(prelaunch.consumed['tests/ui/helpers/native-app.js'],'b5a7d840221db88d8ef8347e3e9a506d6950678b2d60e4e0785a8dbece35e5ed');
  assert.equal(negative.passedNegativeAudit,true);assert.equal(negative.fullCrudAcceptance,false);assert.equal(negative.nativeLastCollection,false);assert.deepEqual(negative.fixturesRegistered,[]);assert.deepEqual(negative.liveHandles,[]);
  assert.equal(canonical(negative.profile),canonical(record.profile));assert.equal(negative.profileCreatedOnClose,true);assert.equal(negative.markerState,'reserved');assert.equal(negative.sourceFrozen,true);
  assert.equal(host.status,'failed');assert.equal(host.expectedIdentifier,record.identifier);assert.equal(host.pid,negative.hostPid);assert.equal(host.exit.code,0);assert.equal(host.exit.signal,null);assert.deepEqual(host.exit,negative.exit);assert.equal(host.renderingMode,'native-hidden');assert.equal(host.hiddenWindow.pid,host.pid);assert.equal(host.hiddenWindow.visible,false);
  assert.ok(host.error.startsWith("Error: ENOENT: no such file or directory, lstat '"+record.profile+"'"));assert.ok(host.error.includes('at async bindCrudProfileLaunch '));assert.ok(host.error.includes('native-profile-ownership.js:50:20'));
  assert.equal(inventory.length,1);assert.deepEqual(inventory,negative.inventory);const file=inventory[0];assert.equal(file.name,'.window-state.json');assert.equal(file.bytes,212);assert.equal(file.sha256,'afa8dbc1198f6677fb053f160a03b00e106a8f670b638df2431827886107752f');
  const start=Date.parse(host.startedAt),end=Date.parse(host.finishedAt);assert.ok(Number.isFinite(start)&&Number.isFinite(end)&&end>=start);for(const time of [file.created,file.modified])assert.ok(Date.parse(time)>=start&&Date.parse(time)<=end);
}
/** A live/bound host is never enough proof that its profile can be reused.
 * @param {any} record */
export function assertCrudProfileRestartable(record){
  assert.equal(record.state,'owned-exited','Only observed exited owned host can restart');assert.ok(Array.isArray(record.launches)&&record.launches.length);
  const last=record.launches.at(-1);assert.ok(last.observedExit&&Number.isFinite(last.observedExit.observed),'Owned host exit must be recorded');
  assert.ok(['native-path-first-absence','native-path-directory','recovered-failed-first-launch'].includes(last.profileBinding),'Exact original native path binding required for restart');
}
/** Called only after withNativeApp observes this exact spawned child's exit.
 * @param {string} markerPath @param {number} pid @param {{code?:number|null,signal?:string|null,error?:string}} exit */
export async function recordCrudProfileExit(markerPath,pid,exit){
  const path=validateMarkerPath(markerPath),record=await Bun.file(path).json();
  if(record.state==='reserved')return; // Failed before native path ownership was established.
  assert.equal(record.state,'owned');const last=record.launches.at(-1);assert.equal(last?.pid,pid,'Exit must belong to the exact owned host');assert.ok(!exit.error&&(typeof exit.code==='number'||typeof exit.signal==='string'),'Actual child exit required');
  last.observedExit={...exit,observed:Date.now()};record.state='owned-exited';await Bun.write(path,JSON.stringify(record,null,2));return record;
}
