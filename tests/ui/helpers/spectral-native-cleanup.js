import assert from 'node:assert/strict';
import {lstat,realpath,readdir,readFile,mkdir,unlink,rmdir} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {dlopen} from 'bun:ffi';
import {probeIdentifier} from './native-app.js';
import {knownWindowsApplicationData} from './native-profile-ownership.js';
import {assertSpectralFixtureRepositoryId} from './spectral-native-fixture.js';

const hash=(/** @type {Uint8Array} */bytes)=>createHash('sha256').update(bytes).digest('hex');
const canonical=(/** @type {string} */path)=>resolve(path).toLowerCase();
/** @param {string} path @param {'directory'|'file'} type */
async function ordinary(path,type){const info=await lstat(path);assert.ok(!info.isSymbolicLink());assert.ok(type==='directory'?info.isDirectory():info.isFile());assert.equal(canonical(await realpath(path)),canonical(path),'No reparse/alias cleanup');return info;}
/** @param {string} path */
async function absent(path){return lstat(path).then(()=>false,error=>{if(error.code==='ENOENT')return true;throw error;});}
/** @param {string} root */
async function inventory(root){
 /** @type {{path:string,sha256:string,bytes:number}[]} */
 const files=[];
 /** @type {string[]} */
 const directories=[];
 let bytes=0;
 const walk=async(/** @type {string} */path)=>{
  await ordinary(path,'directory');
  const prefix=relative(root,path);
  assert.ok(!isAbsolute(prefix)&&!prefix.startsWith('..'),'Inventory stays inside exact owned repository');
  directories.push(prefix);
  assert.ok(directories.length<=128,'Bounded fresh fixture directory inventory');
  for(const name of(await readdir(path)).sort()){
   const child=join(path,name),info=await lstat(child);
   assert.ok(!info.isSymbolicLink());
   if(info.isDirectory())await walk(child);
   else{
    await ordinary(child,'file');assert.ok(files.length<256&&bytes+info.size<=8*1024*1024,'Reject oversized fixture files before allocation');const raw=await readFile(child);bytes+=raw.length;
    assert.ok(files.length<256&&bytes<=8*1024*1024,'Bounded fresh init/rules fixture archive');
    files.push({path:relative(root,child),sha256:hash(raw),bytes:raw.length});
   }
  }
 };
 await walk(root);
 return{files,directories,bytes};
}
/** Bind only the already-proven absent→real native-init repository, before test edits.
 * @param {{output:string,pid:number,repository:string,fixture:any}} context */
export async function bindSpectralNativeRepositoryCleanup({output,pid,repository,fixture}){
 assertSpectralFixtureRepositoryId(fixture.repositoryId);const proof=resolve(output);assert.ok(proof.startsWith(resolve('artifacts')+sep));await ordinary(proof,'directory');
 const beforePath=join(proof,'spectral-repository-before.json'),beforeBytes=await readFile(beforePath),before=JSON.parse(beforeBytes.toString());const profile=join(knownWindowsApplicationData(),probeIdentifier),expected=join(profile,'git-v1','repo-'+fixture.repositoryId);
 assert.equal(before.initiallyAbsent,true);assert.equal(before.repositoryId,fixture.repositoryId);assert.equal(canonical(before.profile),canonical(profile));assert.equal(canonical(before.repository),canonical(expected));assert.equal(canonical(repository),canonical(expected));
 for(const path of[profile,join(profile,'git-v1'),expected,join(expected,'.git')])await ordinary(path,'directory');
 const baseline=await inventory(expected);assert.ok(baseline.files.every(file=>file.path.startsWith('.git'+sep)),'Bind immediately after native init, before rules writes');
 const marker=join(proof,'spectral-repository-cleanup-owner.json');assert.equal(await absent(marker),true);const owner={repository:expected,profile,repositoryId:fixture.repositoryId,pid,beforeProofSha256:hash(beforeBytes),initiallyAbsent:true,baseline,bound:Date.now()};await Bun.write(marker,JSON.stringify(owner,null,2));return{marker,owner};
}

/** Archive then remove ONLY exact fresh owned files, after actual host exit.
 * No recursive deletion, no parent/profile deletion, no unknown/preexisting adoption.
 * @param {Awaited<ReturnType<typeof bindSpectralNativeRepositoryCleanup>>} bound
 * @param {string} output */
export async function retireSpectralNativeRepository(bound,output){
 const proof=resolve(output);assert.equal(resolve(bound.marker),join(proof,'spectral-repository-cleanup-owner.json'));const owner=await Bun.file(bound.marker).json();assert.deepEqual(owner,bound.owner);
 const host=await Bun.file(join(proof,'result.json')).json();assert.equal(host.scenario,'spectral-api-design-native');assert.equal(host.renderingMode,'native-hidden');assert.equal(host.pid,owner.pid);assert.equal(host.exit?.code,0,'Cleanup requires exact owned host terminal0');assert.equal(host.intentionalParentTermination,false);
 const api=dlopen('kernel32.dll',{OpenProcess:{args:['u32','i32','u32'],returns:'u64'},GetLastError:{args:[],returns:'u32'},WaitForSingleObject:{args:['u64','u32'],returns:'u32'},CloseHandle:{args:['u64'],returns:'i32'}});try{const handle=api.symbols.OpenProcess(0x100000,0,owner.pid);if(handle!==0n){try{assert.equal(api.symbols.WaitForSingleObject(handle,0),0,'No live/recycled PID may permit profile cleanup');}finally{api.symbols.CloseHandle(handle);}}else assert.equal(api.symbols.GetLastError(),87,'Only absent PID permits cleanup; access failure is not exit proof');}finally{api.close();}
 assertSpectralFixtureRepositoryId(owner.repositoryId);const profile=join(knownWindowsApplicationData(),probeIdentifier),root=join(profile,'git-v1'),repository=join(root,'repo-'+owner.repositoryId);assert.equal(canonical(owner.profile),canonical(profile));assert.equal(canonical(owner.repository),canonical(repository));assert.equal(owner.initiallyAbsent,true);
 for(const path of[profile,root,repository])await ordinary(path,'directory');assert.equal(hash(await readFile(join(proof,'spectral-repository-before.json'))),owner.beforeProofSha256);
 const final=await inventory(repository),initialGit=new Map(owner.baseline.files.map((/** @type {any} */file)=>[file.path,file.sha256]));assert.deepEqual(final.directories,owner.baseline.directories,'Refuse unexpected directories');const cases=(await readdir(proof)).filter(name=>/^spectral-case-\d+\.json$/.test(name)).sort((a,b)=>Number(a.match(/\d+/)?.[0])-Number(b.match(/\d+/)?.[0]));const latestCase=cases.at(-1);
 let written=new Map();
 if(latestCase){const last=await Bun.file(join(proof,latestCase)).json();assert.equal(canonical(last.repository),canonical(repository));written=new Map(Object.entries(last.files).map(([path,digest])=>[relative(repository,path),digest]));}
 else assert.deepEqual(final,owner.baseline,'Zero-case cleanup requires exact unchanged native init baseline');
 for(const path of written.keys())assert.ok(['other'+sep+'.spectral.yaml','other'+sep+'functions'+sep+'pause.js'].includes(path),'Closed known fixture file cleanup');
 for(const file of final.files){const expected=initialGit.get(file.path)??written.get(file.path);assert.equal(file.sha256,expected,'Refuse any unknown/foreign changed repository file');}assert.equal(final.files.length,initialGit.size+written.size);assert.deepEqual([...initialGit.keys()].sort(),final.files.filter(file=>file.path.startsWith('.git'+sep)).map(file=>file.path).sort());
 const archive=join(proof,'spectral-repository-archive');assert.equal(await absent(archive),true);await mkdir(archive);for(const directory of final.directories.filter(Boolean))await mkdir(join(archive,directory),{recursive:true});for(const file of final.files){const raw=await readFile(join(repository,file.path));assert.equal(hash(raw),file.sha256);await Bun.write(join(archive,file.path),raw);assert.equal(hash(await readFile(join(archive,file.path))),file.sha256);}
 await Bun.write(join(proof,'spectral-repository-before-cleanup.json'),JSON.stringify({owner,host,inventory:final,archive,caseCount:cases.length,baselineOnly:cases.length===0,afterExactNativeHostExit:true,recursiveDeletion:false},null,2));assert.deepEqual(await inventory(repository),final,'No mutation between archive and removal');
 for(const file of final.files){const path=join(repository,file.path);await ordinary(path,'file');assert.equal(hash(await readFile(path)),file.sha256);await unlink(path);}for(const directory of final.directories.sort((a,b)=>b.split(sep).length-a.split(sep).length||b.length-a.length)){const path=join(repository,directory);await ordinary(path,'directory');assert.equal((await readdir(path)).length,0,'Only empty verified owned directories removed');await rmdir(path);}
 assert.equal(await absent(repository),true);await ordinary(profile,'directory');await ordinary(root,'directory');await Bun.write(join(proof,'spectral-repository-cleanup.json'),JSON.stringify({passed:true,repository,archive,removedFiles:final.files.length,removedDirectories:final.directories.length,onlyInitiallyAbsentRegisteredRepository:true,afterExactNativeHostExit:true,parentGitDirectoryPreserved:true,profilePreserved:true,recursiveDeletion:false},null,2));
}
