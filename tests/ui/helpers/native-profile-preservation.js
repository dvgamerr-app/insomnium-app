import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readdir,realpath,lstat,readFile,writeFile,unlink,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {selectedNativeProbeIdentifier,integrationProbeIdentifier} from './native-app.js';

export const cookieLifecycleFile='cookie-lifecycle-v1.json';
/** Validate clean product metadata before treating it as restorable profile data.
 * @param {Uint8Array} bytes */
export function validateCookieLifecycle(bytes){
 assert.ok(bytes.length<=64*1024*1024,'Cookie lifecycle metadata exceeds its native budget');
 const value=JSON.parse(Buffer.from(bytes).toString('utf8'));
 assert.ok(value&&typeof value==='object'&&!Array.isArray(value));
 assert.deepEqual(Object.keys(value).sort(),['owners','pending','version']);
 assert.equal(value.version,1,'Unknown cookie lifecycle version retained');
 assert.equal(value.pending,null,'Refuse pending cookie publication recovery');
 assert.ok(value.owners&&typeof value.owners==='object'&&!Array.isArray(value.owners));
 for(const [id,epoch] of Object.entries(value.owners)){
  assert.match(id,/^[a-zA-Z0-9_-]{1,200}$/);
  assert.ok(typeof epoch==='string'&&(epoch===''||/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(epoch)),'Invalid cookie owner epoch');
 }
 return value;
}
const owned=['workspace-v1.json','workspace-v1.previous.json','.window-state.json',cookieLifecycleFile];
const journals=new Set(['git-transition-v1.json','git-clone-install-v1.json','insomnium-fetch-journal-v1.json','insomnium-restore-ref-locks-v1.json','insomnium-advance-ref-locks-v1.json']);
/** Preserve an existing allowlisted probe profile around a fully awaited native
 * scenario. The callback must await native process exit before settling.
 * Only explicitly selected workspace/auxiliary files may change; originals stay in RAM. Unknown
 * changes are refused and retained, never deleted or overwritten.
 * @template T
 * @param {(context:{profile:string,workspacePath:string})=>Promise<T>} run
 * @param {{responseDownloads?:boolean,pluginData?:boolean}} [options]
 * @returns {Promise<T>} */
export async function preserveNativeProfile(run, options = {}){
 const selectedOwned = [...owned,...(options.responseDownloads?["response-downloads-v1.json"]:[]),...(options.pluginData?["plugin-data-v1.json"]:[])];
 assert.ok(process.env.APPDATA,'Probe profile requires APPDATA');
 const profile=resolve(process.env.APPDATA,selectedNativeProbeIdentifier());
 const inventory=async()=>{
  const root=await lstat(profile);assert.ok(root.isDirectory()&&!root.isSymbolicLink());
  assert.equal((await realpath(profile)).toLowerCase(),profile.toLowerCase());
  const rows=/** @type {{name:string,kind:string,sha256?:string}[]} */([]);
  const visit=async(/** @type {string} */directory,prefix='')=>{
   for(const name of(await readdir(directory)).sort()){
    const path=join(directory,name),key=prefix+name,stat=await lstat(path);
    assert.ok(!stat.isSymbolicLink(),'Refuse linked profile path: '+key);
    assert.equal((await realpath(path)).toLowerCase(),path.toLowerCase(),'Refuse redirected profile path: '+key);
    assert.ok(!journals.has(name),'Refuse pending profile recovery: '+key);
    if(stat.isDirectory()){rows.push({name:key,kind:'directory'});await visit(path,key+'/');}
    else{assert.ok(stat.isFile(),'Refuse non-file profile entry: '+key);const bytes=await readFile(path);if(key===cookieLifecycleFile)validateCookieLifecycle(bytes);rows.push({name:key,kind:'file',sha256:createHash('sha256').update(bytes).digest('hex')});}
   }
  };
  await visit(profile);return rows;
 };
 const before=await inventory(), originals=await Promise.all(selectedOwned.map(async name=>{
  const exists=before.some(row=>row.name===name&&row.kind==='file');
  assert.ok(exists||name==='.window-state.json'||name===cookieLifecycleFile||name==='response-downloads-v1.json'||options.pluginData&&name==='plugin-data-v1.json','Existing workspace file required: '+name);
  return {name,path:join(profile,name),bytes:exists?await readFile(join(profile,name)):undefined};
 }));
 let result=/** @type {T|undefined} */(undefined),failure=/** @type {unknown} */(undefined);
 try{result=await run({profile,workspacePath:join(profile,owned[0])});}catch(error){failure=error;}
 const errors=/** @type {unknown[]} */([]);
 let canRestore=true;
 try{const after=await inventory();assert.deepEqual(after.filter(row=>!selectedOwned.includes(row.name)),before.filter(row=>!selectedOwned.includes(row.name)),'Unowned profile contents and layout changed');}catch(error){errors.push(error);canRestore=false;}
 if(canRestore)for(const original of originals){try{
  if(original.bytes===undefined){
   try{const stat=await lstat(original.path);assert.ok(stat.isFile()&&!stat.isSymbolicLink());assert.equal((await realpath(original.path)).toLowerCase(),original.path.toLowerCase());await unlink(original.path);}catch(error){if(/** @type {any} */(error).code!=='ENOENT')throw error;}
   continue;
  }
  const stat=await lstat(original.path);assert.ok(stat.isFile()&&!stat.isSymbolicLink());
  assert.equal((await realpath(original.path)).toLowerCase(),original.path.toLowerCase());
  await writeFile(original.path,original.bytes);assert.deepEqual(await readFile(original.path),original.bytes);
 }catch(error){errors.push(error);}}
 try{assert.deepEqual(await inventory(),before,'Entire profile must match its prelaunch state');}catch(error){errors.push(error);}
 if(errors.length)throw new AggregateError(failure===undefined?errors:[failure,...errors],'Native profile preservation failed');
 if(failure!==undefined)throw failure;
 return /** @type {T} */(result);
}

/** Initialize only the new, absent integration profile using product defaults.
 * Refuses any existing path; no legacy credentials, Git or store copied.
 * Invoke explicitly before builds/scenarios; importing does not mutate disk.
 * @returns {Promise<{profile:string,identifier:string}>} */
export async function initializeIntegrationProbeProfile(){
 assert.equal(selectedNativeProbeIdentifier(),integrationProbeIdentifier,'Integration initializer requires explicit probe identifier');
 assert.ok(process.env.APPDATA,'APPDATA required');
 const parent=resolve(process.env.APPDATA),stat=await lstat(parent);
 assert.ok(stat.isDirectory()&&!stat.isSymbolicLink());
 assert.equal((await realpath(parent)).toLowerCase(),parent.toLowerCase());
 const profile=join(parent,integrationProbeIdentifier);
 try{await lstat(profile);throw Error('Integration profile already exists; initialization refused');}catch(error){if(/** @type {any} */(error).code!=='ENOENT')throw error;}
 const {initialData}=await import('../../../src/lib/model.js');
 const bytes=Buffer.from(JSON.stringify(initialData()));
 await mkdir(profile);
 for(const name of owned.slice(0,2))await writeFile(join(profile,name),bytes,{flag:'wx'});
 return {profile,identifier:integrationProbeIdentifier};
}
