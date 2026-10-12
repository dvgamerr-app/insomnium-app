import assert from 'node:assert/strict';
import {lstat,realpath,mkdir,readFile} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {initialData} from '../../../src/lib/model.js';
import {probeIdentifier} from './native-app.js';
import {knownWindowsApplicationData} from './native-profile-ownership.js';
import {registerResourceProbeCollection} from './resource-manager-cases.js';

const canonical=(/** @type {string} */path)=>resolve(path).toLowerCase();
const digest=(/** @type {Uint8Array} */bytes)=>createHash('sha256').update(bytes).digest('hex');
const modes=new Set(['default','custom','warnings','fallback','held']);
export const spectralNativeSource='\uFEFFopenapi: 3.1.0\r\ninfo:\r\n  title: Fixture 😀\r\n  version: \'1\'\r\npaths:\r\n  /probe:\r\n    get:\r\n      responses:\r\n        \'200\':\r\n          description: OK\r\ncomponents:\r\n  schemas:\r\n    A:\r\n      $ref: \'./a/shared.yaml\'\r\n    B:\r\n      $ref: \'./b/shared.yaml\'\r\n';
/** Refuse link/adoption before any closed owned fixture write. @param {string} path */
async function normalDirectory(path){const info=await lstat(path);assert.ok(info.isDirectory()&&!info.isSymbolicLink(),'Normal owned directory required');assert.equal(canonical(await realpath(path)),canonical(path),'Reparse/alias path refused');}
/** @param {string} path */
async function absent(path){return lstat(path).then(()=>false,error=>{if(error.code==='ENOENT')return true;throw error;});}
/** Strict fixture ID, never accept caller-supplied native path. @param {string} id */
export function assertSpectralFixtureRepositoryId(id){assert.match(id,/^git_spectral_[a-f0-9]{32}$/);}

/** Add real owned resources; this does NOT launch an app or invoke at module load.
 * @param {{invoke:import('./native-app.js').NativeInvoke,output:string}} context */
export async function prepareSpectralNativeWorkspace({invoke,output}){
 const original=await invoke('load_workspace');assert.ok(original&&Array.isArray(original.resources)&&Array.isArray(original.history));
 const owned=initialData(),other=initialData(),collection=owned.resources.find(row=>row._type==='workspace'),otherCollection=other.resources.find(row=>row._type==='workspace');assert.ok(collection&&otherCollection);
 collection.name='Native Spectral '+crypto.randomUUID();otherCollection.name=collection.name+' other';
 const specId='spc_spectral_'+crypto.randomUUID().replaceAll('-',''),repositoryId='git_spectral_'+crypto.randomUUID().replaceAll('-','');assertSpectralFixtureRepositoryId(repositoryId);
 const binding={_id:repositoryId,_type:'git_repository',parentId:collection._id,nativeBindingVersion:1,nativeRepositoryId:repositoryId};
 const spec={_id:specId,_type:'api_spec',parentId:collection._id,fileName:'openapi.yaml',contents:spectralNativeSource,files:[{name:'a/shared.yaml',contents:'\uFEFFtype: object\r\nproperties:\r\n  label😀:\r\n    type: string\r\n'},{name:'b/shared.yaml',contents:'type: object\r\nproperties:\r\n  label:\r\n    type: integer\r\n'}],exampleFiles:[]};
 const seed={...original,resources:[...original.resources,...owned.resources,...other.resources,spec,binding],activeWorkspaceId:collection._id,activeRequestId:owned.activeRequestId,activeEnvironmentId:owned.activeEnvironmentId,openTabs:[...original.openTabs,owned.activeRequestId]};
 assert.equal(new Set(seed.resources.map((/** @type {any} */row)=>row._id)).size,seed.resources.length,'No owned/original ID collisions');await invoke('save_workspace',{data:seed});const saved=await invoke('load_workspace');
 for(const item of [collection,otherCollection]){const actual=saved.resources.find((/** @type {any} */row)=>row._id===item._id);assert.deepEqual(actual,item);registerResourceProbeCollection(actual._id,actual.name);}
 for(const row of original.resources)assert.deepEqual(saved.resources.find((/** @type {any} */current)=>current._id===row._id),row);assert.deepEqual(saved.history,original.history);
 const fixture={workspaceId:collection._id,otherWorkspaceId:otherCollection._id,specId,repositoryId,binding,spec,collections:[{id:collection._id,name:collection.name},{id:otherCollection._id,name:otherCollection.name}],createdResources:[...owned.resources,...other.resources,spec,binding].map((/** @type {Record<string,any>} */row)=>({id:row._id,type:row._type,parentId:row.parentId,name:row.name??null})),originalIds:original.resources.map((/** @type {any} */row)=>row._id),originalResources:original.resources.length,originalHistory:original.history.length};
 await Bun.write(join(output,'spectral-fixture-registration.json'),JSON.stringify({...fixture,registeredBeforeGitAndUiOperations:true},null,2));return{fixture,original,saved};
}

/** Initialize through the existing real Git command; only then prepare exact owned paths.
 * No general shell, recursive deletion, arbitrary path or production permission.
 * @param {{invoke:import('./native-app.js').NativeInvoke,output:string,fixture:Awaited<ReturnType<typeof prepareSpectralNativeWorkspace>>['fixture']}} context */
export async function initializeSpectralNativeRepository({invoke,output,fixture}){
 assertSpectralFixtureRepositoryId(fixture.repositoryId);const known=knownWindowsApplicationData(),profile=join(known,probeIdentifier),root=join(profile,'git-v1'),repository=join(root,'repo-'+fixture.repositoryId);
 await normalDirectory(known);await normalDirectory(profile);assert.equal(canonical(await invoke('plugin:path|resolve_directory',{directory:14,path:null})),canonical(profile),'Actual Tauri appData must match KnownFolder fixed probe');
 if(!(await absent(root)))await normalDirectory(root);assert.equal(await absent(repository),true,'Refuse existing/adopted Spectral repository');
 await Bun.write(join(output,'spectral-repository-before.json'),JSON.stringify({known,profile,root,repository,initiallyAbsent:true,repositoryId:fixture.repositoryId},null,2));
 await invoke('git_repository_init',{repositoryId:fixture.repositoryId});await normalDirectory(root);await normalDirectory(repository);await normalDirectory(join(repository,'.git'));
 const other=join(repository,'other');assert.equal(await absent(other),true,'Fresh native repo other/ must be absent');await mkdir(other);await normalDirectory(other);const functions=join(other,'functions');await mkdir(functions);await normalDirectory(functions);
 const proof=resolve(output);assert.ok(proof.startsWith(resolve('artifacts')+sep),'Entry marker must be in owned artifacts');await normalDirectory(proof);
 /** @type {Map<string,string>} */const prior=new Map();let serial=0;
 return{
  repository,fixture,
  /** @param {string} mode */async configureCase(mode){assert.ok(modes.has(mode),'Closed Spectral modes only');await normalDirectory(repository);await normalDirectory(other);await normalDirectory(functions);serial++;
   const common='extends: []\nrules:\n';const rules={custom:common+[0,1,2,3].map(severity=>`  '${severity}':\n    description: Fixture severity ${severity}\n    severity: ${severity}\n    given: '$.info'\n    then:\n      field: x-required-${severity}\n      function: truthy\n`).join('')+'  attached-warning:\n    severity: warn\n    given: \'$.components.schemas.*\'\n    then:\n      field: description\n      function: truthy\n',warnings:common+'  warning-only:\n    severity: warn\n    given: \'$.info\'\n    then:\n      field: x-required\n      function: truthy\n',fallback:'extends: [./missing-owned-rules.yaml]\n',held:common+'  entered-owned-function:\n    severity: warn\n    given: \'$\'\n    then:\n      function: pause\nfunctions: [pause]\nfunctionsDir: ./functions\n'};
   const marker=join(proof,'spectral-entered-'+serial+'.json');assert.equal(await absent(marker),true);
   const writeOwned=async(/** @type {'.spectral.yaml'|'pause.js'} */name,/** @type {string} */text)=>{const path=name==='.spectral.yaml'?join(other,name):join(functions,name);if(prior.has(path)){const info=await lstat(path);assert.ok(info.isFile()&&!info.isSymbolicLink());assert.equal(canonical(await realpath(path)),canonical(path));assert.equal(digest(await readFile(path)),prior.get(path),'Refuse foreign fixture edits');}else assert.equal(await absent(path),true,'Refuse preexisting fixture file');await Bun.write(path,text);prior.set(path,digest(await readFile(path)));};
   if(mode!=='default')await writeOwned('.spectral.yaml',rules[/** @type {'custom'|'warnings'|'fallback'|'held'} */(mode)]);
   if(mode==='held')await writeOwned('pause.js',`import{writeFileSync,renameSync}from'node:fs';export default async function(){const marker=${JSON.stringify(marker)};writeFileSync(marker+'.pending',JSON.stringify({pid:process.pid,entered:Date.now()}),{flag:'wx'});renameSync(marker+'.pending',marker);await new Promise(resolve=>setTimeout(resolve,4000));return [{message:'Owned delayed finding',path:['info','title']}];}`);
   await Bun.write(join(proof,'spectral-case-'+serial+'.json'),JSON.stringify({mode,serial,repository,marker,files:Object.fromEntries(prior)},null,2));return{mode,serial,marker};
  },
 };
}
