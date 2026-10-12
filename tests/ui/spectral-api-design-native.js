import assert from 'node:assert/strict';
import {resolve,join,dirname,basename,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {withNativeApp,probeIdentifier} from './helpers/native-app.js';
import {withResourceProbePreserved} from './helpers/resource-manager-cases.js';
import {prepareSpectralNativeWorkspace,initializeSpectralNativeRepository} from './helpers/spectral-native-fixture.js';
import {installSpectralNativeTrace} from './helpers/spectral-native-trace.js';
import {exerciseSpectralApiDesign} from './helpers/spectral-api-design.js';
import {bindSpectralNativeRepositoryCleanup,retireSpectralNativeRepository} from './helpers/spectral-native-cleanup.js';
import {createSpectralReferenceServer} from './helpers/spectral-native-external.js';

// Preparation alone cannot accidentally run on old588 or any stale native binary.
assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE,'Fresh audited native Spectral build required');
assert.ok(process.env.INSOMNIUM_SPECTRAL_NATIVE_CLOSURE,'Fresh source/frontend/sidecar/fixture preflight closure required');
const closure=await Bun.file(process.env.INSOMNIUM_SPECTRAL_NATIVE_CLOSURE).json();
assert.equal(closure.status,'verified');assert.equal(closure.identifier,probeIdentifier);assert.equal(closure.spectralNative,true);
const build=await Bun.file(process.env.INSOMNIUM_UI_BUILD_STATE).json();assert.equal(build.status,'finished');assert.equal(build.result?.code,0);assert.equal(resolve(build.artifact),resolve(closure.artifact));
const bytes=await Bun.file(build.artifact).bytes();assert.equal(createHash('sha256').update(bytes).digest('hex'),closure.exeSha256);for(const command of ['reserve_spectral_lint','run_spectral_lint','cancel_spectral_lint'])assert.ok(Buffer.from(bytes).includes(Buffer.from(command)),'Candidate must embed actual Spectral native commands');
assert.equal(resolve(closure.sidecar.path),join(dirname(resolve(build.artifact)),'spectral-linter.exe'));
for(const file of [...closure.sources,...closure.assets,closure.sidecar,...closure.fixture.assets]){const path=resolve(file.path);assert.ok(path.startsWith(resolve('artifacts')+sep),'Frozen closure paths must be owned artifacts');assert.equal(createHash('sha256').update(await Bun.file(path).bytes()).digest('hex'),file.sha256,'Exact frozen closure '+path);}
assert.equal(closure.fixture.entry,'spectral-api-design-native.js');assert.ok(closure.fixture.assets.some((/** @type {any} */file)=>basename(file.path)===closure.fixture.entry));

/** @type {{bound:Awaited<ReturnType<typeof bindSpectralNativeRepositoryCleanup>>,output:string}|null} */
let repositoryCleanup=null;
/** @type {Awaited<ReturnType<typeof createSpectralReferenceServer>>|null} */
let referenceServer=null;
await withResourceProbePreserved(async()=>{try{await withNativeApp('spectral-api-design-native',async({page,pid,invoke,output})=>{
 const layoutKeys=['insomnium.requestResponseSplit.v1','insomnium.apiSourcePreviewSplit.v1'],layout=await page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),layoutKeys);
 const prepared=await prepareSpectralNativeWorkspace({invoke,output});const repository=await initializeSpectralNativeRepository({invoke,output,fixture:prepared.fixture});
 repositoryCleanup={bound:await bindSpectralNativeRepositoryCleanup({output,pid,repository:repository.repository,fixture:prepared.fixture}),output};
 await page.reload();await page.locator('.app-shell').waitFor();assert.equal(await page.evaluate(()=>/** @type {any} */(window).__TAURI_INTERNALS__.metadata.currentWindow.label),'main');
 const references=await createSpectralReferenceServer(output);referenceServer=references;
 await page.evaluate(seed=>{/** @type {any} */(window).__spectralNativeSeed=seed;},{fixture:prepared.fixture,saved:prepared.saved,referenceOrigin:references.origin});
 for(const file of closure.fixture.assets){const name=basename(file.path);assert.ok(['spectral-api-design-native.js','spectral-api-design-native.css'].includes(name),'Closed native fixture assets');const served=await page.evaluate(async url=>{const response=await window.fetch(url),bytes=new Uint8Array(await response.arrayBuffer());let binary='';for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));return{status:response.status,base64:btoa(binary)};},new URL('/'+name,page.url()).href);assert.equal(served.status,200);assert.equal(createHash('sha256').update(Buffer.from(served.base64,'base64')).digest('hex'),file.sha256,'Actual served fixture bytes');if(name.endsWith('.css'))await page.evaluate(url=>{const link=document.createElement('link');link.rel='stylesheet';link.href=url;document.head.append(link);},new URL('/'+name,page.url()).href);}
 const trace=await installSpectralNativeTrace({page,pid,output,sidecar:closure.sidecar.path,sidecarSha256:closure.sidecar.sha256,fixture:prepared.fixture,configureCase:async(mode,options)=>{references.setRevision(options?.revision??'one');return repository.configureCase(mode,options);}});
 try{
  await page.addScriptTag({url:new URL('/'+closure.fixture.entry,page.url()).href,type:'module'});await page.getByRole('region',{name:'API Design',exact:true}).waitFor();
  await exerciseSpectralApiDesign(page,output,'',{native:true,specId:prepared.fixture.specId,state:async()=>{const state=await trace.state();return{...state,events:[...state.events,...references.events]};},configureCase:(mode,options)=>trace.configureCase(mode,options)});
  const actual=await invoke('load_workspace');for(const original of prepared.original.resources)assert.deepEqual(actual.resources.find((/** @type {any} */row)=>row._id===original._id),original);assert.deepEqual(actual.history,prepared.original.history);const state=await trace.state();assert.equal(state.jobs.length,48);assert.equal(state.jobs.filter((/** @type {any} */job)=>job.cancelled).length,7);assert.ok(state.jobs.every((/** @type {any} */job)=>job.exited&&job.observedProcessObject));assert.equal(references.events.length,36);
  const accepted=await Bun.file(join(output,'acceptance.json')).json();assert.equal(accepted.native,true);assert.equal(accepted.rows.filter((/** @type {any} */row)=>row.width).length,6);assert.equal(accepted.externalRows.length,12);
  await Bun.write(join(output,'native-component-acceptance.json'),JSON.stringify({passed:true,renderingMode:'native-hidden',scope:'Actual compiled ApiDesign component + real Rust commands/registered managed repository/owned loopback references/packaged Bun sidecar; full production shell acceptance not claimed',jobs:48,cancellations:7,profiles:6,externalProfiles:12,httpReads:36,viewport760:'CDP-emulated CSS viewport; not physical native host width',originalResources:prepared.original.resources.length,originalHistory:prepared.original.history.length,originalRowsPreserved:true,clipboardTouched:false,networkSendClaim:false,completeRepositoryReadReceiptsClaim:false},null,2));
 }finally{try{await trace.close();}finally{await page.evaluate(values=>{for(const[key,value]of Object.entries(values)){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}},layout);assert.deepEqual(await page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),layoutKeys),layout);await Bun.write(join(output,'spectral-layout-restoration.json'),JSON.stringify({passed:true,layout},null,2));}}
});}finally{try{if(referenceServer)await referenceServer.close();}finally{if(repositoryCleanup)await retireSpectralNativeRepository(repositoryCleanup.bound,repositoryCleanup.output);}}});
