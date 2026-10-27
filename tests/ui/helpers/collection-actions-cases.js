import {newRequest} from '../../../src/lib/model.js';
import {poll} from './native-app.js';
import assert from 'node:assert/strict';
/** @param {Record<string,any>} data */
export function addWideCollectionFixture(data){
 const folderId='fld_owned_large_selection';
 const requests=Array.from({length:10000},(_,index)=>({_id:'req_owned_large_selection_'+index,_type:'request',parentId:folderId,name:'Owned large request '+index,method:'GET',url:'http://127.0.0.1:1/never-send',body:{mimeType:'text/plain',text:''},headers:[],parameters:[],authentication:{}}));
 data.resources.push({_id:folderId,_type:'request_group',parentId:data.activeWorkspaceId,name:'Owned large collection'},
  {_id:'fldm_owned_large_selection',_type:'request_group_meta',parentId:folderId,collapsed:true},...requests);
 return {folderId,requests,selectedId:requests.at(-1)?._id};
}
/** @param {import('playwright-core').Page} page @param {string} output
 * @param {{readPersisted?:()=>Promise<any>,waitForSavedTheme?:(theme:string)=>Promise<void>}} [adapter] */
export async function exerciseCollectionActions(page,output,adapter={}){
 const readPersisted=adapter.readPersisted??(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}')));
 const errors=/** @type {string[]} */([]);page.on('pageerror',error=>errors.push(error.message));
 const rows=[];
 for(const theme of ['dark','light'])for(const width of [1440,900,760]){
  await page.setViewportSize({width,height:960});
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.getByRole('button',{name:'Toggle theme',exact:true}).click();
  await page.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);
  await page.keyboard.press('Control+s');
  if(adapter.waitForSavedTheme)await adapter.waitForSavedTheme(theme);else await page.waitForFunction(t=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').settings?.theme===t,theme);
  const before=await readPersisted();
  const cases=/** @type {Array<[string,string,boolean]>} */([['Owned selected action','.tree-request-row',true],['Owned idle action','.tree-request-row',false],['Owned action folder','.tree-folder',false]]);
  for(const [name,selector,active] of cases){
   const action=page.getByRole('button',{name:'Manage '+name,exact:true});
   const row=page.locator(selector).filter({has:action});assert.equal(await row.count(),1);
   await page.getByRole('button',{name:'Toggle theme',exact:true}).focus();await page.mouse.move(width-2,958);
   await page.waitForFunction(n=>{const el=document.querySelector(`button[aria-label="Manage ${n}"]`);return el&&getComputedStyle(el).opacity==='0';},name);
   const box=await row.boundingBox();assert.ok(box);
   // Hover the padded edge outside both buttons to prove the complete row owns hover.
   await page.mouse.move(box.x+box.width-2,box.y+box.height/2);
   await page.waitForFunction(n=>{const el=document.querySelector(`button[aria-label="Manage ${n}"]`);return el&&getComputedStyle(el).opacity==='1';},name);
   const hover=await row.evaluate((el,active)=>{const style=getComputedStyle(el);return {actual:style.backgroundColor,token:style.getPropertyValue(active?'--selected':'--hover').trim()};},active);
   const expected=await row.evaluate((el,active)=>{const p=document.createElement('span');p.style.backgroundColor=`var(${active?'--selected':'--hover'})`;el.appendChild(p);const value=getComputedStyle(p).backgroundColor;p.remove();return value;},active);
   assert.equal(hover.actual,expected,'Full row uses its hover/selection token');
   if(selector==='.tree-request-row'){
    await row.locator('.tree-request').hover();
    await page.waitForFunction(n=>{const action=document.querySelector(`button[aria-label="Manage ${n}"]`),button=action?.closest('.tree-request-row')?.querySelector('.tree-request');return !!button&&getComputedStyle(button).backgroundColor==='rgba(0, 0, 0, 0)';},name,{timeout:1500});
    assert.equal(await row.locator('.tree-request').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)','Hovered nested button does not cover row hover');
   }
   await page.mouse.move(width-2,958);
   await row.locator(active||selector==='.tree-request-row'?'.tree-request':'.folder-label').focus();await page.keyboard.press('Tab');
   if(selector==='.tree-folder')await page.keyboard.press('Tab');
   assert.equal(await action.evaluate(el=>el===document.activeElement&&el.matches(':focus-visible')),true,'Keyboard reaches exact action');
   assert.equal(await action.evaluate(el=>getComputedStyle(el).opacity),'1','Keyboard action visible without hover');
   await page.keyboard.press('Enter');const dialog=page.getByRole('dialog',{name:selector==='.tree-folder'?'Manage folder':'Manage request',exact:true});await dialog.waitFor();
   await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
   rows.push({theme,width,name,active,edgeHover:true,keyboard:true,dialog:true,background:expected});
  }
  const after=await readPersisted();assert.deepEqual(after.resources,before.resources);assert.deepEqual(after.history,before.history);
  await page.screenshot({path:output+`/${theme}-${width}.png`});
 }
 assert.deepEqual(errors,[]);return rows;

}

/** @param {Record<string,any>} data */
export function addCollectionDepthFixture(data){
const folders=Array.from({length:64},(_,index)=>({_id:`fld_owned_depth_${index}`,_type:'request_group',parentId:index?`fld_owned_depth_${index-1}`:data.activeWorkspaceId,name:`Owned depth ${index}`}));
const deepest=folders.at(-1);assert.ok(deepest);
const deepRequests=[
 newRequest(deepest._id,{_id:'req_owned_depth_http',name:'Owned deep HTTP',metaSortKey:20}),
 newRequest(deepest._id,{_id:'req_owned_depth_ws',_type:'websocket_request',name:'Owned deep WS',metaSortKey:10}),
 newRequest(deepest._id,{_id:'req_owned_depth_grpc',_type:'grpc_request',name:'Owned deep gRPC',metaSortKey:10,metadata:[],protoFileId:'',protoMethodName:'',body:{text:'{}'},grpcJsonMode:'legacy'}),
];
data.resources.push(...folders,...deepRequests,{_id:'fldm_owned_depth',_type:'request_group_meta',parentId:folders[0]._id,collapsed:true});
return {folders,deepRequests,deepest,selectedId:data.activeRequestId};
}

/** @param {import('playwright-core').Page} page @param {string} output
 * @param {ReturnType<typeof addCollectionDepthFixture>} fixture
 * @param {{readPersisted?:()=>Promise<any>}} [adapter] */
export async function exerciseCollectionDepth(page,output,fixture,adapter={}){
 const read=adapter.readPersisted??(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}')));
 const {folders,deepRequests,deepest,selectedId}=fixture;
 const sidebar=page.getByRole('complementary',{name:'Collections',exact:true});
 const root=sidebar.getByRole('button',{name:folders[0].name,exact:true});
 const filter=sidebar.getByRole('textbox',{name:'Filter requests',exact:true});
 const leaf=sidebar.locator('.tree-request-row').filter({hasText:'Owned deep HTTP'}).locator('.tree-request');
 await root.waitFor();assert.equal(await root.getAttribute('aria-expanded'),'false');assert.equal(await leaf.count(),0);
 const original=await read();
 await root.click();
 await sidebar.getByRole('button',{name:deepest.name,exact:true}).waitFor({timeout:3000});
 assert.equal(await sidebar.locator('.tree-folder').filter({hasText:'Owned depth'}).count(),64);
 assert.deepEqual((await sidebar.locator('.tree-request-row').filter({hasText:'Owned deep'}).locator('.tree-request').allTextContents()).map(text=>text.trim()),['WSOwned deep WS','gRPCOwned deep gRPC','GETOwned deep HTTP']);
 await leaf.click();await poll(async()=>(await read()).activeRequestId==='req_owned_depth_http','Deep selection persisted');
 const middle=sidebar.getByRole('button',{name:folders[32].name,exact:true});await middle.click();
 await leaf.waitFor({state:'detached'});assert.equal(await middle.getAttribute('aria-expanded'),'false');
 await filter.fill('Owned deep HTTP');await leaf.waitFor();assert.equal(await middle.getAttribute('aria-expanded'),'true');
 await poll(async()=>(await read()).resources?.some((/** @type {any} */ r)=>r._type==='workspace_meta'&&r.sidebarFilter==='Owned deep HTTP'),'Deep search persisted');
 const searched=await read();assert.equal(searched.resources.find((/** @type {any} */ r)=>r._type==='request_group_meta'&&r.parentId===folders[32]._id).collapsed,true);
 const authored=(/** @type {any} */ r)=>folders.some(folder=>folder._id===r._id)||deepRequests.some(request=>request._id===r._id);
 assert.deepEqual(searched.resources.filter(authored),original.resources.filter(authored));
 await page.reload();await leaf.waitFor();assert.equal(await filter.inputValue(),'Owned deep HTTP');assert.equal((await read()).activeRequestId,'req_owned_depth_http');
 await filter.fill('');await leaf.waitFor({state:'detached'});assert.equal(await middle.getAttribute('aria-expanded'),'false');
 await middle.click();await leaf.waitFor();await root.click();await leaf.waitFor({state:'detached'});
 await sidebar.locator('.tree-request-row').filter({hasText:'Owned selected action'}).locator('.tree-request').click();
 await poll(async()=>(await read()).activeRequestId===selectedId,'Original selection restored');
 const final=await read();assert.deepEqual(final.history,original.history);
 await Bun.write(output+'/depth.json',JSON.stringify({passed:true,folders:64,deepRequestProtocols:3,stableSort:true,selection:true,collapseSearchReload:true,authoredDataUnchanged:true,historyUnchanged:true},null,2));
}
