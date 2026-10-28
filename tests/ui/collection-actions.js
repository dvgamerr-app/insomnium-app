import assert from 'node:assert/strict';
import {environmentFor,initialData,newRequest} from '../../src/lib/model.js';
import {withPreview} from './helpers/preview-app.js';
import {exerciseCollectionActions,addCollectionDepthFixture,exerciseCollectionDepth} from './helpers/collection-actions-cases.js';
import {poll} from './helpers/native-app.js';

const data=initialData(),selected=data.resources.find(r=>r._id===data.activeRequestId);
assert.ok(selected);selected.name='Owned selected action';
const collection=data.resources.find((/** @type {any} */row)=>row._id===data.activeWorkspaceId);assert.ok(collection);collection.name='Owned retiring cookie wrk_01234567890123456789012345678901';
data.resources.push({_id:'fld_owned_actions',_type:'request_group',parentId:data.activeWorkspaceId,name:'Owned action folder'}, {...newRequest('fld_owned_actions'),_id:'req_owned_actions',name:'Owned idle action'});
const depth=addCollectionDepthFixture(data);
await withPreview('collection-actions',async(page,output)=>{
 const headerRows=[];
 for(const theme of ['dark','light'])for(const width of [1440,1200,1101,1100,900,760]){
  await page.setViewportSize({width,height:960});
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.getByRole('button',{name:'Toggle theme',exact:true}).click();
  await Bun.write(output+'/header-layout.json',JSON.stringify(await page.locator('.app-header').evaluate(el=>[...el.querySelectorAll('.header-collections, .header-collections > *, .header-search, .header-tools')].map(node=>({tag:node.tagName,class:node.className,rect:node.getBoundingClientRect().toJSON(),minWidth:getComputedStyle(node).minWidth,maxWidth:getComputedStyle(node).maxWidth}))),null,2));
  for(const name of ['New collection','Manage collection','Search requests','Toggle theme']){
   const button=page.getByRole('button',{name,exact:true});
   assert.equal(await button.evaluate(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,`${name} remains pointer-accessible at ${width}`);
  }
  const search=await page.getByRole('button',{name:'Search requests',exact:true}).boundingBox();assert.ok(search);
  assert.ok(Math.abs(search.x+search.width/2-width/2)<1,'Search remains centered');
  const chooser=page.getByRole('combobox',{name:'Collection',exact:true});await chooser.click();
  assert.equal(await chooser.evaluate(el=>el.matches(':open')),true,'Collection picker opens despite clipped selected text');
  if(width===1440||width===760)await page.screenshot({path:output+`/collection-picker-${theme}-${width}.png`});
  await chooser.press('Escape');
  await page.getByRole('button',{name:'Manage collection',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Manage collection',exact:true});await dialog.waitFor();
  assert.equal(await dialog.getByRole('textbox',{name:'Name',exact:true}).inputValue(),collection.name);
  await dialog.press('Escape');await dialog.waitFor({state:'detached'});headerRows.push({theme,width,controls:4,centered:true,manageClick:true});
 }
 await Bun.write(output+'/header.json',JSON.stringify({passed:true,rows:headerRows},null,2));
 await exerciseCollectionDepth(page,output,depth);
 const rows=await exerciseCollectionActions(page,output);
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}'));
 await page.evaluate(()=>{const key='insomnium-tauri-preview-v1',data=JSON.parse(localStorage.getItem(key)||'{}');
  const base=data.resources.find((/** @type {any} */row)=>row._type==='environment'&&row.parentId===data.activeWorkspaceId);base.data={owner:'source'};
  data.history.push({_id:'res_owned_move',requestId:'req_owned_actions',status:200,body:'saved response',environmentId:'',created:1});
  data.responseSelections['req_owned_actions']='res_owned_move';
  data.resources.push({_id:'wrk_move_destination',_type:'workspace',parentId:null,name:'Move destination',scope:'collection'},
   {_id:'env_move_destination',_type:'environment',parentId:'wrk_move_destination',name:'Base Environment',data:{owner:'destination'}});
  localStorage.setItem(key,JSON.stringify(data));});
 await page.reload();await page.getByRole('button',{name:'Import collection',exact:true}).waitFor();
 await page.locator('.tree-request-row').filter({hasText:'Owned idle action'}).locator('.tree-request').click();
 await poll(async()=>(await read()).activeRequestId==='req_owned_actions','Active request selected');
 const before=await read();
 assert.equal(before.history.length,1);assert.equal(before.responseSelections.req_owned_actions,'res_owned_move');
 assert.equal(/** @type {any} */ (environmentFor(before.resources,before.resources.find((/** @type {any} */row)=>row._id==='req_owned_actions'),''))['owner'],'source');
 await page.getByRole('button',{name:'Manage Owned idle action',exact:true}).click();
 const crossDialog=page.getByRole('dialog',{name:'Manage request',exact:true});
 await crossDialog.getByRole('combobox',{name:'Location',exact:true}).selectOption('wrk_move_destination');
 await crossDialog.getByRole('button',{name:'Save changes',exact:true}).click();await crossDialog.waitFor({state:'detached'});
 await poll(async()=>(await read()).resources.find((/** @type {any} */row)=>row._id==='req_owned_actions')?.parentId==='wrk_move_destination','Cross-collection move saved');
 let moved=await read();assert.equal(/** @type {any} */ (environmentFor(moved.resources,moved.resources.find((/** @type {any} */row)=>row._id==='req_owned_actions'),''))['owner'],'destination');
 assert.deepEqual(moved.history,before.history);assert.equal(moved.responseSelections.req_owned_actions,'res_owned_move');
 assert.equal(moved.activeWorkspaceId,'wrk_move_destination');assert.equal(moved.activeRequestId,'req_owned_actions');
 await page.reload();await page.getByRole('button',{name:'Import collection',exact:true}).waitFor();
 moved=await read();assert.equal(moved.resources.find((/** @type {any} */row)=>row._id==='req_owned_actions').parentId,'wrk_move_destination');
 assert.equal(moved.activeWorkspaceId,'wrk_move_destination');assert.equal(moved.activeRequestId,'req_owned_actions');
 assert.deepEqual(moved.history,before.history);assert.equal(moved.responseSelections.req_owned_actions,'res_owned_move');
 await page.getByRole('combobox',{name:'Collection',exact:true}).selectOption('wrk_move_destination');
 await page.getByRole('button',{name:'Manage Owned idle action',exact:true}).click();
 const returnDialog=page.getByRole('dialog',{name:'Manage request',exact:true});
 await returnDialog.getByRole('combobox',{name:'Location',exact:true}).selectOption('fld_owned_actions');
 await returnDialog.getByRole('button',{name:'Save changes',exact:true}).click();await returnDialog.waitFor({state:'detached'});
 await poll(async()=>(await read()).resources.find((/** @type {any} */row)=>row._id==='req_owned_actions')?.parentId==='fld_owned_actions','Return move saved');
 await page.getByRole('combobox',{name:'Collection',exact:true}).selectOption(before.activeWorkspaceId);
 await page.getByRole('button',{name:'Manage Owned idle action',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Manage request',exact:true}),location=dialog.getByRole('combobox',{name:'Location',exact:true});
 const expected=[collection.name,...depth.folders.map(row=>row.name)].join(' / ');
 assert.equal(await location.locator('option').filter({hasText:expected}).getAttribute('value'),depth.deepest._id);
 await location.selectOption(depth.deepest._id);await dialog.getByRole('button',{name:'Save changes',exact:true}).click();await dialog.waitFor({state:'detached'});
 await poll(async()=>(await read()).resources.find((/** @type {any} */row)=>row._id==='req_owned_actions')?.parentId===depth.deepest._id,'Move to deep folder saved');
 await page.reload();await page.getByRole('button',{name:'Import collection',exact:true}).waitFor();
 const after=await read();assert.equal(after.resources.find((/** @type {any} */row)=>row._id==='req_owned_actions').parentId,depth.deepest._id);
 assert.deepEqual(after.history,before.history);for(const folder of depth.folders)assert.deepEqual(after.resources.find((/** @type {any} */row)=>row._id===folder._id),before.resources.find((/** @type {any} */row)=>row._id===folder._id));
 await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,rows,historyReadOnly:true,depth:64,deepMoveReload:true,crossCollectionMoveReload:true,destinationEnvironment:true,activeMoveAndSavedResponse:true},null,2));
},{buildRoot:process.env.INSOMNIUM_UI_PREVIEW_BUILD,beforeNavigate:async page=>{await page.addInitScript(value=>{if(!localStorage.getItem('insomnium-tauri-preview-v1'))localStorage.setItem('insomnium-tauri-preview-v1',JSON.stringify(value));},data);}});
