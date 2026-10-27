import assert from "node:assert/strict";
import {initialData} from "../../src/lib/model.js";
import {withPreview} from "./helpers/preview-app.js";
import {resolve} from "node:path";
import {withNativeApp,poll,integrationProbeIdentifier,selectedNativeProbeIdentifier} from './helpers/native-app.js';
import {preserveNativeProfile} from './helpers/native-profile-preservation.js';
import {withResourceProbePreserved,registerResourceProbeCollection} from './helpers/resource-manager-cases.js';
import {respondToOwnedSaveDialog} from './helpers/windows-save-dialog.js';

const nativeSecrets=process.env.INSOMNIUM_SECRETS_NATIVE==='1';

const original = initialData();
const originalEnvironment=original.resources.find(row=>row._type==='environment');assert.ok(originalEnvironment);
const originalEnvironmentId=originalEnvironment._id;
Object.assign(originalEnvironment,{data:{token:'public-other-owner',collection_token:'public-collection-key',legacy_secret:'owned-legacy-secret'},secretKeys:['legacy_secret'],_legacySource:{record:{data:{legacy_secret:'owned-legacy-history',token:'public-history'},_postmanSource:{values:[{key:'legacy_secret',value:'owned-legacy-postman'}]},custom:'retain'}}});
const source = {id:"owned-postman-environment",name:"Owned Postman environment",_postman_variable_scope:"environment",values:[
  {key:"base_url",value:"https://owned.invalid",enabled:true},
  {key:"disabled_value",value:"preserve-only",enabled:false},
  {key:"token",value:"owned-environment-secret",enabled:true,description:"retain secret metadata"},
  {key:"token",value:"owned-disabled-environment-secret",enabled:false},
  {key:'7',value:'owned-numeric-environment-secret',enabled:true},
  {key:'public_empty',id:'token',value:'public-empty-key',enabled:true},
]};
const collectionSource={info:{name:'Owned secret collection',schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'},item:[],variable:[{key:'collection_token',value:'owned-collection-secret',description:'retain collection metadata'},{id:'alias_token',value:'owned-alias-secret'},{id:42,value:'owned-numeric-collection-secret'},{key:'public',value:'public-variable'},{key:'collection_token',value:'owned-disabled-collection-secret',disabled:true}]};
const secretValues=['owned-environment-secret','owned-disabled-environment-secret','owned-collection-secret','owned-alias-secret','owned-disabled-collection-secret','owned-legacy-secret','owned-legacy-history','owned-legacy-postman','owned-numeric-environment-secret','owned-numeric-collection-secret'];
/** @param {import('playwright-core').Page} page @param {string} output
 * @param {{read?:()=>Promise<any>,saveExport?:(path:string)=>Promise<void>}} [options] */
async function runEnvironmentImport(page, output, options = {}) {
  const stored=options.read??(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}')));
  await poll(async()=>await page.getByRole('combobox',{name:'Collection',exact:true}).inputValue()===original.activeWorkspaceId,'Seeded collection initialized');
  await page.getByRole("button", {name:"Import collection",exact:true}).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Import collection or cURL commands", {exact:true}).fill(JSON.stringify(source));
  await dialog.getByRole("button", {name:"Review import",exact:true}).click();
  await dialog.getByText("1 environments", {exact:true}).waitFor();
  await dialog.getByRole("button", {name:"Import",exact:true}).click();
  await dialog.waitFor({state:"detached"});
  await poll(async()=>(await stored()).resources?.some((/** @type {any} */ r)=>r._postmanSource?.id===source.id),'Postman environment persisted');
  const saved = await stored();
  const environment = saved.resources.find((/** @type {any} */ r) => r._postmanSource?.id === source.id);
  assert.deepEqual(environment.data, {base_url:"https://owned.invalid",token:'owned-environment-secret','7':'owned-numeric-environment-secret',public_empty:'public-empty-key'});
  assert.deepEqual(environment._postmanSource, source);
  assert.ok(saved.resources.some((/** @type {any} */ r) => r._id === original.activeWorkspaceId));
  await page.reload();
  await page.getByRole("button", {name:"Import collection",exact:true}).waitFor();
  const reloaded = await stored();
  assert.deepEqual(reloaded.resources.find((/** @type {any} */ r) => r._id === environment._id), environment);
  const markSecrets=async(/** @type {string} */ collectionId,/** @type {string[]} */ keys)=>{
    await page.getByRole('combobox',{name:'Collection',exact:true}).selectOption(collectionId);
    await page.getByRole('button',{name:'Edit environment',exact:true}).click();
    const editor=page.getByRole('dialog');
    for(const key of keys)await editor.getByRole('checkbox',{name:key,exact:true}).check();
    await editor.getByRole('button',{name:'Save environment',exact:true}).click();await editor.waitFor({state:'detached'});
    await poll(async()=>(await stored()).resources?.some((/** @type {any} */ r)=>r._type==='environment'&&r.parentId===collectionId&&keys.every(key=>r.secretKeys?.includes(key))),'Secret flags persisted');
  };
  await markSecrets(environment.parentId,['token','7']);
  await page.getByRole('button',{name:'Import collection',exact:true}).click();
  await dialog.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify(collectionSource));
  await dialog.getByRole('button',{name:'Review import',exact:true}).click();await dialog.getByRole('button',{name:'Import',exact:true}).click();await dialog.waitFor({state:'detached'});
  await poll(async()=>(await stored()).resources?.some((/** @type {any} */ r)=>r._type==='workspace'&&r.name===collectionSource.info.name),'Collection import persisted');
  const collection=(await stored()).resources.find((/** @type {any} */ row)=>row._type==='workspace'&&row.name===collectionSource.info.name);assert.ok(collection);
  await markSecrets(collection._id,['collection_token','alias_token','42']);
  const beforeExport=await stored(),path=resolve(output,'portable-secrets.json');
  if(options.saveExport)await options.saveExport(path);
  else{const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Export collections',exact:true}).click();await(await downloading).saveAs(path);}
  const text=await Bun.file(path).text(),exported=JSON.parse(text);
  await Bun.write(output+'/export-observation.json',JSON.stringify({leaked:secretValues.filter(value=>text.includes(value))},null,2));
  for(const value of secretValues)assert.equal(text.includes(value),false,'Marked secrets must not survive in portable source provenance');
  const exportedEnvironment=exported.resources.find((/** @type {any} */ row)=>row._id===environment._id),exportedCollection=exported.resources.find((/** @type {any} */ row)=>row._id===collection._id);
  assert.equal(exportedEnvironment.data.token,'');assert.deepEqual(exportedEnvironment._postmanSource.values,source.values.map(row=>['token','7'].includes(String(row.key))?{...row,value:''}:row));
  assert.deepEqual(exportedCollection._postmanSource.variable,collectionSource.variable.map(row=>['collection_token','alias_token','42'].includes(String(row.key||row.id||''))?{...row,value:''}:row));
  const publicEnvironment=exported.resources.find((/** @type {any} */ row)=>row._id===originalEnvironmentId);assert.equal(publicEnvironment.data.token,'public-other-owner');assert.equal(publicEnvironment.data.collection_token,'public-collection-key');assert.equal(publicEnvironment._legacySource.record.custom,'retain');assert.equal(publicEnvironment._legacySource.record.data.token,'public-history');
  assert.deepEqual(await stored(),beforeExport,'Export never edits live values or their original sources');
  const previousIds=beforeExport.resources.map((/** @type {any} */ row)=>row._id);
  await page.getByRole('button',{name:'Import collection',exact:true}).click();await dialog.getByLabel('Import collection or cURL commands',{exact:true}).fill(text);await dialog.getByRole('button',{name:'Review import',exact:true}).click();await dialog.getByRole('button',{name:'Import',exact:true}).click();await dialog.waitFor({state:'detached'});
  await poll(async()=>(await stored()).resources?.length>beforeExport.resources.length,'Exported collection reimport persisted');await page.reload();await page.getByRole('button',{name:'Import collection',exact:true}).waitFor();
  const roundtrip=(await stored()).resources.filter((/** @type {any} */ row)=>!previousIds.includes(row._id));
  const roundtripEnvironment=roundtrip.find((/** @type {any} */ row)=>row._type==='environment'&&row._postmanSource?.id===source.id);assert.ok(roundtripEnvironment);assert.equal(roundtripEnvironment.data.token,'');assert.equal(roundtripEnvironment.data['7'],'');assert.equal(roundtripEnvironment.data.public_empty,'public-empty-key');assert.deepEqual(roundtripEnvironment.secretKeys,['token','7']);
  const roundtripCollection=roundtrip.find((/** @type {any} */ row)=>row._type==='workspace'&&row.name===collectionSource.info.name);assert.ok(roundtripCollection);
  const roundtripBase=roundtrip.find((/** @type {any} */ row)=>row._type==='environment'&&row.parentId===roundtripCollection._id);assert.ok(roundtripBase);for(const key of ['collection_token','alias_token','42']){assert.equal(roundtripBase.data[key],'');assert.ok(roundtripBase.secretKeys.includes(key));}assert.equal(roundtripBase.data.public,'public-variable');
  assert.deepEqual(beforeExport.resources.find((/** @type {any} */ row)=>row._id===environment._id)._postmanSource,source);
  const acceptance={status:"passed",headless:!nativeSecrets,renderingMode:nativeSecrets?'native-hidden':'headless',scope:"Built app import/mark Secret/export/reimport/reload, no network",enabledOnly:true,sourcePreserved:true,originalCollectionRetained:true,secretValuesBlanked:true,provenanceBlanked:true,collectionScopeIsolated:true,liveDataUnchanged:true,roundtripRetained:true};
  await Bun.write(output + (nativeSecrets?'/acceptance.json':'/result.json'),JSON.stringify(acceptance,null,2));
}
if(nativeSecrets){
  assert.equal(selectedNativeProbeIdentifier(),integrationProbeIdentifier);assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE,'Explicit current native build required');
  await preserveNativeProfile(async({workspacePath})=>withResourceProbePreserved(async()=>{
    await Bun.write(workspacePath,JSON.stringify(original));
    const registered=new Set();
    await withNativeApp('postman-secret-export',async({page,pid,invoke,output})=>{
      const read=async()=>{const data=await invoke('load_workspace');for(const row of data.resources.filter((/** @type {any} */ row)=>row._type==='workspace'))if(!registered.has(row._id)){registerResourceProbeCollection(row._id,row.name);registered.add(row._id);}return data;};
      await read();await runEnvironmentImport(page,output,{read,saveExport:async path=>{
        const [selection]=await Promise.all([respondToOwnedSaveDialog(pid,output,path),page.getByRole('button',{name:'Export collections',exact:true}).click()]);
        await poll(async()=>await Bun.file(path).exists()&&await Bun.file(path).json().then(value=>value.__export_format===4,()=>false),'Complete native Secret export file');
        await Bun.write(output+'/native-save.json',JSON.stringify({passed:true,selection},null,2));
      }});
    });
  },{expectedIdentifier:integrationProbeIdentifier}));
}else await withPreview("postman-environment-import",runEnvironmentImport,{beforeNavigate:async (page) => {await page.addInitScript((data) => {
  if (!localStorage.getItem("insomnium-tauri-preview-v1")) localStorage.setItem("insomnium-tauri-preview-v1",JSON.stringify(data));
},original);}});
